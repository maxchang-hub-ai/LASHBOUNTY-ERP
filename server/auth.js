"use strict";
// Login username & password, sesi berbasis token, dan pembatasan percobaan login.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROLE_LEVEL = { owner: 3, head: 2, admin: 2, hrd: 2, manager: 1, trainer: 1, staff: 1 };
const HIDDEN_USER_FIELDS = ["hash", "salt", "iter"];

// Sama persis dengan pwHash di aplikasi: PBKDF2-SHA256, salt sebagai teks UTF-8, 32 byte, hex.
function pwHash(password, salt, iter = 150000) {
  return crypto.pbkdf2Sync(Buffer.from(String(password), "utf8"), Buffer.from(String(salt), "utf8"), iter, 32, "sha256").toString("hex");
}
function safeEqualHex(a, b) {
  const x = Buffer.from(String(a || ""), "utf8"), y = Buffer.from(String(b || ""), "utf8");
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function publicUser(id, u) {
  if (!u) return null;
  const out = { id, ...u };
  for (const k of HIDDEN_USER_FIELDS) delete out[k];
  return out;
}
const hashTag = u => String(u?.hash || "").slice(0, 16);

class Auth {
  constructor(store, config) {
    this.store = store; this.config = config;
    this.file = path.join(config.dataDir, "sessions.json");
    this.sessions = new Map();
    this.fails = new Map();
    try { for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(this.file, "utf8")))) this.sessions.set(k, v); } catch {}
    this.saveT = null;
    this._purge();
    setInterval(() => this._purge(), 60 * 60 * 1000).unref();
  }
  _save() { clearTimeout(this.saveT); this.saveT = setTimeout(() => this.flush(), 200); }
  flush() { clearTimeout(this.saveT); const tmp = this.file + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.sessions))); fs.renameSync(tmp, this.file); }
  _purge() { const now = Date.now(); let n = 0; for (const [k, s] of this.sessions) if (s.exp < now) { this.sessions.delete(k); n++; } if (n) this._save(); }

  bootstrap() { return this.store.count("users") === 0; }

  // Konteks permintaan: siapa user-nya, level akses, dan id "self".
  context(token, deviceId) {
    let user = null, sess = null;
    if (token && this.sessions.has(token)) {
      sess = this.sessions.get(token);
      const u = this.store.get("users", sess.u);
      if (!u || u.aktif === false || hashTag(u) !== sess.h || sess.exp < Date.now()) { this.sessions.delete(token); this._save(); sess = null; }
      else user = publicUser(sess.u, u);
    }
    const role = user?.role || "";
    const level = user ? (ROLE_LEVEL[role] || 0) : 0;
    const dev = /^[a-z0-9]{16,48}$/.test(String(deviceId || "")) ? String(deviceId) : "";
    return { user, role, level, token: sess ? token : "", self: user ? user.id : dev, deviceId: dev, bootstrap: this.bootstrap() };
  }

  login(username, password, remember, ip) {
    const un = String(username || "").replace(/\s+/g, "").toLowerCase();
    const key = ip + "|" + un, f = this.fails.get(key);
    if (f && f.until > Date.now()) return { error: "locked", wait: Math.ceil((f.until - Date.now()) / 1000) };
    const u = Store_get(this.store, un);
    let ok = false;
    if (u && u.hash && u.salt) { try { ok = safeEqualHex(pwHash(password, u.salt, u.iter || 150000), u.hash); } catch { ok = false; } }
    if (!ok) {
      const n = (f?.n || 0) + 1, lock = n >= 5;
      this.fails.set(key, { n: lock ? 0 : n, until: lock ? Date.now() + 60000 : 0 });
      if (this.fails.size > 5000) this.fails.clear();
      return { error: lock ? "locked" : "bad_login", wait: lock ? 60 : 0 };
    }
    if (u.aktif === false) return { error: "inactive" };
    this.fails.delete(key);
    const token = crypto.randomBytes(32).toString("hex");
    const ttl = remember ? this.config.rememberDays * 864e5 : this.config.sessionHours * 36e5;
    this.sessions.set(token, { u: un, h: hashTag(u), exp: Date.now() + ttl, at: new Date().toISOString(), ip });
    this._save();
    return { token, user: publicUser(un, u), remember: !!remember };
  }
  logout(token) { if (this.sessions.delete(token)) this._save(); }
  // Dipanggil setelah dokumen users berubah: sesi user yang password-nya diganti / dinonaktifkan otomatis batal.
  revalidate(userId) {
    const u = this.store.get("users", userId); let n = 0;
    for (const [k, s] of this.sessions) if (s.u === userId && (!u || u.aktif === false || hashTag(u) !== s.h)) { this.sessions.delete(k); n++; }
    if (n) this._save();
  }
}
function Store_get(store, id) { return id ? store.get("users", id) : null; }

module.exports = { Auth, pwHash, publicUser, ROLE_LEVEL, HIDDEN_USER_FIELDS };
