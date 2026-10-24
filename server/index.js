"use strict";
// Lash Bounty ERP — server mandiri (Node.js >= 18, tanpa dependensi luar).
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("./config");
const { Store } = require("./store");
const { Auth } = require("./auth");
const { allowed, validateWrite, firstUserLogOk, selfUserUpdate, outFilter, todayIn } = require("./rules");
const ai = require("./ai");
const { sendMail, validEmail } = require("./mailer");
const { Telegram } = require("./telegram");
const { Sheets } = require("./sheets");
const { Notifier } = require("./notify");

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".txt": "text/plain; charset=utf-8", ".jpg": "image/jpeg", ".webp": "image/webp" };
const OPS = ["==", "!=", "<", "<=", ">", ">=", "in", "not-in", "array-contains"];

// Akun awal (data/seed-users.json): hanya membuat username yang belum ada, lalu file diganti nama supaya tidak dipakai ulang.
function seedUsers(store, dir) {
  const f = path.join(dir, "seed-users.json"); if (!fs.existsSync(f)) return 0;
  let n = 0;
  try {
    const j = JSON.parse(fs.readFileSync(f, "utf8")), at = new Date().toISOString();
    for (const u of Array.isArray(j.users) ? j.users : []) {
      const id = String(u.id || "").replace(/\s+/g, "").toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(id) || !u.hash || !u.salt || store.get("users", id)) continue;
      store.set("users", id, { username: id, nama: String(u.nama || id), role: u.role, cabang: u.cabang || "", aktif: true, salt: u.salt, hash: u.hash, iter: u.iter || 150000, pwAt: at, createdAt: at, createdBy: "Akun awal v1.1" }); n++;
    }
    store.flush(); fs.renameSync(f, path.join(dir, "seed-users.applied.json"));
    if (n) console.log(`[akun] ${n} akun awal dibuat dari seed-users.json`);
  } catch (err) { console.error("[akun] seed-users.json gagal dibaca:", err.message); }
  return n;
}

