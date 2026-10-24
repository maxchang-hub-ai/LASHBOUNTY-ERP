"use strict";
// Penyimpanan dokumen berbasis file JSON (satu file per koleksi) dengan tulis atomik dan backup harian.
const fs = require("fs");
const path = require("path");

const COLL_RX = /^[A-Za-z0-9_-]{1,60}$/;
const ID_RX = /^(?!\.\.?$)[A-Za-z0-9_\-.~:@+]{1,200}$/;
const MAX_DOC_BYTES = 2 * 1024 * 1024;

const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

class Store {
  constructor(dataDir, opts = {}) {
    this.dir = path.join(dataDir, "db");
    this.backupDir = path.join(dataDir, "backups");
    this.backupKeep = opts.backupKeep || 30;
    fs.mkdirSync(this.dir, { recursive: true });
    fs.mkdirSync(this.backupDir, { recursive: true });
    this.cols = new Map();
    this.dirty = new Set();
    this.timer = null;
    this.listeners = new Set();
    this._load();
  }

  _load() {
    for (const f of fs.readdirSync(this.dir)) {
      if (!f.endsWith(".json")) continue;
      const c = f.slice(0, -5);
      if (!COLL_RX.test(c)) continue;
      try {
        const obj = JSON.parse(fs.readFileSync(path.join(this.dir, f), "utf8"));
        this.cols.set(c, new Map(Object.entries(obj)));
      } catch (err) {
        // File rusak: simpan salinan, jangan ditimpa diam-diam.
        const bad = path.join(this.dir, f + ".corrupt-" + Date.now());
        fs.copyFileSync(path.join(this.dir, f), bad);
        console.error(`[store] ${f} tidak bisa dibaca, disalin ke ${path.basename(bad)}:`, err.message);
        this.cols.set(c, new Map());
      }
    }
  }

  static validColl(c) { return COLL_RX.test(String(c || "")); }
  static validId(id) { return ID_RX.test(String(id || "")); }

  _col(c) { if (!this.cols.has(c)) this.cols.set(c, new Map()); return this.cols.get(c); }
  has(c, id) { return this._col(c).has(id); }
  get(c, id) { return clone(this._col(c).get(id)) ?? null; }
  count(c) { return this.cols.has(c) ? this.cols.get(c).size : 0; }
  list(c) { return [...this._col(c).entries()].map(([id, d]) => ({ id, data: clone(d) })); }
  collections() { return [...this.cols.keys()]; }

  _check(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw Object.assign(new Error("Data harus berupa objek."), { code: "invalid_argument" });
    if (Buffer.byteLength(JSON.stringify(data)) > MAX_DOC_BYTES) throw Object.assign(new Error("Dokumen terlalu besar."), { code: "invalid_argument" });
  }
  set(c, id, data) { this._check(data); const before = this._col(c).get(id) || null; this._col(c).set(id, clone(data)); this._changed(c, id, before, data); }
  update(c, id, patch) {
    this._check(patch);
    const cur = this._col(c).get(id);
    if (!cur) throw Object.assign(new Error("Dokumen tidak ditemukan."), { code: "invalid_argument" });
    const next = { ...cur, ...clone(patch) };
    for (const [k, v] of Object.entries(next)) if (v && typeof v === "object" && v.__delete__ === true) delete next[k];
    this._check(next);
    this._col(c).set(id, next); this._changed(c, id, cur, next);
  }
  delete(c, id) { const before = this._col(c).get(id) || null; if (this._col(c).delete(id)) this._changed(c, id, before, null); }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _changed(c, id, before, after) {
    this.dirty.add(c); this.version = (this.version || 0) + 1;
    clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 250);
    for (const fn of this.listeners) { try { fn(c, id, before ? clone(before) : null, after ? clone(after) : null); } catch (err) { console.error("[store] listener:", err.message); } }
  }

  flush() {
    clearTimeout(this.timer); this.timer = null;
    for (const c of this.dirty) {
      const file = path.join(this.dir, c + ".json"), tmp = file + ".tmp";
      const obj = Object.fromEntries(this._col(c));
      fs.writeFileSync(tmp, JSON.stringify(obj));
      fs.renameSync(tmp, file);
    }
    this.dirty.clear();
  }

  snapshot() { const out = {}; for (const [c, m] of this.cols) out[c] = Object.fromEntries(m); return out; }

  // Backup harian: data/backups/lbdb-YYYY-MM-DD.json, simpan N hari terakhir.
  dailyBackup(today, force = false) {
    const file = path.join(this.backupDir, `lbdb-${today}.json`);
    if (fs.existsSync(file) && !force) return null;
    this.flush();
    fs.writeFileSync(file + ".tmp", JSON.stringify({ at: new Date().toISOString(), collections: this.snapshot() }));
    fs.renameSync(file + ".tmp", file);
    const all = fs.readdirSync(this.backupDir).filter(f => /^lbdb-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    for (const f of all.slice(0, Math.max(0, all.length - this.backupKeep))) fs.unlinkSync(path.join(this.backupDir, f));
    return file;
  }

  restore(snapshot) {
    this.cols = new Map();
    for (const f of fs.readdirSync(this.dir)) if (f.endsWith(".json")) fs.unlinkSync(path.join(this.dir, f));
    for (const [c, docs] of Object.entries(snapshot || {})) { if (!COLL_RX.test(c)) continue; this.cols.set(c, new Map(Object.entries(docs))); this.dirty.add(c); }
    this.flush();
  }
}

module.exports = { Store, clone };
