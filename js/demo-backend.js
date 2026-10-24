/* Lash Bounty ERP V.1.1 · MODE DEMO
   Server tiruan di dalam browser: database, login, hak akses (aturan server asli), notifikasi & email disimulasikan
   ke "Kotak keluar demo". Data tersimpan di browser ini saja. AI memakai Claude lewat artifact. */
(function () {
  "use strict";
  const HOST = window.claude;
  const VERSION = "1.1.0-demo", TZ = "Asia/Jakarta", KEY = "lbdemo-v11";
  const DEMO_PW = "demo1234";

  /* ---------- penyimpanan: localStorage, cadangan window.name ---------- */
  const mem = {
    read() { try { const v = localStorage.getItem(KEY); if (v) return JSON.parse(v); } catch {} try { const w = JSON.parse(window.name || "{}"); if (w[KEY]) return w[KEY]; } catch {} return null; },
    write(d) { const s = JSON.stringify(d); let ok = false; try { localStorage.setItem(KEY, s); ok = true; } catch {}
      if (!ok) { try { const w = (() => { try { return JSON.parse(window.name || "{}"); } catch { return {}; } })(); w[KEY] = d; window.name = JSON.stringify(w); } catch {} } return ok; },
    clear() { try { localStorage.removeItem(KEY); } catch {} try { const w = JSON.parse(window.name || "{}"); delete w[KEY]; window.name = JSON.stringify(w); } catch { window.name = ""; } },
  };
  let D = null, saveT = null;
  const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => mem.write(D), 250); };
  window.addEventListener("pagehide", () => { if (D) mem.write(D); });

  /* ---------- aturan akses: salinan server/rules.js ---------- */
  const R = (function () { const module = { exports: {} };

// Aturan akses per koleksi. Level: 0 = belum login (link check-in absensi), 1 = Manager/Staff cabang,
// 2 = Admin keuangan / HRD / Head of admin, 3 = Owner. "bank" = khusus Owner & Head of admin.
// roles: role tambahan yang boleh walau levelnya kurang (contoh Trainer untuk KPI).
const BANK = "bank";

const RULES = {
  settings: { read: 0, write: 2 },
  users:    { read: 2, write: 2 },
  closing:  { read: 1, write: 2 },
  pusat:    { read: 2, write: 2 },
  payroll:  { read: 2, write: 2 },
  kpi:      { read: 2, write: 2, roles: ["trainer"] },
  aset:     { read: 2, write: 2 },
  logadm:   { read: 2, write: 2 },
  log:      { read: 2, write: 0 },
  bayar:    { read: 2, write: 2 },
  kas:      { read: 2, write: 2 },
  cust:     { read: 2, write: 2 },
  custtx:   { read: 2, write: 2 },
  bankcfg:  { read: 2, write: BANK },
  mutasi:   { read: BANK, write: BANK },
  bankflag: { read: BANK, write: BANK },
  pwreq:    { read: 2, write: 2, self: { read: 0, write: 0 } },
  askboss:  { read: 2, write: 2, self: { read: 1, write: 1 } },
  absen:    { read: 0, write: 0 },
  permintaan: { read: 1, write: 1 },
  refund:   { read: 2, write: 2 },
  kasbon:   { read: 2, write: 2 },
  pengumuman: { read: 1, write: 2 },
  pemusnahan: { read: 2, write: 2 },
  tabungan: { read: 2, write: BANK },
  tgchats:  { read: 2, write: 99 },
  aiimport: { read: 2, write: 2 },
  _default: { read: 1, write: 1 },
};
const ruleOf = c => RULES[c] || RULES._default;

function allowed(ctx, op, coll, id) {
  const r = ruleOf(coll), need = r[op];
  if (r.self && id && ctx.self && id === ctx.self && ctx.level >= r.self[op]) return true;
  if (need === BANK) return ctx.role === "owner" || ctx.role === "head";
  if (r.roles && r.roles.includes(ctx.role)) return true;
  return ctx.level >= need;
}

// Catatan riwayat "akun owner pertama dibuat" dikirim browser sesaat setelah akun dibuat (sebelum login).
function firstUserLogOk(store, data) {
  if (data?.coll !== "users") return false;
  const us = store.list("users");
  return us.length === 1 && Date.now() - Date.parse(us[0].data.createdAt || 0) < 120000;
}

// Validasi tambahan untuk penulisan sensitif. Melempar {code} kalau ditolak.
function deny(msg) { return Object.assign(new Error(msg), { code: "invalid_argument" }); }
function todayIn(tz, offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 864e5);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// User boleh mengubah sendiri: tanda tangan & password (tidak boleh ubah role/aktif).
const SELF_KEYS = ["ttd", "ttdAt", "salt", "hash", "iter", "pwAt", "mustChange"];
function selfUserUpdate(ctx, op, coll, id, data) {
  return coll === "users" && op === "update" && !!ctx.user && id === ctx.user.id && data && Object.keys(data).length > 0 && Object.keys(data).every(k => SELF_KEYS.includes(k));
}
// Data karyawan lengkap (KTP, alamat, rekening) hanya untuk role admin; selain itu hanya nama/jabatan/penempatan.
const KY_PUBLIC = ["id", "nama", "jabatan", "cabang", "aktif"];
function outFilter(ctx, c, id, d) {
  if (!d) return d;
  if (c === "users") { const o = { ...d }; delete o.hash; delete o.salt; delete o.iter; return o; }
  if (c === "settings" && id === "karyawan" && ctx.level < 2) return { ...d, list: (d.list || []).map(x => Object.fromEntries(KY_PUBLIC.filter(k => k in x).map(k => [k, x[k]]))) };
  return d;
}

function validateWrite(ctx, op, coll, id, data, store, config) {
  if (selfUserUpdate(ctx, op, coll, id, data)) return;
  // Akun: hanya Owner & Head of admin; akun Owner hanya oleh Owner; akun pertama boleh dibuat saat sistem masih kosong.
  if (coll === "users") {
    const cur = store.get("users", id);
    if (ctx.bootstrap && !ctx.user) {
      if (op !== "set" || data?.role !== "owner" || data?.aktif === false) throw deny("Akun pertama harus Owner.");
      return;
    }
    if (!(ctx.role === "owner" || ctx.role === "head")) throw deny("Hanya Owner dan Head of admin yang bisa mengelola akun.");
    const touchesOwner = cur?.role === "owner" || data?.role === "owner";
    if (touchesOwner && ctx.role !== "owner") throw deny("Akun Owner hanya bisa diubah Owner.");
    if (op === "delete" && id === ctx.user?.id) throw deny("Tidak bisa menghapus akun sendiri.");
    return;
  }
  // Permintaan lupa password (boleh tanpa login): hanya untuk username yang ada & aktif, hanya buat/timpa milik perangkat sendiri.
  if (coll === "pwreq" && ctx.level < 2) {
    if (op !== "set") throw deny("Permintaan tidak valid.");
    const u = store.get("users", String(data?.username || ""));
    if (!u || u.aktif === false) throw deny("Username tidak ditemukan.");
    if (!data.hash || !data.salt || data.status !== "pending") throw deny("Permintaan tidak valid.");
    return;
  }
  // Check-in tanpa login: hanya hari ini, karyawan aktif, field masuk/pulang saja.
  if (coll === "absen" && ctx.level < 1) {
    const days = [todayIn(config.timezone), todayIn(config.timezone, -1)];
    const m = /^(\d{4}-\d{2}-\d{2})_(.+)$/.exec(id || ""); if (!m || !days.includes(m[1])) throw deny("Check-in hanya untuk hari ini.");
    const ky = store.get("settings", "karyawan")?.list || [], emp = ky.find(x => x.id === m[2] && x.aktif !== false);
    if (!emp) throw deny("Karyawan tidak terdaftar.");
    const cur = store.get("absen", id);
    if (op === "set") { if (cur) throw deny("Sudah check-in."); if (data.empId !== emp.id || data.tanggal !== m[1]) throw deny("Data check-in tidak cocok."); return; }
    if (op === "update") { const okKeys = ["masuk", "masukAt", "pulang", "pulangAt", "status"]; if (Object.keys(data || {}).some(k => !okKeys.includes(k))) throw deny("Perubahan tidak diizinkan."); return; }
    throw deny("Perubahan tidak diizinkan.");
  }
  // Permintaan barang: cabang boleh membuat & menandai diterima; proses (dipesan/dikirim/ditolak) oleh admin.
  if (coll === "permintaan" && ctx.level < 2) {
    const cur = store.get("permintaan", id);
    if (op === "delete") { if (!cur || cur.by !== ctx.user?.id || cur.status !== "menunggu") throw deny("Hanya permintaan sendiri yang masih menunggu yang bisa dibatalkan."); return; }
    if (!cur) { if (data?.status !== "menunggu") throw deny("Permintaan baru harus berstatus menunggu."); return; }
    const okKeys = ["status", "diterimaAt", "diterimaBy", "stokId", "riwayat"];
    if (Object.keys(data || {}).some(k => !okKeys.includes(k)) || data.status !== "diterima" || !["dikirim", "dipesan"].includes(cur.status)) throw deny("Status permintaan hanya bisa diubah admin.");
    return;
  }
  // Refund: persetujuan / penolakan hanya oleh Owner.
  if (coll === "refund") {
    const cur = store.get("refund", id), next = op === "update" ? { ...cur, ...data } : data;
    const decided = s => ["disetujui", "ditolak"].includes(s);
    if (op !== "delete" && next && (decided(next.status) && (!cur || !decided(cur.status)) || (cur && decided(cur.status) && next.status === "diajukan")) && ctx.role !== "owner") throw deny("Konfirmasi refund hanya oleh Owner.");
    if (op === "delete" && cur && cur.status !== "diajukan" && ctx.role !== "owner") throw deny("Refund yang sudah diproses hanya bisa dihapus Owner.");
    return;
  }
  // Catatan riwayat dari link check-in.
  if (coll === "log" && ctx.level < 1) {
    if (op !== "add") throw deny("Tidak diizinkan.");
    if (data?.coll === "absen") return;
    if (firstUserLogOk(store, data)) return;
    throw deny("Tidak diizinkan.");
  }
}

module.exports = { RULES, ruleOf, allowed, validateWrite, firstUserLogOk, selfUserUpdate, outFilter, todayIn, BANK };

    return module.exports; })();

  /* ---------- store ---------- */
  const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const listeners = new Set();
  const col = c => (D.cols[c] ||= {});
  const store = {
    get version() { return D.ver || 0; },
    get(c, id) { return clone(col(c)[id]) ?? null; },
    list(c) { return Object.entries(col(c)).map(([id, data]) => ({ id, data: clone(data) })); },
    set(c, id, data) { const before = col(c)[id] || null; col(c)[id] = clone(data); changed(c, id, before, data); },
    update(c, id, patch) { const cur = col(c)[id]; if (!cur) throw err("invalid_argument", "Dokumen tidak ditemukan.");
      const next = { ...cur, ...clone(patch) }; for (const [k, v] of Object.entries(next)) if (v && typeof v === "object" && v.__delete__ === true) delete next[k];
      col(c)[id] = next; changed(c, id, cur, next); },
    delete(c, id) { const before = col(c)[id]; if (!before) return; delete col(c)[id]; changed(c, id, before, null); },
  };
  function changed(c, id, before, after) { D.ver = (D.ver || 0) + 1; persist(); try { notifyChange(c, id, clone(before), clone(after)); } catch {} for (const fn of listeners) { try { fn({ c }); } catch {} } }
  function err(code, message, extra) { return Object.assign(new Error(message || code), { code }, extra || {}); }
  const rid = (n = 20) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[b % 62]).join("");
  const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, "0")).join("");
  async function pwHash(pw, salt, iter = 150000) { const enc = new TextEncoder(), key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
    return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: iter }, key, 256)); }

  /* ---------- auth ---------- */
  const ROLE_LEVEL = { owner: 3, head: 2, admin: 2, hrd: 2, manager: 1, trainer: 1, staff: 1 };
  const publicUser = (id, u) => { if (!u) return null; const o = { id, ...u }; delete o.hash; delete o.salt; delete o.iter; return o; };
  const hashTag = u => String(u?.hash || "").slice(0, 16);
  function context(token, dev) {
    let user = null; const s = token && D.sessions[token];
    if (s) { const u = store.get("users", s.u); if (!u || u.aktif === false || hashTag(u) !== s.h || s.exp < Date.now()) { delete D.sessions[token]; persist(); } else user = publicUser(s.u, u); }
    const role = user?.role || "", level = user ? (ROLE_LEVEL[role] || 0) : 0;
    return { user, role, level, token: user ? token : "", self: user ? user.id : (dev || ""), deviceId: dev || "", bootstrap: !store.list("users").length };
  }
  async function login({ username, password, remember }) {
    const un = String(username || "").replace(/\s+/g, "").toLowerCase(), u = store.get("users", un), now = Date.now();
    const f = D.fails[un] || { n: 0, until: 0 }; if (f.until > now) throw err("locked", "Terlalu banyak percobaan. Coba lagi sebentar lagi.", { status: 429, wait: Math.ceil((f.until - now) / 1000) });
    const ok = u && u.aktif !== false && u.hash && (await pwHash(String(password || ""), u.salt, u.iter || 150000)) === u.hash;
    if (!ok) { f.n++; if (f.n >= 5) { f.until = now + 60000; f.n = 0; } D.fails[un] = f; persist(); throw err("unauthenticated", "Username atau password salah.", { status: 401 }); }
    delete D.fails[un]; const token = rid(32); D.sessions[token] = { u: un, h: hashTag(u), exp: now + (remember ? 30 : 0.5) * 864e5 }; persist();
    return { token, remember: !!remember, user: publicUser(un, u) };
  }

  /* ---------- query ---------- */
  const OPS = ["==", "!=", "<", "<=", ">", ">=", "in", "not-in", "array-contains"];
  const getField = (d, f) => String(f).split(".").reduce((o, k) => (o == null ? undefined : o[k]), d);
  function matchWhere(d, [f, op, v]) { const x = getField(d, f);
    switch (op) { case "==": return x === v; case "!=": return x !== v; case "<": return x < v; case "<=": return x <= v; case ">": return x > v; case ">=": return x >= v;
      case "in": return Array.isArray(v) && v.includes(x); case "not-in": return Array.isArray(v) && !v.includes(x); case "array-contains": return Array.isArray(x) && x.includes(v); default: return false; } }
  const validColl = c => /^[A-Za-z0-9_-]{1,60}$/.test(c), validId = id => /^[A-Za-z0-9_.-]{1,200}$/.test(id);
  function dbApi(ctx, b) {
    const c = String(b.c || ""), id = b.id == null ? "" : String(b.id), op = String(b.op || "");
    if (!validColl(c)) throw err("invalid_argument", "Koleksi tidak valid.", { status: 400 });
    if (op === "get") { if (!validId(id)) throw err("invalid_argument", "Id tidak valid.", { status: 400 }); if (!R.allowed(ctx, "read", c, id)) return { exists: false, data: null };
      const d = store.get(c, id); return { exists: !!d, data: R.outFilter(ctx, c, id, d) }; }
    if (op === "query") {
      const where = Array.isArray(b.where) ? b.where.slice(0, 10) : [];
      if (where.some(w => !Array.isArray(w) || w.length !== 3 || !OPS.includes(w[1]))) throw err("invalid_argument", "Filter tidak valid.", { status: 400 });
      if (!R.allowed(ctx, "read", c, "")) { const own = ctx.self && R.allowed(ctx, "read", c, ctx.self) && store.get(c, ctx.self);
        return { docs: own && where.every(w => matchWhere(own, w)) ? [{ id: ctx.self, data: R.outFilter(ctx, c, ctx.self, own) }] : [] }; }
      let rows = store.list(c).filter(r => where.every(w => matchWhere(r.data, w)));
      if (b.orderBy && b.orderBy.field) { const f = b.orderBy.field, dir = b.orderBy.dir === "desc" ? -1 : 1;
        rows.sort((a, z) => { const x = getField(a.data, f), y = getField(z.data, f); if (x === undefined && y === undefined) return 0; if (x === undefined) return 1; if (y === undefined) return -1; return (x < y ? -1 : x > y ? 1 : 0) * dir; }); }
      else rows.sort((a, z) => (a.id < z.id ? -1 : a.id > z.id ? 1 : 0));
      const lim = Math.max(1, Math.min(1000, parseInt(b.limit, 10) || 1000));
      return { docs: rows.slice(0, lim).map(r => ({ id: r.id, data: R.outFilter(ctx, c, r.id, r.data) })) };
    }
    if (["set", "update", "delete", "add"].includes(op)) {
      const docId = op === "add" ? rid(20) : id; if (!validId(docId)) throw err("invalid_argument", "Id tidak valid.", { status: 400 });
      const isBootUser = c === "users" && ctx.bootstrap && !ctx.user && op === "set", isBootLog = c === "logadm" && !ctx.user && op === "add" && R.firstUserLogOk(store, b.data);
      const isSelf = R.selfUserUpdate(ctx, op, c, docId, b.data);
      if (!isBootUser && !isBootLog && !isSelf && !R.allowed(ctx, "write", c, docId)) throw err("invalid_argument", "Tidak punya akses untuk menyimpan data ini.", { status: 403 });
      try { R.validateWrite(ctx, op, c, docId, b.data, store, { timezone: TZ }); } catch (e) { throw Object.assign(e, { status: 403 }); }
      if (op === "set" || op === "add") store.set(c, docId, b.data); else if (op === "update") store.update(c, docId, b.data); else store.delete(c, docId);
      if (c === "users") for (const [t, s] of Object.entries(D.sessions)) { if (s.u === docId) { const u = store.get("users", docId); if (!u || u.aktif === false || hashTag(u) !== s.h) delete D.sessions[t]; } }
      return { ok: true, id: docId };
    }
    throw err("invalid_argument", "Operasi tidak dikenal.", { status: 400 });
  }

  /* ---------- kotak keluar demo (email, Telegram, notifikasi disimulasikan) ---------- */
  const rp = n => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
  const short = c => String(c || "").replace(/^cabang\s+/i, "") || "–";
  function outbox(o) { D.outbox.unshift({ id: rid(10), at: new Date().toISOString(), ...o }); D.outbox.length = Math.min(D.outbox.length, 200); persist(); window.dispatchEvent(new CustomEvent("lbdemo-outbox")); }
  function rcpt(roles) { const out = { tg: [], email: [] }; for (const { data: u } of store.list("users")) { if (u.aktif === false || !roles.includes(u.role)) continue; if (u.tgChat) out.tg.push(u.nama + " (" + u.tgChat + ")"); if (u.email) out.email.push(u.email); } return out; }
  function deliver(roles, subject, text, event) { const s = store.get("settings", "notify") || {}; if (s.events && s.events[event] === false) return { tg: 0, email: 0 };
    const r = rcpt(roles); outbox({ kanal: "Notifikasi", event, subject, text, ke: [...r.tg.map(x => "Telegram " + x), ...r.email].join(", ") || roles.map(x => ({ owner: "Owner", head: "Head of admin" }[x] || x)).join(", ") + " (belum ada email/Telegram di akun)" }); return { tg: r.tg.length, email: r.email.length }; }
  function notifyChange(c, id, before, after) {
    const hr = store.get("settings", "hr") || {}, min = hr.notifMin > 0 ? hr.notifMin : 500000;
    if ((c === "expenses" || c === "pusat") && !before && after && (after.jumlah || 0) >= min && !after.contoh && !after.tabungan)
      deliver(["owner"], `Pengeluaran di atas ${rp(min)}`, `${short(after.cabang || after.unit)} · ${after.tanggal}\n${after.kategori || "Petty cash"} · ${after.keterangan || "-"}\nJumlah: ${rp(after.jumlah)}`, "bigExpense");
    if (c === "permintaan" && after && !before) deliver(["head"], `Permintaan barang ${short(after.cabang)}`, (after.items || []).map(i => `• ${i.nama}: ${i.qty} ${i.satuan || ""}`).join("\n"), "permintaan");
    if (c === "refund" && after) { if (!before) deliver(["owner"], "Refund perlu konfirmasi owner", `${short(after.cabang)} · ${after.alasan}\nCustomer: ${after.customer || "-"}\nJumlah: ${rp(after.jumlah)}`, "refund");
      else if (before.status !== after.status && ["disetujui", "ditolak"].includes(after.status)) deliver(["head"], `Refund ${after.status} owner`, `${after.customer || "-"} · ${rp(after.jumlah)}\n${after.catatanOwner || ""}`, "refund"); }
    if (c === "closing" && after?.status === "closed" && before?.status !== "closed") deliver(["owner", "head"], `Tutup buku ${id} final`, "Laporan bisa dibuka di Accounting → Tutup Buku → Riwayat.", "closing");
  }
  const todayISO = () => R.todayIn(TZ), addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  function reminders() { const t = todayISO(), out = [];
    const late = store.list("permintaan").map(x => x.data).filter(p => !["diterima", "ditolak"].includes(p.status) && addDays(p.estimasi || String(p.at || p.tanggal || t).slice(0, 10), 3) < t);
    if (late.length) out.push([["owner"], `${late.length} permintaan barang terlambat > 3 hari`, late.map(p => `• ${short(p.cabang)}: ${(p.items || []).map(i => i.nama).join(", ")} · ${p.status}`).join("\n")]);
    const ref = store.list("refund").map(x => x.data).filter(r => r.status === "diajukan"); if (ref.length) out.push([["owner"], `${ref.length} refund menunggu konfirmasi owner`, ref.map(r => `• ${short(r.cabang)} · ${r.customer || "-"} · ${rp(r.jumlah)}`).join("\n")]);
    for (const [ro, s, x] of out) deliver(ro, s, x, "reminder"); return out.length; }

  /* ---------- AI lewat Claude (artifact) ---------- */
  let sampleP = null; const getSample = () => sampleP ||= (HOST?.use ? Promise.race([HOST.use("sample"), new Promise(r => setTimeout(() => r(null), 8000))]).catch(() => null) : Promise.resolve(null));
  let pdfP = null; const loadPdf = () => pdfP ||= new Promise((res, rej) => { if (window.pdfjsLib) return res(window.pdfjsLib); const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"; s.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; } catch {} res(window.pdfjsLib); }; s.onerror = () => { pdfP = null; rej(new Error("pdf")); }; document.head.appendChild(s); });
  const b64ToBlob = (b64, type) => { const bin = atob(b64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type }); };
  async function pdfToImages(b64, max) { const lib = await loadPdf(), bin = atob(b64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    const doc = await lib.getDocument({ data: a, isEvalSupported: false }).promise, out = [];
    for (let p = 1; p <= Math.min(doc.numPages, max); p++) { const pg = await doc.getPage(p), vp = pg.getViewport({ scale: 1.6 }), cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height;
      await pg.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise; out.push(await new Promise(r => cv.toBlob(r, "image/jpeg", 0.85))); }
    return out; }
  async function ai(b) {
    const sample = await getSample(); if (!sample) throw err("sampling_disabled", "AI tidak tersedia di tampilan ini.", { status: 503 });
    let messages = (b.messages || []).filter(m => m && m.content).map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content) }));
    if (!messages.length || messages[messages.length - 1].role !== "user") throw err("invalid_argument", "Pesan tidak valid.", { status: 400 });
    if (b.system) messages[0] = { ...messages[0], content: "[INSTRUKSI SISTEM — ikuti selalu]\n" + b.system + "\n\n[PESAN USER]\n" + messages[0].content };
    const lim = await sample.limits().catch(() => null), maxImg = lim?.images?.maxCount || 0;
    let images = (b.images || []).map(im => b64ToBlob(im.data, im.media_type));
    if ((b.documents || []).length) { if (!maxImg) throw err("images_unavailable", "Membaca PDF butuh izin kirim gambar ke Claude.");
      try { for (const d of b.documents) images.push(...await pdfToImages(d.data, Math.max(1, maxImg - images.length))); }
      catch { throw err("invalid_argument", "PDF belum bisa dibaca di mode demo. Coba foto / screenshot halamannya, atau file Excel."); } }
    if (images.length && !maxImg) throw err("images_unavailable", "Kirim gambar ke Claude belum diizinkan.");
    images = images.slice(0, maxImg || 0);
    try { const r = await sample(messages, { ...(images.length ? { images } : {}), cache: false }); return { text: r.text || "", truncated: !!r.truncated }; }
    catch (e) { throw err(e?.code === "rate_limited" ? "rate_limited" : e?.code === "not_granted" ? "sampling_disabled" : "unavailable", e?.message || "AI gagal menjawab.", { status: 502 }); }
  }

  /* ---------- API ---------- */
  function need(ctx, lvl) { if (!ctx.user || ctx.level < lvl) throw err("not_granted", "Tidak punya akses.", { status: 403 }); }
  async function call(pathname, body, opts = {}) {
    await ready; const tok = opts.token || "", ctx = context(tok, opts.device), p = String(pathname).replace(/^\/+/, "");
    if (p === "health") return { ok: true, version: VERSION };
    if (p === "me") return { user: ctx.user, level: ctx.level, bootstrap: ctx.bootstrap, ai: !!(await getSample()), aiMedia: ["image/jpeg", "image/png", "image/webp", "image/gif"], version: VERSION, demo: true };
    if (p === "login") return login(body || {});
    if (p === "logout") { delete D.sessions[tok]; persist(); return { ok: true }; }
    if (p === "db") return dbApi(ctx, body || {});
    if (p === "ai") { if (!ctx.user) throw err("not_granted", "Login dulu untuk memakai AI.", { status: 401 }); return ai(body || {}); }
    if (p === "email") { need(ctx, 1); const to = [].concat(body.to || []).filter(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)), cc = [].concat(body.cc || []).filter(x => /@/.test(x));
      if (!to.length) throw err("invalid_argument", "Isi alamat email penerima.", { status: 400 });
      outbox({ kanal: "Email", subject: body.subject, text: body.text, ke: [...to, ...cc.map(x => "cc " + x)].join(", "), lampiran: (body.attachments || []).map(a => a.filename + " (" + Math.round((a.data || "").length * 0.75 / 1024) + " KB)").join(", "), dari: ctx.user.nama });
      return { ok: true, to: to.length + cc.length, demo: true }; }
    if (p === "notify") { need(ctx, 1); return deliver([].concat(body.to || "owner"), String(body.subject || "Notifikasi"), String(body.text || ""), String(body.event || "manual")); }
    if (p === "announce") { need(ctx, 2); const doc = store.get("pengumuman", String(body.id || "")); if (!doc) throw err("invalid_argument", "Pengumuman tidak ditemukan.", { status: 404 });
      const ky = (store.get("settings", "karyawan")?.list || []).filter(x => x.aktif !== false), t = doc.target || {};
      const list = ky.filter(x => t.mode === "cabang" ? (t.cabang || []).includes(x.cabang || "Pusat") : t.mode === "pilih" ? (t.ids || []).includes(x.id) : true);
      let em = 0, tg = 0; const hasil = list.map(x => { const r = { id: x.id, nama: x.nama, email: "", telegram: "" }; if (doc.channels?.email && x.email) { r.email = "terkirim (demo)"; em++; } if (doc.channels?.telegram && x.tgChat) { r.telegram = "terkirim (demo)"; tg++; } return r; });
      outbox({ kanal: "Pengumuman", subject: doc.judul, text: doc.isi, ke: list.map(x => x.nama).join(", ") + ` · ${em} email, ${tg} Telegram` });
      store.update("pengumuman", String(body.id), { terkirimAt: new Date().toISOString(), terkirimBy: ctx.user.nama, hasil, ringkas: { email: em, telegram: tg, total: list.length } });
      return { ok: true, email: em, telegram: tg, total: list.length }; }
    if (p === "integrations") { need(ctx, 2);
      return { demo: true, email: { configured: true, from: "Kotak keluar demo" }, telegram: { configured: true, bot: "simulasi_demo", error: "" }, sheets: { configured: false, error: "Google Sheet tidak tersedia di mode demo (aktif di versi server)." },
        ai: { configured: !!(await getSample()), model: "Claude (lewat artifact)" }, backupHour: 2, reminderHour: 9, tz: TZ,
        log: D.outbox.slice(0, 20).map(o => ({ at: o.at, event: o.event || o.kanal, subject: o.subject, tg: /Telegram/.test(o.ke || "") ? 1 : 0, email: o.kanal === "Email" || /@/.test(o.ke || "") ? 1 : 0 })), backups: D.backups.map(b => b.file) }; }
    if (p === "integrations/test") { need(ctx, 2); const ch = body.channel;
      if (ch === "telegram" || ch === "email") { outbox({ kanal: ch === "email" ? "Email" : "Telegram", subject: ch === "email" ? "Tes email Lash Bounty ERP" : "Tes notifikasi", text: "Ini pesan percobaan dari Lash Bounty ERP (demo).", ke: String(body.to || "") }); return { ok: true }; }
      if (ch === "reminder") return { ok: true, count: reminders() };
      if (ch === "backup") { const file = "lbdb-" + todayISO() + ".json"; D.backups = [{ file, at: new Date().toISOString() }, ...D.backups.filter(x => x.file !== file)].slice(0, 10); persist(); return { ok: true, file }; }
      throw err("invalid_argument", "Channel tidak dikenal.", { status: 400 }); }
    if (p === "sheets/sync") throw err("not_configured", "Google Sheet tidak tersedia di mode demo. Aktif di versi server (lihat README bagian 6).", { status: 503 });
    throw err("not_found", "Endpoint tidak ada.", { status: 404 });
  }

  /* ---------- data awal demo ---------- */
  async function seed() {
    D = { ver: 1, cols: {}, sessions: {}, fails: {}, outbox: [], backups: [], seededAt: new Date().toISOString() };
    const c = (coll, id, data) => { col(coll)[id] = data; }, add = (coll, data) => c(coll, rid(20), data);
    const accounts = [["maxxchang", "Kevin", "owner", ""], ["reyzachang", "Reyza", "owner", ""], ["superadmin", "Yuli Lim", "head", ""], ["superadmin2", "Ning Surya", "head", ""],
      ["trainer01", "Ayyas Eugene", "trainer", ""], ["trainer02", "Hapni", "trainer", ""], ["tebet", "Staff Tebet", "staff", "Cabang Tebet"]];
    const at = new Date().toISOString();
    await Promise.all(accounts.map(async ([id, nama, role, cabang]) => { const salt = hex(crypto.getRandomValues(new Uint8Array(16))); c("users", id, { username: id, nama, role, cabang, aktif: true, salt, hash: await pwHash(DEMO_PW, salt), iter: 150000, pwAt: at, createdAt: at, createdBy: "Demo" }); }));
    const CABS = [["Cabang Gading Serpong", "Internal"], ["Cabang Pluit", "Internal"], ["Cabang Tebet", "Wendy"], ["Cabang Bekasi", "Wendy"]];
    c("settings", "main", { cabang: CABS.map(([nama, grup]) => ({ nama, grup })) });
    c("settings", "hr", { notifMin: 1500000, jamMasuk: "10:00", toleransi: 15, bhGrup: "Wendy", bhPct: 50, partnerNama: "Wendy Walters", wlPct: 30, wlKata: "walters", owners: ["Kevin", "Reyza"], prepBy: "Yuli Lim", apprBy: "Kevin", kota: "Tangerang", ownerWa: "" });
    c("settings", "stok", { items: [["Lem bulu mata", "botol"], ["Bulu mata classic", "box"], ["Bulu mata volume", "box"], ["Eyepad", "pasang"], ["Kapas", "pak"], ["Micro brush", "pak"], ["Remover", "botol"]].map(([nama, satuan]) => ({ nama, satuan })) });
    const KY = [["k1", "Dewi Lestari", "Therapist", "Cabang Tebet", "0812-1000-2001"], ["k2", "Sinta", "Therapist", "Cabang Tebet", "0812-1000-2002"], ["k3", "Maya", "Therapist", "Cabang Gading Serpong", "0812-1000-2003"],
      ["k4", "Rina", "Kasir", "Cabang Pluit", "0812-1000-2004"], ["k5", "Putri", "Therapist", "Cabang Bekasi", "0812-1000-2005"], ["k6", "Nunzia", "Admin", "Pusat", "0812-1000-2006"]];
    c("settings", "karyawan", { list: KY.map(([id, nama, jabatan, cabang, hp]) => ({ id, nama, jabatan, cabang, aktif: true, hp, email: nama.split(" ")[0].toLowerCase() + "@contoh.lashbounty.id", bank: "BCA", norek: "000-" + id.slice(1) + "00-1234", an: nama, alamat: "Alamat contoh", daruratNama: "Keluarga (contoh)", daruratHp: "0813-0000-000" + id.slice(1) })) });
    // periode berjalan (27 bulan lalu – 26) + bulan sebelumnya
    const today = todayISO(), d0 = +today.slice(8), Y = +today.slice(0, 4), M = +today.slice(5, 7);
    const per = d0 >= 27 ? (M === 12 ? `${Y + 1}-01` : `${Y}-${String(M + 1).padStart(2, "0")}`) : today.slice(0, 7);
    const prevK = k => { const [y, m] = k.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };
    const start = k => prevK(k) + "-27", end = k => k + "-26", days = (a, b) => { const o = []; for (let x = a; x <= b; x = addDays(x, 1)) o.push(x); return o; };
    const pk = prevK(per), rnd = (s => () => (s = (s * 9301 + 49297) % 233280) / 233280)(42), r = (a, b) => Math.round((a + rnd() * (b - a)) / 1000) * 1000;
    const MENU = { "Cabang Gading Serpong": [["Classic Natural", 350000], ["Volume Russian", 550000], ["Walters Lash Natural", 700000], ["Nail Gel", 180000]], "Cabang Pluit": [["Classic Natural", 350000], ["Walters Lash Natural", 700000], ["Lash Lift", 300000]],
      "Cabang Tebet": [["Classic Natural", 330000], ["Volume Russian", 520000], ["Nail Gel", 170000]], "Cabang Bekasi": [["Classic Natural", 300000], ["Hybrid", 420000], ["Lash Lift", 280000]] };
    for (const k of [pk, per]) for (const day of days(start(k), k === per ? (today < end(k) ? addDays(today, -1) : end(k)) : end(k))) for (const [cab] of CABS) {
      const items = MENU[cab].map(([item, price]) => { const qty = Math.floor(rnd() * (cab === "Cabang Gading Serpong" ? 6 : 4)); return { item, qty, gross: qty * price, disc: 0, refund: 0, net: qty * price, tax: 0, voucher: 0, rounding: 0, total: qty * price }; }).filter(i => i.qty);
      const total = items.reduce((a, i) => a + i.total, 0); if (!total) continue;
      c("sales", `z_${cab.replace(/^Cabang /, "").toLowerCase().replace(/\s+/g, "-")}_${day}`, { cabang: cab, tanggal: day, bulan: day.slice(0, 7), sumber: "Zenwel", file: "contoh", items, total, net: total, gross: total, disc: 0, refund: 0, qty: items.reduce((a, i) => a + i.qty, 0), by: "demo", at, contoh: true }); }
    for (const k of [pk, per]) { const s = start(k), mid = addDays(s, 12), late = addDays(s, 22) > today && k === per ? addDays(today, -1) : addDays(s, 22);
      for (const [cab] of CABS) {
        add("expenses", { cabang: cab, tanggal: addDays(s, 3), bulan: addDays(s, 3).slice(0, 7), jumlah: r(80000, 250000), keterangan: "Galon, gas & tisu", nota: "", pengisi: "Staff", by: "demo", at, contoh: true });
        add("expenses", { cabang: cab, tanggal: mid, bulan: mid.slice(0, 7), jumlah: r(150000, 450000), keterangan: "Lem bulu mata & kapas", nota: "N-" + Math.floor(rnd() * 900 + 100), pengisi: "Staff", by: "demo", at, contoh: true });
        for (const [kat, a, b2] of [["Listrik", 1800000, 2600000], ["IPL", 900000, 1200000], ["Internet & telepon", 450000, 450000], ["Stok bahan (HPP)", 2500000, 4500000], ["Biaya admin EDC & QR", 150000, 400000]])
          add("pusat", { unit: cab, kategori: kat, tanggal: late, bulan: late.slice(0, 7), jumlah: r(a, b2), keterangan: kat + " " + k, nota: "", dana: "Rekening pusat", pengisi: "Yuli Lim", by: "demo", at, contoh: true });
        if (/Tebet|Bekasi/.test(cab)) { add("pusat", { unit: cab, kategori: "Ads / iklan", tanggal: mid, bulan: mid.slice(0, 7), jumlah: 2000000, keterangan: "Meta ads", nota: "", dana: "Kartu kredit", pengisi: "Yuli Lim", by: "demo", at, contoh: true });
          add("pusat", { unit: cab, kategori: "Office + admin fee", tanggal: late, bulan: late.slice(0, 7), jumlah: 3500000, keterangan: "Office + Admin Fee", nota: "", dana: "", pengisi: "Yuli Lim", by: "demo", at, contoh: true }); }
      }
      add("pusat", { unit: "Pusat", kategori: "Marketing", tanggal: mid, bulan: mid.slice(0, 7), jumlah: 7500000, keterangan: "Ads IG", nota: "", dana: "", pengisi: "Yuli Lim", by: "demo", at, contoh: true });
      add("pusat", { unit: "Pusat", kategori: "IPL HO", tanggal: late, bulan: late.slice(0, 7), jumlah: 1250000, keterangan: "IPL kantor", nota: "", dana: "", pengisi: "Yuli Lim", by: "demo", at, contoh: true });
      c("payroll", k, { bulan: k, periode: k, status: k === pk ? "final" : "draft", tglBayar: k === pk ? end(k) : "", rows: KY.map(([id, nama, jabatan, cabang, hp]) => ({ id, nama, jabatan, cabang, hk: 26, hadir: 25, izin: 1, sakit: 0, alpha: 0, pokok: jabatan === "Admin" ? 5000000 : 3500000, tunjangan: 300000, bonus: 0, komisi: jabatan === "Therapist" ? r(500000, 1500000) : 0, potLain: 0, ketPot: "", wa: hp })), total: 0, by: "demo", at, contoh: true });
      for (const [cab] of CABS) { add("opname", { jenis: "jurnal", cabang: cab, tanggal: mid, bulan: mid.slice(0, 7), items: [["Lem bulu mata", "botol", 2, 1 + Math.floor(rnd() * 3)], ["Bulu mata classic", "box", 4, 2 + Math.floor(rnd() * 4)], ["Kapas", "pak", 5, 3 + Math.floor(rnd() * 3)], ["Eyepad", "pasang", 50, 20 + Math.floor(rnd() * 25)]].map(([nama, satuan, masuk, keluar]) => ({ nama, satuan, masuk, keluar })), catatan: "contoh", pengisi: "Staff", by: "demo", at, contoh: true }); }
    }
    c("closing", pk, { periode: pk, status: "closed", prefinalAt: at, prefinalBy: "Yuli Lim", gajiOwners: { Kevin: 7500000, Reyza: 7500000 }, gajiOwner: 15000000, closedAt: at, closedBy: "Yuli Lim", ket: "Data contoh", ringkasan: { contoh: true } });
    add("aset", { lokasi: "Cabang Tebet", kategori: "Peralatan treatment", nama: "Kursi lash bed", qty: 4, rusak: 1, nilai: 1500000, tglBeli: "2025-02-10", ket: "contoh", by: "demo", at, contoh: true });
    add("aset", { lokasi: "Cabang Gading Serpong", kategori: "Elektronik", nama: "Lampu ring", qty: 5, rusak: 0, nilai: 450000, tglBeli: "2025-06-01", ket: "contoh", by: "demo", at, contoh: true });
    add("permintaan", { cabang: "Cabang Tebet", tanggal: addDays(today, -6), items: [{ nama: "Lem bulu mata", satuan: "botol", qty: 3 }, { nama: "Eyepad", satuan: "pasang", qty: 50 }], catatan: "Stok lem tinggal 1", status: "dikirim", estimasi: addDays(today, -4), pengaju: "Staff Tebet", by: "tebet", at: addDays(today, -6) + "T03:00:00.000Z", riwayat: [] });
    add("permintaan", { cabang: "Cabang Bekasi", tanggal: today, items: [{ nama: "Remover", satuan: "botol", qty: 2 }], catatan: "", status: "menunggu", pengaju: "Putri", by: "", at, riwayat: [] });
    add("refund", { tanggal: addDays(today, -1), cabang: "Cabang Pluit", customer: "Bu Rani (contoh)", hp: "0812-0000-1111", alasan: "Transaksi dobel", keterangan: "QRIS terdebit 2x", jumlah: 350000, bank: "BCA", norek: "1234567890", an: "Rani", catatBiaya: false, status: "diajukan", pengaju: "Yuli Lim", at });
    add("kasbon", { empId: "k1", nama: "Dewi Lestari", cabang: "Cabang Tebet", tipe: "pinjam", tanggal: addDays(today, -15), jumlah: 1000000, dari: "Rekening pusat", cicil: 500000, ket: "contoh", pengisi: "Yuli Lim", at });
    c("bankcfg", "main", { tabungan: { cabang: { "Cabang Tebet": 10000000, "Cabang Bekasi": 10000000 }, rek: "Rekening pribadi Kevin" } });
    mem.write(D);
  }
  const ready = (async () => { D = mem.read(); if (!D || !D.cols) await seed(); D.outbox ||= []; D.backups ||= []; D.fails ||= {}; D.sessions ||= {}; })();

  window.LB_DEMO = { call, onChange: fn => { listeners.add(fn); return () => listeners.delete(fn); }, outbox: () => D?.outbox || [], async reset() { mem.clear(); await seed(); }, password: DEMO_PW, host: HOST, ready };
})();