function createServer(cfg = config) {
  fs.mkdirSync(cfg.dataDir, { recursive: true });
  const store = new Store(cfg.dataDir, { backupKeep: cfg.backupKeep });
  seedUsers(store, cfg.dataDir);
  const auth = new Auth(store, cfg);
  const clients = new Set();
  const telegram = new Telegram(cfg, store), sheets = new Sheets(cfg, store), notifier = new Notifier(cfg, store, telegram);
  store.onChange((c, id, before, after) => notifier.onChange(c, id, before, after));
  // batas kirim per user (email/notifikasi) supaya tidak disalahgunakan
  const quota = new Map();
  const takeQuota = (key, max) => { const now = Date.now(), q = (quota.get(key) || []).filter(t => now - t < 3600e3); if (q.length >= max) return false; q.push(now); quota.set(key, q); return true; };
  const needLevel = (ctx, lvl) => { if (!ctx.user || ctx.level < lvl) throw Object.assign(new Error("Tidak punya akses."), { code: "not_granted", status: 403 }); };

  // ---- realtime: beri tahu browser koleksi mana yang berubah (tanpa isi data)
  store.onChange((c) => {
    const msg = `data: ${JSON.stringify({ c })}\n\n`;
    for (const res of clients) { try { res.write(msg); } catch {} }
  });

  const backup = (force = false) => { try { const f = store.dailyBackup(todayIn(cfg.timezone), force); if (f) console.log("[backup]", path.basename(f)); return f; } catch (err) { console.error("[backup] gagal:", err.message); return null; } };
  backup(); const backupTimer = setInterval(() => backup(false), 3 * 60 * 60 * 1000); backupTimer.unref();
  if (!cfg.noJobs) { notifier.start({ backup, sheets }); telegram.start(); }

  const ipOf = req => (cfg.trustProxy && String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || req.socket.remoteAddress || "";
  const tokenOf = (req, url) => { const h = String(req.headers.authorization || ""); return h.startsWith("Bearer ") ? h.slice(7) : url.searchParams.get("t") || ""; };
  const ctxOf = (req, url) => auth.context(tokenOf(req, url), req.headers["x-lb-device"] || url.searchParams.get("d"));

  function send(res, status, obj, extra = {}) {
    const body = JSON.stringify(obj);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": Buffer.byteLength(body), ...extra });
    res.end(body);
  }
  const fail = (res, err) => send(res, err.status || (err.code === "invalid_argument" ? 403 : 400), { code: err.code || "unavailable", message: err.message || "Error" });

  function readBody(req, limit) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on("data", ch => { size += ch.length; if (size > limit) { reject(Object.assign(new Error("Data terlalu besar."), { code: "invalid_argument", status: 413 })); req.destroy(); } else chunks.push(ch); });
      req.on("end", () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { reject(Object.assign(new Error("JSON tidak valid."), { code: "invalid_argument", status: 400 })); } });
      req.on("error", reject);
    });
  }


  const getField = (d, f) => String(f).split(".").reduce((o, k) => (o == null ? undefined : o[k]), d);
  function matchWhere(d, [f, op, v]) {
    const x = getField(d, f);
    switch (op) {
      case "==": return x === v; case "!=": return x !== v; case "<": return x < v; case "<=": return x <= v; case ">": return x > v; case ">=": return x >= v;
      case "in": return Array.isArray(v) && v.includes(x); case "not-in": return Array.isArray(v) && !v.includes(x);
      case "array-contains": return Array.isArray(x) && x.includes(v); default: return false;
    }
  }

  // ---- database API
  async function dbApi(req, res, url) {
    const ctx = ctxOf(req, url), b = await readBody(req, 4 * 1024 * 1024);
    const c = String(b.c || ""), id = b.id == null ? "" : String(b.id), op = String(b.op || "");
    if (!Store.validColl(c)) throw Object.assign(new Error("Koleksi tidak valid."), { code: "invalid_argument", status: 400 });
    if (op === "get") {
      if (!Store.validId(id)) throw Object.assign(new Error("Id tidak valid."), { code: "invalid_argument", status: 400 });
      if (!allowed(ctx, "read", c, id)) return send(res, 200, { exists: false, data: null });
      const d = store.get(c, id); return send(res, 200, { exists: !!d, data: outFilter(ctx, c, id, d) });
    }
    if (op === "query") {
      const where = Array.isArray(b.where) ? b.where.slice(0, 10) : [];
      if (where.some(w => !Array.isArray(w) || w.length !== 3 || !OPS.includes(w[1]) || (["in", "not-in"].includes(w[1]) && (!Array.isArray(w[2]) || w[2].length > 30)))) throw Object.assign(new Error("Filter tidak valid."), { code: "invalid_argument", status: 400 });
      if (!allowed(ctx, "read", c, "")) {
        // Tanpa akses koleksi: hanya dokumen milik sendiri (aturan {self}).
        const own = ctx.self && allowed(ctx, "read", c, ctx.self) && store.get(c, ctx.self);
        return send(res, 200, { docs: own && where.every(w => matchWhere(own, w)) ? [{ id: ctx.self, data: outFilter(ctx, c, ctx.self, own) }] : [] });
      }
      let rows = store.list(c).filter(r => where.every(w => matchWhere(r.data, w)));
      if (b.orderBy && b.orderBy.field) { const f = b.orderBy.field, dir = b.orderBy.dir === "desc" ? -1 : 1;
        rows.sort((a, z) => { const x = getField(a.data, f), y = getField(z.data, f); if (x === undefined && y === undefined) return 0; if (x === undefined) return 1; if (y === undefined) return -1; return (x < y ? -1 : x > y ? 1 : 0) * dir; }); }
      else rows.sort((a, z) => (a.id < z.id ? -1 : a.id > z.id ? 1 : 0));
      const lim = Math.max(1, Math.min(1000, parseInt(b.limit, 10) || 1000));
      return send(res, 200, { docs: rows.slice(0, lim).map(r => ({ id: r.id, data: outFilter(ctx, c, r.id, r.data) })) });
    }
    if (["set", "update", "delete", "add"].includes(op)) {
      const docId = op === "add" ? crypto.randomBytes(10).toString("base64url").replace(/[^A-Za-z0-9]/g, "x") : id;
      if (!Store.validId(docId)) throw Object.assign(new Error("Id tidak valid."), { code: "invalid_argument", status: 400 });
      const isBootUser = c === "users" && ctx.bootstrap && !ctx.user && op === "set";
      const isBootLog = c === "logadm" && !ctx.user && op === "add" && firstUserLogOk(store, b.data);
      const isSelf = selfUserUpdate(ctx, op, c, docId, b.data);
      if (!isBootUser && !isBootLog && !isSelf && !allowed(ctx, "write", c, docId)) throw Object.assign(new Error("Tidak punya akses untuk menyimpan data ini."), { code: "invalid_argument" });
      validateWrite(ctx, op, c, docId, b.data, store, cfg);
      if (op === "set" || op === "add") store.set(c, docId, b.data);
      else if (op === "update") store.update(c, docId, b.data);
      else store.delete(c, docId);
      if (c === "users") auth.revalidate(docId);
      return send(res, 200, { ok: true, id: docId });
    }
    throw Object.assign(new Error("Operasi tidak dikenal."), { code: "invalid_argument", status: 400 });
  }

  // ---- file statis
  function serveStatic(req, res, url) {
    let p = decodeURIComponent(url.pathname);
    if (p === "/" || p === "") p = "/index.html";
    const file = path.normalize(path.join(cfg.publicDir, p));
    if (!file.startsWith(cfg.publicDir + path.sep)) { res.writeHead(403); return res.end(); }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Tidak ditemukan"); }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Content-Length": st.size,
        "Cache-Control": ext === ".html" ? "no-cache" : /\/(vendor|fonts)\//.test(file) ? "public, max-age=2592000" : "no-cache",
        "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Frame-Options": "SAMEORIGIN" });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(file).pipe(res);
    });
  }

  const server = http.createServer(async (req, res) => {
    let url; try { url = new URL(req.url, "http://localhost"); } catch { res.writeHead(400); return res.end(); }
    const p = url.pathname;
    try {
      if (p === "/api/health") return send(res, 200, { ok: true, version: cfg.version });
      if (p === "/api/me" && req.method === "GET") { const ctx = ctxOf(req, url); return send(res, 200, { user: ctx.user, level: ctx.level, bootstrap: ctx.bootstrap, ai: !!cfg.ai.apiKey, aiMedia: ai.MEDIA, version: cfg.version, tz: cfg.timezone }); }
      if (p === "/api/login" && req.method === "POST") {
        const b = await readBody(req, 64 * 1024), r = auth.login(b.username, b.password, !!b.remember, ipOf(req));
        if (r.error) return send(res, r.error === "locked" ? 429 : 401, { code: r.error, wait: r.wait || 0, message: r.error === "inactive" ? "Akun ini dinonaktifkan. Hubungi owner." : r.error === "locked" ? `Terlalu banyak percobaan. Tunggu ${r.wait} detik.` : "Username atau password salah." });
        store.set("log", crypto.randomBytes(10).toString("hex"), { at: new Date().toISOString(), by: r.user.id, nama: r.user.nama || r.user.id, aksi: "login", path: "users/" + r.user.id, coll: "login", hal: "", ringkas: "login · " + r.user.id, before: null, after: null });
        return send(res, 200, r);
      }
      if (p === "/api/logout" && req.method === "POST") { auth.logout(tokenOf(req, url)); return send(res, 200, { ok: true }); }
      if (p === "/api/db" && req.method === "POST") return await dbApi(req, res, url);
      if (p === "/api/ai" && req.method === "POST") {
        const ctx = ctxOf(req, url); if (!ctx.user) throw Object.assign(new Error("Login dulu untuk memakai AI."), { code: "not_granted", status: 401 });
        const b = await readBody(req, 25 * 1024 * 1024); return send(res, 200, await ai.complete(cfg, b));
      }
      if (p === "/api/stream" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" });
        res.write("retry: 3000\n\n: ok\n\n"); clients.add(res);
        const hb = setInterval(() => { try { res.write(": hb\n\n"); } catch {} }, 25000);
        req.on("close", () => { clearInterval(hb); clients.delete(res); });
        return;
      }
      if (p === "/api/email" && req.method === "POST") {
        const ctx = ctxOf(req, url); needLevel(ctx, 1); const b = await readBody(req, 25 * 1024 * 1024);
        if (!takeQuota("mail:" + ctx.user.id, 60)) throw Object.assign(new Error("Batas kirim email per jam tercapai."), { code: "rate_limited", status: 429 });
        const to = [].concat(b.to || []).map(String).filter(validEmail), cc = [].concat(b.cc || []).map(String).filter(validEmail);
        const atts = (Array.isArray(b.attachments) ? b.attachments : []).slice(0, 5).filter(a => a && a.data && a.filename);
        const r = await sendMail(cfg.smtp, { to, cc, replyTo: ctx.user.email || undefined, subject: String(b.subject || "(tanpa subjek)").slice(0, 200), text: String(b.text || "").slice(0, 50000), attachments: atts });
        store.set("log", crypto.randomBytes(10).toString("hex"), { at: new Date().toISOString(), by: ctx.user.id, nama: ctx.user.nama || ctx.user.id, aksi: "email", path: "email", coll: "email", hal: "", ringkas: `email · ${String(b.subject || "").slice(0, 60)} → ${[...to, ...cc].join(", ").slice(0, 100)}`, before: null, after: null });
        return send(res, 200, r);
      }
      if (p === "/api/notify" && req.method === "POST") {
        const ctx = ctxOf(req, url); needLevel(ctx, 1); const b = await readBody(req, 256 * 1024);
        if (!takeQuota("ntf:" + ctx.user.id, 40)) throw Object.assign(new Error("Batas notifikasi per jam tercapai."), { code: "rate_limited", status: 429 });
        const roles = [].concat(b.to || "owner").filter(r => ["owner", "head"].includes(r));
        const r = await notifier.toRoles(roles.length ? roles : ["owner"], String(b.subject || "Notifikasi").slice(0, 120), String(b.text || "").slice(0, 3500), String(b.event || "manual"));
        return send(res, 200, r);
      }
      if (p === "/api/announce" && req.method === "POST") {
        const ctx = ctxOf(req, url); needLevel(ctx, 2); const b = await readBody(req, 1024 * 1024);
        const doc = store.get("pengumuman", String(b.id || "")); if (!doc) throw Object.assign(new Error("Pengumuman tidak ditemukan."), { code: "invalid_argument", status: 404 });
        const ky = (store.get("settings", "karyawan")?.list || []).filter(x => x.aktif !== false);
        const t = doc.target || {}, list = ky.filter(x => t.mode === "cabang" ? (t.cabang || []).includes(x.cabang || "Pusat") : t.mode === "pilih" ? (t.ids || []).includes(x.id) : true);
        const hasil = []; let em = 0, tg = 0;
        for (const x of list) {
          const row = { id: x.id, nama: x.nama, email: "", telegram: "" };
          if (doc.channels?.email && x.email && validEmail(x.email)) { try { await sendMail(cfg.smtp, { to: [x.email], replyTo: ctx.user.email || undefined, subject: doc.judul, text: `Halo ${x.nama},\n\n${doc.isi}\n\nSalam,\n${doc.dari || "Manajemen Lash Bounty"}`, attachments: [] }); row.email = "terkirim"; em++; } catch (err) { row.email = "gagal: " + err.message.slice(0, 80); } }
          if (doc.channels?.telegram && x.tgChat && telegram.enabled) { try { await telegram.send(x.tgChat, `📢 ${doc.judul}\n\n${doc.isi}\n\n— ${doc.dari || "Manajemen Lash Bounty"}`); row.telegram = "terkirim"; tg++; } catch (err) { row.telegram = "gagal: " + err.message.slice(0, 80); } }
          hasil.push(row);
        }
        store.update("pengumuman", String(b.id), { terkirimAt: new Date().toISOString(), terkirimBy: ctx.user.nama || ctx.user.id, hasil, ringkas: { email: em, telegram: tg, total: list.length } });
        return send(res, 200, { ok: true, email: em, telegram: tg, total: list.length });
      }
      if (p === "/api/integrations" && req.method === "GET") {
        const ctx = ctxOf(req, url); needLevel(ctx, 2);
        return send(res, 200, { email: { configured: notifier.emailOn, from: cfg.smtp.from }, telegram: { configured: telegram.enabled, bot: telegram.me?.username || "", error: telegram.lastError },
          sheets: { configured: sheets.enabled, email: sheets.email, sheetId: cfg.sheets.sheetId, lastSync: sheets.lastSync, error: sheets.lastError, intervalMin: cfg.sheets.intervalMin },
          ai: { configured: !!cfg.ai.apiKey, model: cfg.ai.model }, backupHour: cfg.backupHour, reminderHour: cfg.reminderHour, tz: cfg.timezone, log: notifier.log.slice(0, 20),
          backups: (() => { try { return fs.readdirSync(path.join(cfg.dataDir, "backups")).filter(f => f.endsWith(".json")).sort().reverse().slice(0, 10); } catch { return []; } })() });
      }
      if (p === "/api/integrations/test" && req.method === "POST") {
        const ctx = ctxOf(req, url); needLevel(ctx, 2); const b = await readBody(req, 64 * 1024);
        if (!takeQuota("test:" + ctx.user.id, 20)) throw Object.assign(new Error("Terlalu sering. Coba lagi nanti."), { code: "rate_limited", status: 429 });
        if (b.channel === "telegram") return send(res, 200, await telegram.send(String(b.to || ""), "✅ Tes notifikasi dari Lash Bounty ERP berhasil."));
        if (b.channel === "email") return send(res, 200, await sendMail(cfg.smtp, { to: [String(b.to || "")], subject: "Tes email Lash Bounty ERP", text: "Halo,\n\nIni email percobaan dari Lash Bounty ERP. Kalau email ini masuk, pengaturan email sudah benar.\n\nTerima kasih." }));
        if (b.channel === "reminder") return send(res, 200, { ok: true, count: await notifier.runReminders() });
        if (b.channel === "backup") { const f = backup(true); return send(res, 200, { ok: !!f, file: f ? path.basename(f) : "" }); }
        throw Object.assign(new Error("Channel tidak dikenal."), { code: "invalid_argument", status: 400 });
      }
      if (p === "/api/sheets/sync" && req.method === "POST") { const ctx = ctxOf(req, url); needLevel(ctx, 2); return send(res, 200, await sheets.sync(true)); }
      if (p.startsWith("/api/")) return send(res, 404, { code: "not_found", message: "Endpoint tidak ada." });
      if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
      return serveStatic(req, res, url);
    } catch (err) {
      if (!err.code) console.error("[server]", err);
      if (!res.headersSent) fail(res, err); else res.end();
    }
  });

  const close = () => new Promise(r => { clearInterval(backupTimer); notifier.stop(); telegram.stop(); for (const c of clients) { try { c.end(); } catch {} } store.flush(); auth.flush(); server.close(() => r()); });
  return { server, store, auth, close, notifier, sheets, telegram };
}

if (require.main === module) {
  const app = createServer();
  app.server.listen(config.port, config.host, () => {
    console.log(`Lash Bounty ERP v${config.version} berjalan di http://${config.host === "0.0.0.0" ? "localhost" : config.host}:${config.port}`);
    console.log(`Data: ${config.dataDir} · AI: ${config.ai.apiKey ? "aktif (" + config.ai.model + ")" : "nonaktif (isi ANTHROPIC_API_KEY untuk mengaktifkan)"}`);
  });
  const stop = () => { console.log("Menyimpan data & berhenti…"); app.close().then(() => process.exit(0)); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop); process.on("SIGHUP", stop);
}

module.exports = { createServer };
