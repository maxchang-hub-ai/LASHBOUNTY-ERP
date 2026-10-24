"use strict";
// Tes fitur v1.1: akun awal, email (SMTP), Telegram, Google Sheet, aturan permintaan barang / refund / data karyawan,
// pengumuman, pengingat harian & backup. Semua layanan luar diganti server palsu lokal (tanpa internet).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const net = require("net");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { createServer } = require("../server/index.js");
const baseConfig = require("../server/config.js");
const { pwHash } = require("../server/auth.js");
const { todayIn } = require("../server/rules.js");

// ---- layanan palsu
const mails = [], tgSent = [], gReq = [];
function fakeSmtp() { return net.createServer(s => { let data = false, buf = "", m = null; s.write("220 fake\r\n");
  s.on("data", d => { buf += d.toString("latin1"); let i; while ((i = buf.indexOf("\r\n")) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 2);
    if (data) { if (l === ".") { data = false; mails.push(m); s.write("250 ok\r\n"); } else m.raw += l + "\n"; continue; }
    if (/^EHLO/i.test(l)) s.write("250-fake\r\n250 8BITMIME\r\n"); else if (/^MAIL FROM/i.test(l)) { m = { to: [], raw: "" }; s.write("250 ok\r\n"); }
    else if (/^RCPT TO/i.test(l)) { m.to.push(l.replace(/^RCPT TO:\s*<?|>$/gi, "")); s.write("250 ok\r\n"); } else if (/^DATA/i.test(l)) { data = true; s.write("354 go\r\n"); }
    else if (/^QUIT/i.test(l)) { s.write("221 bye\r\n"); s.end(); } else s.write("250 ok\r\n"); } }); s.on("error", () => {}); }); }
let tgUpdates = [];
function fakeHttp() { return http.createServer((req, res) => { let b = ""; req.on("data", c => b += c); req.on("end", () => { const u = req.url; let j = {}; try { j = b ? JSON.parse(b) : {}; } catch {} let out = { ok: true, result: true };
  if (/getMe/.test(u)) out = { ok: true, result: { id: 9, username: "lb_test_bot" } };
  else if (/getUpdates/.test(u)) { const ups = tgUpdates; tgUpdates = []; if (!ups.length) return setTimeout(() => { res.end(JSON.stringify({ ok: true, result: [] })); }, 150); out = { ok: true, result: ups }; }
  else if (/sendMessage/.test(u)) { tgSent.push(j); out = { ok: true, result: { message_id: 1 } }; }
  else if (u === "/token") out = { access_token: "tok", expires_in: 3600 };
  else if (/fields=sheets/.test(u)) out = { sheets: [] };
  else if (/\/v4\/spreadsheets\//.test(u)) { gReq.push({ path: u, auth: req.headers.authorization, body: j }); out = {}; }
  res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(out)); }); }); }
const dec = raw => raw.split(/\n\n/).map(p => /^[A-Za-z0-9+/=\n]{40,}$/.test(p.trim()) ? Buffer.from(p.replace(/\s+/g, ""), "base64").toString("utf8") : p).join("\n\n");

