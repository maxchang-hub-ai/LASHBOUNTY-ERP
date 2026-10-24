"use strict";
// Kembalikan data dari file backup (hasil npm run backup atau backup harian otomatis).
// Pakai: npm run restore -- <file-backup.json>   (hentikan server dulu)
const fs = require("fs");
const path = require("path");
const config = require("../server/config");
const { Store } = require("../server/store");

const file = process.argv[2];
if (!file) { console.log("Pakai: npm run restore -- <file-backup.json>"); process.exit(1); }
let j; try { j = JSON.parse(fs.readFileSync(path.resolve(file), "utf8")); } catch (e) { console.log("File backup tidak bisa dibaca:", e.message); process.exit(1); }
if (!j || typeof j.collections !== "object") { console.log("Ini bukan file backup Lash Bounty ERP."); process.exit(1); }
const store = new Store(config.dataDir, { backupKeep: config.backupKeep });
const safety = path.join(config.dataDir, "backups", `sebelum-restore-${Date.now()}.json`);
fs.writeFileSync(safety, JSON.stringify({ at: new Date().toISOString(), collections: store.snapshot() }));
store.restore(j.collections);
console.log(`Data dikembalikan dari ${file} (${j.at || "-"}). Data sebelumnya disimpan di ${safety}`);
console.log("Semua user perlu login ulang kalau akun berubah. Jalankan: npm start");
