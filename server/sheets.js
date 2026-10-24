"use strict";
// Cermin otomatis ke Google Sheet (satu arah: aplikasi → Sheet) memakai Service Account Google.
// Setiap koleksi jadi satu tab. Data lama di tab diganti isi terbaru setiap sinkron.
const fs = require("fs");
const crypto = require("crypto");

const TABS = [
  ["expenses", "Petty cash"], ["pusat", "Biaya cabang & pusat"], ["sales", "Omzet"], ["bayar", "Metode bayar"], ["kas", "Setoran cash"],
  ["payroll", "Payroll"], ["kpi", "KPI"], ["absen", "Absensi"], ["opname", "Stok"], ["permintaan", "Permintaan barang"], ["aset", "Aset"],
  ["pemusnahan", "Pemusnahan aset"], ["kasbon", "Kasbon"], ["refund", "Refund"], ["tabungan", "Tabungan sewa"], ["closing", "Tutup buku"],
  ["custtx", "Transaksi customer"], ["cust", "Customer"], ["pengumuman", "Pengumuman"],
];
const SKIP = new Set(["hash", "salt", "iter", "ttd", "by"]);

function b64url(b) { return Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_"); }

// Ubah dokumen jadi baris datar. Array berisi objek (items, rows, tx, threads) dipecah jadi satu baris per elemen.
function flatten(c, list) {
  const rows = [];
  const flat = (o, pre = "", out = {}) => {
    for (const [k, v] of Object.entries(o || {})) {
      if (SKIP.has(k)) continue;
      const key = pre ? pre + "." + k : k;
      if (v && typeof v === "object" && !Array.isArray(v)) flat(v, key, out);
      else if (Array.isArray(v)) out[key] = v.every(x => x == null || typeof x !== "object") ? v.join(", ") : `${v.length} baris`;
      else out[key] = v;
    }
    return out;
  };
  for (const { id, data } of list) {
    if (c === "cust") { for (const [key, cu] of Object.entries(data.list || {})) rows.push({ id: key, ...flat(cu) }); continue; }
    const arrKey = ["items", "rows", "tx"].find(k => Array.isArray(data[k]) && data[k].length && typeof data[k][0] === "object");
    const base = flat(Object.fromEntries(Object.entries(data).filter(([k]) => k !== arrKey)));
    if (arrKey) data[arrKey].forEach((x, i) => rows.push({ id, ...base, baris: i + 1, ...flat(x, arrKey) }));
    else rows.push({ id, ...base });
  }
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
  return [cols, ...rows.map(r => cols.map(k => r[k] == null ? "" : typeof r[k] === "number" || typeof r[k] === "boolean" ? r[k] : String(r[k]).slice(0, 45000)))];
}

class Sheets {
  constructor(cfg, store) {
    this.cfg = cfg.sheets; this.store = store; this.token = null; this.tokenExp = 0; this.key = null;
    this.lastSync = null; this.lastError = ""; this.syncedVersion = -1; this.busy = false;
    try {
      const raw = this.cfg.keyJson || (this.cfg.keyFile && fs.existsSync(this.cfg.keyFile) ? fs.readFileSync(this.cfg.keyFile, "utf8") : "");
      if (raw) this.key = JSON.parse(raw);
    } catch (err) { this.lastError = "File kunci Google tidak valid: " + err.message; }
  }
  get enabled() { return !!(this.key && this.cfg.sheetId); }
  get email() { return this.key?.client_email || ""; }
  async accessToken() {
    if (this.token && Date.now() < this.tokenExp - 60000) return this.token;
    const now = Math.floor(Date.now() / 1000), tokenUri = this.key.token_uri || "https://oauth2.googleapis.com/token";
    const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claim = b64url(JSON.stringify({ iss: this.key.client_email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: tokenUri, iat: now, exp: now + 3600 }));
    const sig = b64url(crypto.createSign("RSA-SHA256").update(head + "." + claim).sign(this.key.private_key));
    const r = await fetch(tokenUri, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${sig}` }) });
    const j = await r.json().catch(() => ({}));
    if (!j.access_token) throw new Error("Login Google gagal: " + (j.error_description || j.error || r.status));
    this.token = j.access_token; this.tokenExp = Date.now() + (j.expires_in || 3600) * 1000; return this.token;
  }
  async gapi(method, path, body) {
    const base = (this.cfg.baseUrl || "https://sheets.googleapis.com").replace(/\/+$/, "");
    const r = await fetch(`${base}/v4/spreadsheets/${encodeURIComponent(this.cfg.sheetId)}${path}`, { method, headers: { authorization: "Bearer " + await this.accessToken(), "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error("Google Sheets: " + (j.error?.message || r.status) + (r.status === 403 || r.status === 404 ? ` (pastikan Sheet sudah di-share ke ${this.email} sebagai Editor)` : ""));
    return j;
  }
  async sync(force = false) {
    if (!this.enabled) throw Object.assign(new Error("Google Sheet belum diatur (GOOGLE_SHEET_ID & kunci service account)."), { code: "not_configured", status: 503 });
    if (this.busy) return { ok: true, skipped: "busy" };
    const v = this.store.version || 0; if (!force && v === this.syncedVersion) return { ok: true, skipped: "unchanged" };
    this.busy = true;
    try {
      const meta = await this.gapi("GET", "?fields=sheets.properties.title");
      const have = new Set((meta.sheets || []).map(s => s.properties.title));
      const need = [["Info"], ...TABS.map(([, t]) => [t])].map(x => x[0]).filter(t => !have.has(t));
      if (need.length) await this.gapi("POST", ":batchUpdate", { requests: need.map(title => ({ addSheet: { properties: { title } } })) });
      const data = [{ range: "'Info'!A1", values: [["Lash Bounty ERP · cermin otomatis"], ["Terakhir sinkron", new Date().toISOString()], ["Jangan edit di Sheet ini — perubahan akan tertimpa. Input lewat aplikasi."]] }];
      for (const [c, title] of TABS) data.push({ range: `'${title}'!A1`, values: flatten(c, this.store.list(c)) });
      await this.gapi("POST", "/values:batchClear", { ranges: TABS.map(([, t]) => `'${t}'`) });
      await this.gapi("POST", "/values:batchUpdate", { valueInputOption: "RAW", data });
      this.syncedVersion = v; this.lastSync = new Date().toISOString(); this.lastError = "";
      return { ok: true, tabs: TABS.length, at: this.lastSync };
    } catch (err) { this.lastError = err.message; throw Object.assign(err, { code: err.code || "sheets_error", status: 502 }); }
    finally { this.busy = false; }
  }
}
module.exports = { Sheets, flatten, TABS };
