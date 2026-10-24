"use strict";
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
