"use strict";
// Tes otomatis server (jalankan: npm test). Tanpa dependensi luar, memakai node:test.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { createServer } = require("../server/index.js");
const baseConfig = require("../server/config.js");
const { pwHash } = require("../server/auth.js");
const { todayIn } = require("../server/rules.js");

let app, base, dir;
const cfg = () => ({ ...baseConfig, dataDir: dir, ai: { ...baseConfig.ai, apiKey: "" } });
async function start() { app = createServer(cfg()); await new Promise(r => app.server.listen(0, "127.0.0.1", r)); base = `http://127.0.0.1:${app.server.address().port}/`; }
async function stop() { await app.close(); }
async function req(p, body, token, dev = "testdevice00000000000001") {
  const r = await fetch(base + p, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", "X-LB-Device": dev, ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const db = (body, token, dev) => req("api/db", body, token, dev);
function userDoc(username, role, pw, extra = {}) { const salt = crypto.randomBytes(16).toString("hex"); return { username, nama: username, role, cabang: "", aktif: true, salt, hash: pwHash(pw, salt), iter: 150000, createdAt: new Date().toISOString(), ...extra }; }
const login = async (u, p) => (await req("api/login", { username: u, password: p })).body.token;

test.before(async () => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "lbtest-")); await start(); });
test.after(async () => { await stop(); fs.rmSync(dir, { recursive: true, force: true }); });

test("health & file statis", async () => {
  assert.equal((await req("api/health")).body.ok, true);
  const r = await fetch(base); assert.equal(r.status, 200); assert.match(await r.text(), /Lash Bounty ERP/);
  for (const f of ["js/app.js", "js/lb-standalone.js", "css/app.css", "css/fonts.css", "vendor/jspdf-2.5.1.umd.min.js", "vendor/html2canvas-1.4.1.min.js", "vendor/xlsx-0.18.5.full.min.js", "fonts/plus-jakarta-sans-latin-700-normal.woff2"])
    assert.equal((await fetch(base + f)).status, 200, f);
  assert.equal((await fetch(base + "../server/config.js")).status, 404);
});

test("akun pertama: hanya Owner, lalu login", async () => {
  assert.equal((await req("api/me")).body.bootstrap, true);
  assert.equal((await db({ op: "set", c: "users", id: "x", data: userDoc("x", "staff", "abc12345") })).status, 403, "akun pertama bukan owner ditolak");
  assert.equal((await db({ op: "set", c: "users", id: "kevin", data: userDoc("kevin", "owner", "rahasia123") })).body.ok, true);
  assert.equal((await req("api/me")).body.bootstrap, false);
  assert.equal((await db({ op: "set", c: "users", id: "evil", data: userDoc("evil", "owner", "rahasia123") })).status, 403, "setelah ada akun, tamu tidak bisa buat akun");
  const bad = await req("api/login", { username: "kevin", password: "salah" }); assert.equal(bad.status, 401);
  const t = await login("kevin", "rahasia123"); assert.ok(t);
  const me = await req("api/me", undefined, t); assert.equal(me.body.user.role, "owner"); assert.equal(me.body.user.hash, undefined);
});

test("password tidak pernah keluar dari server", async () => {
  const t = await login("kevin", "rahasia123");
  const u = await db({ op: "get", c: "users", id: "kevin" }, t); assert.equal(u.body.data.hash, undefined); assert.equal(u.body.data.salt, undefined);
  const q = await db({ op: "query", c: "users" }, t); assert.ok(q.body.docs.every(d => d.data.hash === undefined));
});