let app, base, dir, smtp, fake, fport, sport;
const listen = srv => new Promise(r => srv.listen(0, "127.0.0.1", () => r(srv.address().port)));
const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
function cfg(extra = {}) {
  return { ...baseConfig, dataDir: dir, noJobs: true, appUrl: "https://erp.test", ai: { ...baseConfig.ai, apiKey: "" },
    smtp: { host: "127.0.0.1", port: sport, secure: false, user: "", pass: "", from: "Lash Bounty <erp@lb.test>" },
    telegram: { token: "1:x", baseUrl: `http://127.0.0.1:${fport}` },
    sheets: { sheetId: "S1", keyFile: "", keyJson: JSON.stringify({ client_email: "sa@x.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }), token_uri: `http://127.0.0.1:${fport}/token` }), intervalMin: 10, baseUrl: `http://127.0.0.1:${fport}` }, ...extra };
}
async function start(c) { app = createServer(c || cfg()); base = `http://127.0.0.1:${await listen(app.server)}/`; }
async function req(p, body, token) {
  const r = await fetch(base + p, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", "X-LB-Device": "testdevice00000000000002", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const db = (b, t) => req("api/db", b, t);
const login = async (u, p) => (await req("api/login", { username: u, password: p })).body.token;
const seedEntry = (id, nama, role, pw) => { const salt = crypto.randomBytes(16).toString("hex"); return { id, username: id, nama, role, salt, hash: pwHash(pw, salt), iter: 150000 }; };
const wait = ms => new Promise(r => setTimeout(r, ms));

test.before(async () => {
  smtp = fakeSmtp(); sport = await listen(smtp); fake = fakeHttp(); fport = await listen(fake);
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "lbtest11-"));
  fs.writeFileSync(path.join(dir, "seed-users.json"), JSON.stringify({ users: [seedEntry("maxxchang", "Kevin", "owner", "Owner123"), seedEntry("superadmin", "Yuli Lim", "head", "Jenong8888"), seedEntry("trainer01", "Ayyas Eugene", "trainer", "Nenen0000"), { id: "Bad Name!!", hash: "x", salt: "y" }] }));
  await start();
});
test.after(async () => { await app.close(); smtp.close(); fake.close(); fs.rmSync(dir, { recursive: true, force: true }); });

test("akun awal dari seed-users.json (sekali, hash saja)", async () => {
  assert.equal((await req("api/me")).body.bootstrap, false, "tidak masuk mode akun pertama");
  assert.ok(fs.existsSync(path.join(dir, "seed-users.applied.json")) && !fs.existsSync(path.join(dir, "seed-users.json")), "file seed diganti nama");
  const t = await login("Super Admin", "Jenong8888"); assert.ok(t, "login 'Super Admin' (spasi & huruf besar diabaikan)");
  assert.equal((await req("api/me", undefined, t)).body.user.role, "head");
  assert.ok(await login("maxxchang", "Owner123")); assert.ok(await login("TRAINER 01", "Nenen0000"));
  assert.equal((await req("api/login", { username: "maxxchang", password: "owner123" })).status, 401, "password tetap case-sensitive");
  // seed kedua tidak menimpa akun yang sudah ada
  await app.close();
  fs.writeFileSync(path.join(dir, "seed-users.json"), JSON.stringify({ users: [seedEntry("maxxchang", "Penyusup", "staff", "Hack12345"), seedEntry("trainer02", "Hapni", "trainer", "Nenen0000")] }));
  await start();
  assert.ok(await login("maxxchang", "Owner123"), "password owner tidak berubah"); assert.equal(await login("maxxchang", "Hack12345"), undefined);
  assert.ok(await login("trainer02", "Nenen0000"), "akun baru dari seed kedua dibuat");
});

test("email SMTP: lampiran PDF, validasi, batas", async () => {
  const t = await login("superadmin", "Jenong8888");
  const pdf = Buffer.from("%PDF-1.4 tes lampiran").toString("base64");
  const r = await req("api/email", { to: ["owner@lb.test", "bukan-email"], cc: ["cc@lb.test"], subject: "Laporan Global — Oktober 2026", text: "Yth. Bapak Kevin,\n\nTerlampir laporan.", attachments: [{ filename: "Laporan Global Oktober 2026.pdf", contentType: "application/pdf", data: pdf }] }, t);
  assert.equal(r.body.ok, true); assert.equal(r.body.to, 2, "alamat tidak valid dibuang");
  const m = mails.at(-1); assert.deepEqual(m.to.sort(), ["cc@lb.test", "owner@lb.test"]);
  assert.match(m.raw, /filename\*?=.*Laporan/); assert.match(dec(m.raw), /Terlampir laporan/); assert.ok(m.raw.includes(pdf), "PDF ikut terkirim");
  assert.equal((await req("api/email", { to: ["a@b.c"], subject: "x", text: "y" })).status, 403, "tanpa login ditolak");
});

test("Telegram: chat tercatat & notifikasi refund ke owner", async () => {
  tgUpdates = [{ update_id: 5, message: { text: "/start", chat: { id: 777, type: "private", first_name: "Kevin" } } }];
  app.telegram.stopped = false; app.telegram.start(); await wait(700);
  const ko = await login("maxxchang", "Owner123");
  const ch = await db({ op: "get", c: "tgchats", id: "777" }, ko); assert.equal(ch.body.data?.nama, "Kevin", "chat yang menyapa bot tersimpan");
  assert.ok(tgSent.some(x => String(x.chat_id) === "777" && /Chat ID kamu: 777/.test(x.text)), "bot membalas chat ID");
  assert.equal((await db({ op: "set", c: "tgchats", id: "1", data: { id: "1" } }, ko)).status, 403, "tgchats hanya ditulis server");
  await db({ op: "update", c: "users", id: "maxxchang", data: { tgChat: "777", email: "kevin@lb.test" } }, ko);
  const yu = await login("superadmin", "Jenong8888");
  await db({ op: "add", c: "refund", data: { cabang: "Cabang Tebet", customer: "Bu Rani", alasan: "Lebih transfer", jumlah: 150000, status: "diajukan" } }, yu); await wait(400);
  assert.ok(tgSent.some(x => String(x.chat_id) === "777" && /Refund perlu konfirmasi owner/.test(x.text) && /erp\.test/.test(x.text)), "owner dapat Telegram + link aplikasi");
  assert.ok(mails.some(m => m.to.includes("kevin@lb.test") && /Refund perlu konfirmasi/.test(dec(m.raw) + m.raw)), "owner juga dapat email");
  app.telegram.stop();
});

test("refund: hanya owner yang menyetujui", async () => {
  const yu = await login("superadmin", "Jenong8888"), ko = await login("maxxchang", "Owner123");
  const id = (await db({ op: "query", c: "refund" }, yu)).body.docs[0].id;
  assert.equal((await db({ op: "update", c: "refund", id, data: { status: "disetujui" } }, yu)).status, 403, "Head of admin tidak bisa setujui");
  assert.equal((await db({ op: "add", c: "refund", data: { cabang: "X", jumlah: 1, status: "disetujui" } }, yu)).status, 403, "tidak bisa langsung dibuat disetujui");
  assert.equal((await db({ op: "update", c: "refund", id, data: { status: "disetujui", catatanOwner: "ok" } }, ko)).body.ok, true);
  assert.equal((await db({ op: "update", c: "refund", id, data: { status: "ditransfer", tglTransfer: "2026-10-24" } }, yu)).body.ok, true, "admin menandai ditransfer");
  assert.equal((await db({ op: "delete", c: "refund", id }, yu)).status, 403, "refund yang sudah diproses hanya dihapus owner");
});

test("permintaan barang: cabang membuat & menerima, admin memproses", async () => {
  const ko = await login("maxxchang", "Owner123");
  await db({ op: "set", c: "users", id: "rina", data: { ...seedEntry("rina", "Rina", "staff", "rina2026ok"), cabang: "Cabang Tebet", aktif: true } }, ko);
  const ri = await login("rina", "rina2026ok"), yu = await login("superadmin", "Jenong8888");
  assert.equal((await db({ op: "add", c: "permintaan", data: { cabang: "Cabang Tebet", items: [{ nama: "Lem", qty: 2 }], status: "dikirim", by: "rina" } }, ri)).status, 403, "staff tidak bisa buat dengan status selain menunggu");
  const id = (await db({ op: "add", c: "permintaan", data: { cabang: "Cabang Tebet", items: [{ nama: "Lem", qty: 2 }], status: "menunggu", by: "rina", at: new Date().toISOString() } }, ri)).body.id; assert.ok(id);
  assert.equal((await db({ op: "update", c: "permintaan", id, data: { status: "dikirim" } }, ri)).status, 403, "staff tidak bisa memproses");
  assert.equal((await db({ op: "update", c: "permintaan", id, data: { status: "diterima" } }, ri)).status, 403, "belum dikirim → belum bisa diterima");
  assert.equal((await db({ op: "update", c: "permintaan", id, data: { status: "dikirim", estimasi: "2026-10-01" } }, yu)).body.ok, true);
  assert.equal((await db({ op: "update", c: "permintaan", id, data: { status: "diterima", estimasi: "2027-01-01" } }, ri)).status, 403, "staff hanya boleh ubah kolom penerimaan");
  // pengingat: lewat 3 hari dari estimasi → owner
  const n0 = tgSent.length; const cnt = await app.notifier.runReminders(); assert.ok(cnt >= 1);
  assert.ok(tgSent.slice(n0).some(x => String(x.chat_id) === "777" && /terlambat > 3 hari/.test(x.text) && /Lem/.test(x.text)), "owner dinotifikasi permintaan terlambat");
  assert.equal((await db({ op: "update", c: "permintaan", id, data: { status: "diterima", diterimaAt: new Date().toISOString(), diterimaBy: "Rina", stokId: "s1" } }, ri)).body.ok, true, "cabang menandai diterima");
  assert.equal((await db({ op: "delete", c: "permintaan", id }, ri)).status, 403, "yang sudah diproses tidak bisa dibatalkan staff");
});

test("data karyawan: KTP, rekening & kontak hanya untuk admin", async () => {
  const ko = await login("maxxchang", "Owner123"), ri = await login("rina", "rina2026ok"), tr = await login("trainer01", "Nenen0000");
  await db({ op: "set", c: "settings", id: "karyawan", data: { list: [{ id: "e1", nama: "Hapni", jabatan: "Therapist", cabang: "Cabang Tebet", aktif: true, ktp: "3174010101010001", norek: "123", bank: "BCA", hp: "0812", email: "h@lb.test", tgChat: "888", alamat: "Jl. X" }] } }, ko);
  for (const t of [ri, tr]) { const k = (await db({ op: "get", c: "settings", id: "karyawan" }, t)).body.data.list[0]; assert.deepEqual(Object.keys(k).sort(), ["aktif", "cabang", "id", "jabatan", "nama"]); }
  assert.equal((await db({ op: "get", c: "settings", id: "karyawan" }, ko)).body.data.list[0].ktp, "3174010101010001");
  // trainer: KPI boleh, payroll tidak
  assert.equal((await db({ op: "set", c: "kpi", id: "2026-10_e1", data: { periode: "2026-10", empId: "e1", cek: {} } }, tr)).body.ok, true);
  await db({ op: "set", c: "payroll", id: "2026-10", data: { rows: [{ nama: "Hapni", pokok: 1 }] } }, ko);
  const pr = await db({ op: "get", c: "payroll", id: "2026-10" }, tr); assert.ok(pr.status === 403 || !pr.body.data, "trainer tidak bisa baca payroll");
});

test("pengumuman: email & Telegram ke karyawan", async () => {
  const yu = await login("superadmin", "Jenong8888"), n0 = tgSent.length, m0 = mails.length;
  const id = (await db({ op: "add", c: "pengumuman", data: { judul: "Libur", isi: "Libur 1 November", dari: "Yuli", channels: { email: true, telegram: true }, target: { mode: "cabang", cabang: ["Cabang Tebet"] } } }, yu)).body.id;
  const r = await req("api/announce", { id }, yu); assert.deepEqual([r.body.email, r.body.telegram, r.body.total], [1, 1, 1]);
  assert.ok(tgSent.slice(n0).some(x => String(x.chat_id) === "888" && /Libur 1 November/.test(x.text)));
  assert.ok(mails.slice(m0).some(m => m.to.includes("h@lb.test")));
  assert.equal((await db({ op: "get", c: "pengumuman", id }, yu)).body.data.ringkas.total, 1, "hasil kirim dicatat");
  const ri = await login("rina", "rina2026ok"); assert.equal((await req("api/announce", { id }, ri)).status, 403, "staff tidak bisa blast");
});

test("Google Sheet: cermin data tanpa password", async () => {
  const yu = await login("superadmin", "Jenong8888");
  await db({ op: "add", c: "expenses", data: { cabang: "Cabang Tebet", tanggal: "2026-10-05", bulan: "2026-10", jumlah: 50000, keterangan: "Tisu", pengisi: "Rina" } }, yu);
  const r = await req("api/sheets/sync", {}, yu); assert.equal(r.body.ok, true);
  const up = gReq.find(x => /values:batchUpdate/.test(x.path)); assert.ok(up && up.auth === "Bearer tok");
  const all = JSON.stringify(up.body); assert.match(all, /Tisu/); assert.doesNotMatch(all, /"hash"|Jenong|pbkdf2/i, "akun & password tidak ikut");
  assert.ok(gReq.some(x => /:batchUpdate$/.test(x.path) && x.body.requests?.some(q => q.addSheet)), "tab dibuat otomatis");
  const integ = await req("api/integrations", undefined, yu); assert.equal(integ.body.sheets.configured, true); assert.equal(integ.body.email.configured, true); assert.equal(integ.body.telegram.configured, true);
});

test("backup manual & jadwal jam 02:00", async () => {
  const yu = await login("superadmin", "Jenong8888");
  const r = await req("api/integrations/test", { channel: "backup" }, yu); assert.equal(r.body.ok, true); assert.match(r.body.file, /^lbdb-\d{4}-\d{2}-\d{2}\.json$/);
  assert.ok(fs.existsSync(path.join(dir, "backups", r.body.file)));
  assert.equal(app.notifier.cfg.backupHour, 2);
  const ri = await login("rina", "rina2026ok"); assert.equal((await req("api/integrations/test", { channel: "backup" }, ri)).status, 403);
  void todayIn;
});
