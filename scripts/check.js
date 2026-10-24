"use strict";
// Cek kesiapan instalasi: versi Node, file aplikasi, folder data, konfigurasi. Pakai: npm run check
const fs = require("fs");
const path = require("path");
const config = require("../server/config");

let bad = 0;
const ok = (c, m, hint) => { console.log((c ? "  OK   " : "  GAGAL") + "  " + m + (c || !hint ? "" : "\n         → " + hint)); if (!c) bad++; };
const [maj, min] = process.versions.node.split(".").map(Number);
console.log(`Lash Bounty ERP v${config.version} · cek instalasi\n`);
ok(maj > 18 || (maj === 18 && min >= 17), `Node.js ${process.versions.node}`, "Install Node.js versi 18.17 atau lebih baru (disarankan 20 / 22 LTS).");
const need = ["index.html", "js/app.js", "js/lb-standalone.js", "css/app.css", "css/fonts.css", "vendor/html2canvas-1.4.1.min.js", "vendor/jspdf-2.5.1.umd.min.js", "vendor/xlsx-0.18.5.full.min.js", "vendor/qrcode-generator-1.4.4.js", "img/logo.svg", "img/icon-192.png", "sw.js", "manifest.webmanifest", "fonts/plus-jakarta-sans-latin-400-normal.woff2"];
const miss = need.filter(f => !fs.existsSync(path.join(config.publicDir, f)));
ok(!miss.length, "File aplikasi lengkap", "File hilang: " + miss.join(", ") + ". Ekstrak ulang ZIP-nya.");
try { fs.mkdirSync(config.dataDir, { recursive: true }); const t = path.join(config.dataDir, ".write-test"); fs.writeFileSync(t, "ok"); fs.unlinkSync(t); ok(true, "Folder data bisa ditulis: " + config.dataDir); }
catch (e) { ok(false, "Folder data bisa ditulis: " + config.dataDir, e.message); }
ok(config.port > 0 && config.port < 65536, "Port " + config.port);
console.log("  INFO   AI (Ask Me!, scan nota, baca foto mutasi): " + (config.ai.apiKey ? "aktif · model " + config.ai.model : "nonaktif · isi ANTHROPIC_API_KEY di .env untuk mengaktifkan"));
console.log("  INFO   Zona waktu: " + config.timezone + " · backup otomatis jam " + String(config.backupHour).padStart(2, "0") + ":00 · pengingat jam " + String(config.reminderHour).padStart(2, "0") + ":00");
console.log("  INFO   Email (SMTP): " + (config.smtp.host && config.smtp.from ? "aktif · " + config.smtp.host + ":" + config.smtp.port : "nonaktif · isi SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM"));
console.log("  INFO   Telegram: " + (config.telegram.token ? "aktif" : "nonaktif · isi TELEGRAM_BOT_TOKEN"));
const gKey = config.sheets.keyJson || (config.sheets.keyFile && fs.existsSync(config.sheets.keyFile));
if (config.sheets.sheetId && !gKey) ok(false, "Google Sheet: file kunci service account", "File " + (config.sheets.keyFile || "(GOOGLE_SA_KEY_FILE kosong)") + " tidak ditemukan.");
else console.log("  INFO   Google Sheet: " + (config.sheets.sheetId ? "aktif · tiap " + config.sheets.intervalMin + " menit" : "nonaktif · isi GOOGLE_SHEET_ID & GOOGLE_SA_KEY_FILE"));
const seed = path.join(config.dataDir, "seed-users.json");
if (fs.existsSync(seed)) console.log("  INFO   Akun awal: seed-users.json siap dibuat saat server pertama jalan");
const users = path.join(config.dataDir, "db", "users.json");
console.log("  INFO   Akun: " + (fs.existsSync(users) ? Object.keys(JSON.parse(fs.readFileSync(users, "utf8"))).length + " akun terdaftar" : (fs.existsSync(seed) ? "akan dibuat dari seed-users.json" : "belum ada (buat akun Owner pertama saat pertama membuka aplikasi)")));
console.log(bad ? `\n${bad} masalah ditemukan.` : "\nSemua siap. Jalankan: npm start");
process.exit(bad ? 1 : 0);