test("hak akses per role", async () => {
  const ko = await login("kevin", "rahasia123");
  for (const [u, r] of [["yuli", "head"], ["ani", "admin"], ["rina", "staff"]]) assert.equal((await db({ op: "set", c: "users", id: u, data: userDoc(u, r, u + "2026ok") }, ko)).body.ok, true);
  const yuli = await login("yuli", "yuli2026ok"), ani = await login("ani", "ani2026ok"), rina = await login("rina", "rina2026ok");
  await db({ op: "set", c: "payroll", id: "2026-10", data: { rows: [{ nama: "A", pokok: 1 }] } }, ko);
  await db({ op: "set", c: "mutasi", id: "qr_2026-10-02", data: { rek: "qr", tanggal: "2026-10-02", bulan: "2026-10", tx: [] } }, ko);
  assert.equal((await db({ op: "query", c: "payroll" }, rina)).body.docs.length, 0, "staff tidak baca payroll");
  assert.equal((await db({ op: "query", c: "payroll" }, ani)).body.docs.length, 1, "admin baca payroll");
  assert.equal((await db({ op: "query", c: "mutasi" }, ani)).body.docs.length, 0, "admin keuangan tidak baca mutasi");
  assert.equal((await db({ op: "query", c: "mutasi" }, yuli)).body.docs.length, 1, "head of admin baca mutasi");
  assert.equal((await db({ op: "set", c: "mutasi", id: "x_2026-10-02", data: { a: 1 } }, ani)).status, 403);
  assert.equal((await db({ op: "add", c: "expenses", data: { cabang: "Cabang Tebet", jumlah: 1000 } }, rina)).body.ok, true, "staff input petty cash");
  assert.equal((await db({ op: "set", c: "settings", id: "main", data: { cabang: [] } }, rina)).status, 403, "staff tidak ubah pengaturan");
  assert.equal((await db({ op: "set", c: "users", id: "zz", data: userDoc("zz", "staff", "zz2026okk") }, ani)).status, 403, "admin keuangan tidak buat akun");
  assert.equal((await db({ op: "set", c: "users", id: "boss2", data: userDoc("boss2", "owner", "boss2026ok") }, yuli)).status, 403, "head tidak buat akun owner");
  assert.equal((await db({ op: "query", c: "expenses" })).body.docs.length, 0, "tamu tidak baca pengeluaran");
  assert.equal((await db({ op: "update", c: "users", id: "kevin", data: { role: "staff" } }, yuli)).status, 403, "head tidak ubah akun owner");
});

test("Ask Boss: karyawan hanya akses miliknya", async () => {
  const rina = await login("rina", "rina2026ok"), ko = await login("kevin", "rahasia123");
  assert.equal((await db({ op: "set", c: "askboss", id: "rina", data: { threads: [{ id: "t1", pesan: "halo" }] } }, rina)).body.ok, true);
  assert.equal((await db({ op: "set", c: "askboss", id: "yuli", data: { threads: [] } }, rina)).status, 403);
  assert.equal((await db({ op: "get", c: "askboss", id: "rina" }, rina)).body.exists, true);
  assert.equal((await db({ op: "query", c: "askboss" }, ko)).body.docs.length, 1, "owner lihat semua");
});

test("check-in absensi tanpa login dibatasi", async () => {
  const ko = await login("kevin", "rahasia123");
  await db({ op: "set", c: "settings", id: "karyawan", data: { list: [{ id: "e1", nama: "Hapni", cabang: "Cabang Tebet", aktif: true }, { id: "e2", nama: "Off", aktif: false }] } }, ko);
  const t = todayIn(baseConfig.timezone), anon = (b) => db(b, undefined, "kioskdevice000000000001");
  assert.equal((await anon({ op: "set", c: "absen", id: t + "_e1", data: { tanggal: t, empId: "e1", masuk: "10:00" } })).body.ok, true);
  assert.equal((await anon({ op: "update", c: "absen", id: t + "_e1", data: { pulang: "19:00" } })).body.ok, true);
  assert.equal((await anon({ op: "update", c: "absen", id: t + "_e1", data: { status: "H", nama: "ganti" } })).status, 403, "field lain ditolak");
  assert.equal((await anon({ op: "set", c: "absen", id: "2026-01-01_e1", data: { tanggal: "2026-01-01", empId: "e1" } })).status, 403, "tanggal lampau ditolak");
  assert.equal((await anon({ op: "set", c: "absen", id: t + "_e2", data: { tanggal: t, empId: "e2" } })).status, 403, "karyawan nonaktif ditolak");
  assert.equal((await anon({ op: "delete", c: "absen", id: t + "_e1" })).status, 403);
  assert.equal((await anon({ op: "get", c: "settings", id: "karyawan" })).body.exists, true, "daftar karyawan terbaca untuk check-in");
});

