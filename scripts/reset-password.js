"use strict";
// Reset password akun langsung di server (untuk Owner yang lupa password).
// Pakai: npm run reset-password -- <username> <password-baru>
// Hentikan server dulu sebelum menjalankan perintah ini.
const crypto = require("crypto");
const config = require("../server/config");
const { Store } = require("../server/store");
const { pwHash } = require("../server/auth");

const [username, password] = process.argv.slice(2);
if (!username || !password) { console.log("Pakai: npm run reset-password -- <username> <password-baru>"); process.exit(1); }
if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) { console.log("Password minimal 8 karakter, ada huruf dan angka."); process.exit(1); }
const store = new Store(config.dataDir, { backupKeep: config.backupKeep });
const id = username.trim().toLowerCase(), u = store.get("users", id);
if (!u) { console.log(`Akun "${id}" tidak ditemukan. Akun yang ada: ${store.list("users").map(x => x.id).join(", ") || "(kosong)"}`); process.exit(1); }
const salt = crypto.randomBytes(16).toString("hex");
store.update("users", id, { salt, hash: pwHash(password, salt), iter: 150000, aktif: true, pwAt: new Date().toISOString() });
store.flush();
console.log(`Password "${id}" (${u.nama || ""}, ${u.role}) sudah diganti dan akun diaktifkan. Jalankan lagi server: npm start`);
