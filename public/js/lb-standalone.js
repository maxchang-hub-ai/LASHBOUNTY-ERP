/* Lash Bounty ERP — penghubung browser ke server mandiri.
   Menyediakan window.claude.use("db" | "user" | "sample" | "downloads") dengan bentuk yang sama
   seperti versi claude.ai, ditambah window.LB_STANDALONE untuk login/logout. */
(function () {
  "use strict";
  const API = new URL("api/", document.baseURI).href;
  const LS = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} }, del(k) { try { localStorage.removeItem(k); } catch {} } };
  const SS = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch {} }, del(k) { try { sessionStorage.removeItem(k); } catch {} } };
  const rid = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => (b % 36).toString(36)).join("");

  let deviceId = LS.get("lb-device"); if (!/^[a-z0-9]{16,48}$/.test(deviceId || "")) { deviceId = rid(24); LS.set("lb-device", deviceId); }
  let token = SS.get("lb-token") || LS.get("lb-token") || "";
  const setToken = (t, remember) => { token = t || ""; SS.del("lb-token"); LS.del("lb-token"); if (token) (remember ? LS : SS).set("lb-token", token); };

  function err(code, message, extra) { return Object.assign(new Error(message || code), { code }, extra || {}); }
  async function call(pathname, body, opts = {}) {
    let res;
    try {
      res = await fetch(API + pathname, { method: body === undefined ? "GET" : "POST", signal: opts.signal, cache: "no-store",
        headers: { "Content-Type": "application/json", "X-LB-Device": deviceId, ...(token ? { Authorization: "Bearer " + token } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) { if (e?.name === "AbortError") throw err("cancelled", "Dibatalkan"); throw err("unavailable", "Server tidak bisa dihubungi."); }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw err(j.code || "unavailable", j.message || "HTTP " + res.status, { status: res.status, wait: j.wait });
    return j;
  }

  const SA = window.LB_STANDALONE = {
    version: "", user: null, level: 0, bootstrap: false, ai: false, aiMedia: [], offline: false, deviceId,
    appUrl: new URL(".", document.baseURI).href.replace(/\/$/, "/"),
    async login(username, password, remember) { const r = await call("login", { username, password, remember: !!remember }); setToken(r.token, r.remember); SA.user = r.user; return r; },
    async logout() { try { await call("logout", {}); } catch {} setToken(""); SA.user = null; },
    // panggil API server lain (email, notifikasi, integrasi). body undefined = GET.
    api(pathname, body, opts) { return call(pathname, body, opts); },
  };
  const ready = call("me").then(me => {
    Object.assign(SA, { user: me.user, level: me.level, bootstrap: me.bootstrap, ai: me.ai, aiMedia: me.aiMedia || [], version: me.version });
    if (!me.user && token) setToken("");
  }).catch(() => { SA.offline = true; });

  // Sesi kedaluwarsa / password diganti / akun dinonaktifkan → muat ulang ke halaman login.
  setInterval(async () => { if (!SA.user) return; try { const me = await call("me"); if (!me.user) location.reload(); } catch {} }, 5 * 60 * 1000);

  /* ---------------- db ---------------- */
  const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const subs = new Set();
  let es = null, esFails = 0;
  function connectStream() {
    if (es || typeof EventSource === "undefined") return;
    es = new EventSource(API + "stream");
    es.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } for (const s of subs) if (s.c === m.c) s.kick(); };
    es.onopen = () => { if (esFails) for (const s of subs) s.kick(); esFails = 0; };
    es.onerror = () => { esFails++; };
  }
  function docSnap(id, exists, data) { return { id, exists: !!exists, data: () => clone(data) ?? undefined, get: f => (data ? data[f] : undefined) }; }
  function querySnap(docs) { const ds = docs.map(d => docSnap(d.id, true, d.data)); return { docs: ds, size: ds.length, empty: !ds.length, forEach: fn => ds.forEach(fn), docChanges: () => [] }; }
  function makeSub(c, fetcher, next, error) {
    let alive = true, busy = false, again = false, t = null;
    const run = async () => {
      if (!alive) return; if (busy) { again = true; return; } busy = true;
      try { const snap = await fetcher(); if (alive) next(snap); }
      catch (e) { if (alive && error) { try { error(e); } catch {} } }
      finally { busy = false; if (again && alive) { again = false; run(); } }
    };
    const s = { c, kick() { clearTimeout(t); t = setTimeout(run, 120); } };
    subs.add(s); connectStream(); setTimeout(run, 0);
    return () => { alive = false; clearTimeout(t); subs.delete(s); };
  }
  function splitPath(p) { const parts = String(p || "").split("/").filter(Boolean); return parts; }
  function docRef(c, id) {
    const path = c + "/" + id;
    return {
      id, path,
      async get() { const r = await call("db", { op: "get", c, id }); return docSnap(id, r.exists, r.data); },
      async set(data) { await call("db", { op: "set", c, id, data: clone(data) }); },
      async update(data) { await call("db", { op: "update", c, id, data: clone(data) }); },
      async delete() { await call("db", { op: "delete", c, id }); },
      onSnapshot(next, error) { return makeSub(c, async () => { const r = await call("db", { op: "get", c, id }); return docSnap(id, r.exists, r.data); }, next, error); },
      collection() { throw err("invalid_argument", "Subkoleksi tidak didukung."); },
    };
  }
  function query(c, where, orderBy, limit) {
    const q = {
      path: c,
      where(f, op, v) { return query(c, [...where, [f, op, v]], orderBy, limit); },
      orderBy(f, dir) { return query(c, where, { field: f, dir: dir || "asc" }, limit); },
      limit(n) { return query(c, where, orderBy, n); },
      async get() { const r = await call("db", { op: "query", c, where, orderBy, limit }); return querySnap(r.docs || []); },
      onSnapshot(next, error) { return makeSub(c, async () => { const r = await call("db", { op: "query", c, where, orderBy, limit }); return querySnap(r.docs || []); }, next, error); },
    };
    return q;
  }
  const db = {
    collection(p) {
      const parts = splitPath(p); if (parts.length !== 1) throw err("invalid_argument", "Path koleksi tidak valid: " + p);
      const c = parts[0];
      return Object.assign(query(c, [], null, null), {
        doc(id) { return docRef(c, id == null ? rid(20) : String(id)); },
        async add(data) { const r = await call("db", { op: "add", c, data: clone(data) }); return docRef(c, r.id); },
      });
    },
    doc(p) { const parts = splitPath(p); if (parts.length !== 2) throw err("invalid_argument", "Path dokumen tidak valid: " + p); return docRef(parts[0], parts[1]); },
  };

  /* ---------------- user ---------------- */
  const user = {
    async id() { return SA.user ? SA.user.id : deviceId; },
    async canEdit() { return SA.level >= 2 || (SA.bootstrap && !SA.user); },
    async isOwner() { return SA.user ? SA.user.role === "owner" : SA.bootstrap; },
    async me() { return { id: SA.user ? SA.user.id : deviceId, name: SA.user?.nama || "", avatarUrl: "", isOwner: SA.user?.role === "owner" }; },
    async profiles(ids) { return Object.fromEntries((ids || []).map(i => [i, { id: i, name: SA.user && i === SA.user.id ? SA.user.nama : "" }])); },
    async search() { return []; },
    can(name) { return name === "data.write" ? SA.level >= 1 : null; },
  };

  /* ---------------- sample (AI lewat server) ---------------- */
  const blobB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const u = String(r.result); res(u.slice(u.indexOf(",") + 1)); }; r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  SA.blobB64 = blobB64;
  async function toImage(blob) {
    // Perkecil gambar besar supaya cepat & di bawah batas API.
    const bmp = await createImageBitmap(blob).catch(() => null);
    if (!bmp) throw err("invalid_argument", "Gambar tidak bisa dibaca.");
    const max = 1800, sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc);
    const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(bmp, 0, 0, cv.width, cv.height);
    const url = cv.toDataURL("image/jpeg", 0.86); return { media_type: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
  }
  async function runSample(input, opts = {}) {
    const messages = typeof input === "string" ? [{ role: "user", content: input }] : (Array.isArray(input) ? input : []).map(m => ({ role: m.role, content: String(m.content ?? "") }));
    const images = opts.images?.length ? await Promise.all(opts.images.map(toImage)) : [];
    const documents = opts.documents?.length ? await Promise.all(opts.documents.map(async f => ({ media_type: "application/pdf", name: f.name || "dokumen.pdf", data: await blobB64(f) }))) : [];
    const r = await call("ai", { messages, images, documents, attachAt: opts.attachAt, system: opts.system, maxTokens: opts.maxTokens }, { signal: opts.signal });
    if (typeof opts.onText === "function") { try { opts.onText({ text: r.text, delta: r.text }); } catch {} }
    return { text: r.text, truncated: !!r.truncated };
  }
  function parseJsonLoose(text) {
    const s = String(text || "").replace(/```(?:json)?/gi, "").trim();
    try { return JSON.parse(s); } catch {}
    const a = s.search(/[\[{]/); if (a < 0) throw err("invalid_json", "Jawaban AI bukan JSON.", { text });
    const open = s[a], close = open === "{" ? "}" : "]", b = s.lastIndexOf(close);
    try { return JSON.parse(s.slice(a, b + 1)); } catch { throw err("invalid_json", "Jawaban AI bukan JSON.", { text }); }
  }
  const sample = Object.assign((input, opts) => runSample(input, opts), {
    async json(input, opts = {}) {
      const add = "\n\nBalas HANYA dengan JSON valid, tanpa penjelasan dan tanpa ```.";
      const inp = typeof input === "string" ? input + add : (input || []).map((m, i, arr) => i === arr.length - 1 ? { ...m, content: String(m.content) + add } : m);
      const r = await runSample(inp, opts); return parseJsonLoose(r.text);
    },
    async limits() { return SA.ai ? { images: { mediaTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"], maxCount: 5 } } : {}; },
  });

  /* ---------------- downloads ---------------- */
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: /\.csv$/i.test(filename) ? "text/csv;charset=utf-8" : "application/octet-stream" });
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = String(filename || "download"); a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000); return {};
    },
  };

  window.claude = {
    async use(name) {
      await ready; if (SA.offline) return null;
      if (name === "db") return db;
      if (name === "user") return user;
      if (name === "sample") return SA.ai && SA.user ? sample : null;
      if (name === "downloads") return downloads;
      return null;
    },
  };
})();