test("lupa password: permintaan → disetujui → sesi lama batal", async () => {
  const old = await login("rina", "rina2026ok"), salt = "s" + Date.now(), hash = pwHash("baru2026ok", salt), dev = "forgotdevice00000000001";
  assert.equal((await db({ op: "set", c: "pwreq", id: dev, data: { username: "rina", salt, hash, iter: 150000, status: "pending" } }, undefined, dev)).body.ok, true);
  assert.equal((await db({ op: "set", c: "pwreq", id: dev, data: { username: "tidakada", salt, hash, status: "pending" } }, undefined, dev)).status, 403);
  assert.equal((await db({ op: "set", c: "pwreq", id: "devicelainnya0000000001", data: { username: "rina", salt, hash, status: "pending" } }, undefined, dev)).status, 403, "hanya dokumen perangkat sendiri");
  const ko = await login("kevin", "rahasia123");
  assert.equal((await db({ op: "update", c: "users", id: "rina", data: { salt, hash, iter: 150000 } }, ko)).body.ok, true);
  assert.equal((await req("api/me", undefined, old)).body.user, null, "sesi lama otomatis keluar");
  assert.ok(await login("rina", "baru2026ok"));
});

test("akun nonaktif tidak bisa login", async () => {
  const ko = await login("kevin", "rahasia123");
  await db({ op: "update", c: "users", id: "ani", data: { aktif: false } }, ko);
  const r = await req("api/login", { username: "ani", password: "ani2026ok" }); assert.equal(r.status, 401); assert.equal(r.body.code, "inactive");
});

test("batas percobaan login", async () => {
  let last; for (let i = 0; i < 5; i++) last = await req("api/login", { username: "yuli", password: "salah" + i });
  assert.equal(last.status, 429); assert.equal((await req("api/login", { username: "yuli", password: "yuli2026ok" })).status, 429);
});

test("query: filter, urutan, limit, update & hapus", async () => {
  const ko = await login("kevin", "rahasia123");
  for (const [i, b] of ["2026-09", "2026-10", "2026-10"].entries()) await db({ op: "set", c: "sales", id: "s" + i, data: { bulan: b, total: (i + 1) * 100 } }, ko);
  const q = await db({ op: "query", c: "sales", where: [["bulan", "in", ["2026-10"]]], orderBy: { field: "total", dir: "desc" }, limit: 1 }, ko);
  assert.deepEqual(q.body.docs.map(d => d.id), ["s2"]);
  assert.equal((await db({ op: "update", c: "sales", id: "tidakada", data: { a: 1 } }, ko)).status, 403);
  await db({ op: "update", c: "sales", id: "s1", data: { total: 999 } }, ko); assert.equal((await db({ op: "get", c: "sales", id: "s1" }, ko)).body.data.total, 999);
  await db({ op: "delete", c: "sales", id: "s0" }, ko); assert.equal((await db({ op: "get", c: "sales", id: "s0" }, ko)).body.exists, false);
  assert.equal((await db({ op: "get", c: "../x", id: "a" }, ko)).status, 400);
});

test("realtime: notifikasi perubahan lewat stream", async () => {
  const ko = await login("kevin", "rahasia123");
  const ctrl = new AbortController(), r = await fetch(base + "api/stream", { signal: ctrl.signal }), rd = r.body.getReader();
  const got = (async () => { let s = ""; while (!s.includes('"c":"expenses"')) { const { value, done } = await rd.read(); if (done) break; s += Buffer.from(value).toString(); } return s; })();
  await db({ op: "add", c: "expenses", data: { jumlah: 5 } }, ko);
  assert.match(await got, /"c":"expenses"/); ctrl.abort();
});

test("data tersimpan ke disk & terbaca lagi setelah restart", async () => {
  await stop(); await start();
  const ko = await login("kevin", "rahasia123"); assert.ok(ko, "sesi/akun tetap ada");
  assert.equal((await db({ op: "get", c: "sales", id: "s1" }, ko)).body.data.total, 999);
  assert.ok(fs.readdirSync(path.join(dir, "backups")).some(f => /^lbdb-\d{4}-\d{2}-\d{2}\.json$/.test(f)), "backup harian dibuat");
});

test("AI nonaktif tanpa API key", async () => {
  const ko = await login("kevin", "rahasia123");
  assert.equal((await req("api/me", undefined, ko)).body.ai, false);
  assert.equal((await req("api/ai", { messages: [{ role: "user", content: "hi" }] }, ko)).body.code, "sampling_disabled");
});
