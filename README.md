# Lash Bounty ERP V.1.1

## Pratinjau tampilan di GitHub Pages

URL Pages membuka `index.html` di root, yang dibuat dari `public/index.html` dan menggunakan
CSS serta aplikasi terbaru di `public/`. Jalankan `npm run build:pages` setelah mengubah
HTML atau penghubung browser. Commit hasilnya bersama folder `preview/` dan `.nojekyll`.
Pengaturan Pages: branch `dashboard`, folder `/ (root)`.

Pratinjau menyediakan data contoh dan akun demo (password `demo1234`). Pilih akun pada
layar login, kemudian klik Masuk. Perubahan hanya tersimpan di browser tersebut;
gunakan Reset demo untuk kembali ke data awal. Email/Telegram hanya disimulasikan
di Kotak keluar. Pratinjau tidak memakai database bersama atau layanan AI.
Jangan masukkan data bisnis asli ke pratinjau.

`npm start` tetap menjalankan aplikasi server dari `public/` dengan login dan database
di `data/`; mode demo tidak dimuat oleh server Node.js. Untuk ERP bersama, deploy
server dengan penyimpanan permanen.

ERP untuk salon lash & nail multi-cabang (Gading Serpong, Pluit = grup Internal · Tebet, Bekasi = grup Wendy).
Versi ini berjalan **mandiri**: punya server dan database sendiri, bisa dicoba offline di komputer lalu di-hosting di cloud.

Isi aplikasi: petty cash & biaya cabang, pengeluaran pusat, omzet Zenwel + metode bayar, kas & setoran, refund, tutup buku
(Simple, Lash Bounty X Wendy Walters, Global, Expertise) dengan pre-final, gaji owner Kevin & Reyza, edit & penyesuaian
(manual + AI), riwayat, tanda tangan "dibuat oleh / diketahui oleh", export PDF & kirim email, Import AI untuk laporan lama,
Banking (crosscheck mutasi vs POS, saldo bank, tabungan sewa), database customer, persediaan (stok, permintaan barang
cabang → pusat, grafik pemakaian) & aset (pemusnahan + berita acara), HRD (karyawan lengkap, absensi + link check-in,
payroll, kasbon, KPI, slip, pengumuman), Ask Me! (AI) & Ask Boss, notifikasi Telegram & email, cermin Google Sheet,
backup otomatis jam 02:00, dashboard mobile (bisa dipasang di HP), tema terang/gelap.

---

## 1. Struktur folder

```
lash-bounty-erp/
├── README.md               panduan ini
├── CHANGELOG.md            daftar perubahan per versi
├── package.json            info aplikasi & perintah npm (tanpa dependensi luar)
├── .env.example            contoh konfigurasi → salin jadi .env
├── start-windows.bat       klik 2x untuk menjalankan di Windows
├── Buka Lash Bounty ERP.command   klik 2x untuk menjalankan di Mac
├── start-mac-linux.sh      jalankan di Mac / Linux lewat Terminal
├── Dockerfile              untuk hosting cloud (Docker)
├── docker-compose.yml      jalankan dengan Docker Compose
├── server/                 server Node.js
│   ├── index.js            HTTP server, API database, login, realtime, email, file statis
│   ├── config.js           baca .env
│   ├── store.js            database file JSON + backup harian
│   ├── auth.js             login, sesi, password (PBKDF2)
│   ├── rules.js            hak akses per role & per data
│   ├── ai.js               penghubung ke Claude API (opsional)
│   ├── mailer.js           kirim email (SMTP) dengan lampiran PDF
│   ├── telegram.js         bot Telegram untuk notifikasi
│   ├── sheets.js           cermin otomatis ke Google Sheet
│   └── notify.js           notifikasi, pengingat harian, jadwal backup 02:00
├── public/                 aplikasi yang dibuka di browser
│   ├── index.html, manifest.webmanifest, sw.js (pasang di HP)
│   ├── css/app.css, css/fonts.css
│   ├── js/lb-standalone.js penghubung browser ↔ server
│   ├── js/app.js           aplikasi Lash Bounty ERP
│   ├── img/                logo & ikon aplikasi
│   ├── vendor/             jsPDF, html2canvas, SheetJS, QR code (lokal, tidak perlu internet)
│   └── fonts/              Plus Jakarta Sans & IBM Plex Mono (lokal)
├── scripts/                check, backup, restore, reset-password
├── tests/api.test.js       tes otomatis server (npm test)
├── licenses/               lisensi library & font pihak ketiga
└── data/                   DATA KAMU (dibuat otomatis): database, sesi, backup harian
    └── seed-users.json     6 akun awal (dipakai sekali saat server pertama jalan)
```

## 2. Kebutuhan

- **Node.js 18.17 atau lebih baru** (disarankan 22 LTS) — download di https://nodejs.org
- Tidak perlu `npm install`: aplikasi tidak memakai paket tambahan.
- Browser modern (Chrome, Edge, Safari, Firefox).

## 3. Menjalankan offline di komputer

**Windows:** ekstrak ZIP → klik 2x `start-windows.bat` → browser terbuka ke `http://localhost:8080`.

**Mac:** simpan folder di Home (bukan Downloads/Desktop), lalu klik 2x `Buka Lash Bounty ERP.command`.
Pertama kali macOS menolak file dari internet → System Settings → Privacy & Security → **Open Anyway**.
Jendela Terminal yang terbuka adalah servernya, jangan ditutup selama dipakai.

**Mac / Linux lewat Terminal:**
```bash
cd ~/lash-bounty-erp
./start-mac-linux.sh
```

Atau manual di semua sistem:
```bash
cp .env.example .env      # Windows: copy .env.example .env
npm run check             # cek kesiapan
npm start                 # server jalan di http://localhost:8080
```
Hentikan server dengan `Ctrl + C` (data otomatis tersimpan).

### Update dari V.1.0
Hentikan server → ekstrak ZIP V.1.1 **menimpa** folder lama (folder `data/` lama tetap aman, ZIP tidak berisi database) → jalankan lagi.
Akun awal di `data/seed-users.json` hanya dibuat kalau username-nya belum ada.

### Pertama kali dibuka
1. Login dengan akun awal (lihat bagian 4). Segera **ganti password** di Pengaturan → **Akun saya**, dan buat **tanda tangan** di sana.
2. **Pengaturan → Cabang & link**: isi cabang dan grupnya (Internal / Wendy).
3. **HRD → Data Karyawan**: isi karyawan, klik **Lengkapi** untuk alamat, KTP, HP, email, kontak darurat, bank & rekening.
4. **Pengaturan → Notifikasi & absensi**: no. WA owner, nama owner (Kevin, Reyza), porsi bagi hasil & Walters Lash.
5. **Banking → Rekening** dan **Banking → Tabungan Sewa** (Tebet & Bekasi 10 jt/bulan).
6. **Pengaturan → Integrasi & logo**: upload logo Lash Bounty, cek Telegram / email / Google Sheet.

### Dibuka dari HP / komputer lain di WiFi yang sama
Cari IP komputer server (Windows: `ipconfig`, Mac: System Settings → Wi-Fi → Details), lalu buka
`http://IP-KOMPUTER:8080` di HP. Izinkan Node.js di firewall kalau diminta.
Setelah online dengan **https**, aplikasi bisa dipasang di HP: Dashboard → **Mobile** berisi QR & cara pasang di iPhone/Android.

## 4. Akun & hak akses

**Akun awal** (dibuat otomatis dari `data/seed-users.json`, password disimpan sebagai hash):

| Nama | Username | Role |
|---|---|---|
| Kevin | `maxxchang` | Owner |
| Reyza | `reyzachang` | Owner |
| Yuli Lim | `superadmin` (boleh diketik "Super Admin") | Head of admin |
| Ning Surya | `superadmin2` ("Super Admin 2") | Head of admin |
| Ayyas Eugene | `trainer01` ("Trainer 01") | Trainer |
| Hapni | `trainer02` ("Trainer 02") | Trainer |

Password awal sesuai yang diberikan ke tim. **Wajib diganti** setelah login pertama (Pengaturan → Akun saya).
Username tidak membedakan huruf besar/kecil dan spasi otomatis dihapus.

| Role | Bisa |
|---|---|
| Owner | Semua, termasuk Banking, approve lupa password, konfirmasi refund, tanda tangan "diketahui oleh" |
| Head of admin (Yuli) | Semua admin + Banking + kelola akun (kecuali akun Owner), proses permintaan barang, tanda tangan "dibuat oleh" |
| Admin keuangan, HRD | Data keuangan/HRD sesuai menu; tidak bisa Banking & kelola akun |
| Trainer | KPI karyawan, input petty cash & stok cabang, permintaan barang, Ask Me! |
| Manager / Staff cabang | Input petty cash, stok, permintaan barang, absensi, Ask Me! & Ask Boss |
| Tanpa login | Hanya link check-in absensi (`…/#absen-tebet` dst., lihat Pengaturan → Cabang & link) |

Hak akses dicek **di server** (bukan cuma disembunyikan di layar). Password disimpan sebagai hash PBKDF2 dan tidak pernah dikirim ke browser.
No. KTP, rekening, dan kontak karyawan hanya bisa dibaca admin/HRD (disaring di server).

**Lupa password:** user klik *Lupa password?* → Owner menyetujui di Pengaturan → Role & akses.
**Owner lupa password:** hentikan server, lalu jalankan:
```bash
npm run reset-password -- maxxchang PasswordBaru123
```

## 5. AI (opsional)

Ask Me!, ringkasan AI, scan nota, baca foto mutasi, **Import AI** (laporan lama PDF/Excel/foto), **baca PDF/foto di Import CSV**,
dan **Talk to AI** di Tutup Buku → Edit & Penyesuaian memakai Claude API.
Buat API key di https://console.anthropic.com lalu isi di `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5-5
```
Restart server. Tanpa API key semua fitur lain tetap jalan; tombol AI otomatis disembunyikan.
API key hanya disimpan di server, tidak pernah dikirim ke browser.

## 6. Integrasi: Telegram, Email, Google Sheet

Semua diisi di file `.env` (lalu restart server), statusnya terlihat di **Pengaturan → Integrasi & logo** (ada tombol tes).

**Telegram (notifikasi & pengingat)**
1. Di Telegram cari **@BotFather** → `/newbot` → beri nama (contoh *Lash Bounty ERP*) → salin token.
2. Isi `TELEGRAM_BOT_TOKEN=123456:ABC...` di `.env`, restart server.
3. Owner/admin buka bot-nya dan kirim `/start`. Bot membalas **chat ID**.
4. Di Pengaturan → Integrasi, hubungkan chat ID ke akun (atau isi di Role & akses → Edit akun). Untuk karyawan isi di Data Karyawan → Lengkapi.

Yang dikirim: pengeluaran besar, Ask Boss, permintaan barang (baru, status, terlambat > 3 hari → owner), refund (perlu konfirmasi owner),
tutup buku final, dan pengingat harian jam 09:00 (Zenwel belum diupload, refund menunggu, tabungan sewa, tutup buku).

**Email (kirim laporan, slip, berita acara, pengumuman, notifikasi)** — contoh Gmail: aktifkan 2-Step Verification,
buat **App password** di https://myaccount.google.com/apppasswords, lalu:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=finance@lashbounty.com
SMTP_PASS=app-password-16-huruf
SMTP_FROM=Lash Bounty <finance@lashbounty.com>
```
Sebelum email terkirim selalu muncul template yang sopan dan bisa diedit; centang *Simpan sebagai template* untuk memakainya lagi.

**WhatsApp:** tombol *Kirim WA* membuka WhatsApp dengan pesan siap kirim (tanpa biaya API). Pengumuman punya daftar kirim WA per karyawan.

**Google Sheet (cermin otomatis, hanya baca)**
1. Buka https://console.cloud.google.com → buat project → aktifkan **Google Sheets API**.
2. IAM & Admin → Service Accounts → buat → Keys → Add key → JSON → simpan file ke folder **`data/`**, contoh `data/google-key.json`
   (folder `data/` tidak ikut ke GitHub dan ikut tersimpan di volume Docker).
3. Buat Google Sheet baru, **Share** ke email service account (…@….iam.gserviceaccount.com) sebagai **Editor**.
4. Isi di `.env`: `GOOGLE_SHEET_ID=` (bagian URL antara `/d/` dan `/edit`) dan `GOOGLE_SA_KEY_FILE=data/google-key.json`.
5. Restart. Semua catatan (pengeluaran, omzet, kas, payroll, stok, permintaan, aset, kasbon, refund, tabungan, tutup buku, customer)
   disalin ke tab masing-masing tiap 10 menit. Input tetap lewat aplikasi — edit di Sheet akan tertimpa.

File kunci Google, `.env`, dan folder `data/` **jangan pernah** di-upload ke GitHub (sudah masuk `.gitignore`).

## 7. Backup & pindah data

- **Otomatis:** backup setiap hari **jam 02:00** (zona `APP_TZ`) ke `data/backups/lbdb-YYYY-MM-DD.json` (30 hari terakhir),
  plus saat server dinyalakan. Bisa juga klik *Backup sekarang* di Pengaturan → Integrasi.
- **Manual:** `npm run backup` (atau Pengaturan → Data & backup → Excel untuk dibuka di Google Sheets).
- **Restore:** hentikan server → `npm run restore -- data/backups/lbdb-2026-10-24.json` → `npm start`.
- **Pindah offline → cloud:** hentikan server, salin folder `data/` ke server cloud, jalankan di sana. Semua akun & data ikut.

## 8. Hosting di cloud & GitHub

Pilih salah satu. Yang penting: **disk permanen** untuk folder `data/` dan **HTTPS**.
Isi `APP_URL=https://erp.lashbounty.com` di `.env` supaya link di notifikasi & QR benar.

**Simpan kode di GitHub (private repo):**
```bash
cd lash-bounty-erp
git init && git add . && git commit -m "Lash Bounty ERP V.1.1"
git branch -M main
git remote add origin https://github.com/USERNAME/lash-bounty-erp.git
git push -u origin main
```
`.gitignore` sudah mengecualikan `data/`, `.env`, dan file kunci. Di server: `git clone` repo, salin `.env` dan folder `data/` lama
(atau `data/seed-users.json` untuk akun awal), lalu jalankan. Update berikutnya cukup `git pull` lalu restart.

### A. VPS (DigitalOcean, Vultr, Biznet, IDCloudHost, dll.) dengan Docker
```bash
# di server
git clone https://github.com/USERNAME/lash-bounty-erp.git && cd lash-bounty-erp
cp .env.example .env          # isi API key, SMTP, Telegram, Google Sheet
docker compose up -d --build  # jalan di port 8080, data di ./data
```
Pasang HTTPS dengan reverse proxy, contoh **Caddy** (`/etc/caddy/Caddyfile`):
```
erp.lashbounty.com {
    reverse_proxy localhost:8080
}
```
Arahkan domain ke IP server, Caddy otomatis membuat sertifikat HTTPS.

### B. VPS tanpa Docker
Install Node.js 22, upload folder, lalu jalankan dengan PM2 supaya otomatis hidup lagi:
```bash
npm install -g pm2
pm2 start server/index.js --name lash-bounty-erp
pm2 save && pm2 startup
```
Tambahkan Caddy/Nginx seperti di atas untuk HTTPS, dan isi `TRUST_PROXY=true` di `.env`.

### C. Platform (Railway, Render, Fly.io)
Deploy pakai `Dockerfile` (hubungkan ke repo GitHub). Wajib tambahkan **volume / persistent disk** yang di-mount ke `/app/data`,
kalau tidak data hilang setiap deploy. Isi environment variable dari `.env.example` di dashboard platform.

> Jalankan aplikasi minimal 1 instance saja (database ada di disk server tersebut). Backup jam 02:00 butuh server menyala.

### Keamanan saat online
- Selalu pakai HTTPS (domain + Caddy/Nginx atau HTTPS bawaan platform).
- Ganti password akun awal sebelum link dibagikan.
- Gunakan password kuat untuk Owner & Head of admin.

## 9. Perintah

| Perintah | Fungsi |
|---|---|
| `npm start` | jalankan server |
| `npm run check` | cek Node.js, file, folder data, konfigurasi |
| `npm test` | tes otomatis server (akses, login, absensi, realtime, email, Telegram, Google Sheet, akun awal) |
| `npm run backup` | export semua data ke JSON |
| `npm run restore -- <file>` | kembalikan data dari backup |
| `npm run reset-password -- <username> <password>` | reset password akun |

## 10. Konfigurasi (.env)

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | 8080 | port server |
| `HOST` | 0.0.0.0 | alamat (0.0.0.0 = bisa dibuka dari HP di jaringan sama) |
| `DATA_DIR` | data | folder data |
| `APP_TZ` | Asia/Jakarta | zona waktu check-in, backup & pengingat |
| `APP_URL` | (kosong) | alamat aplikasi online, untuk link di notifikasi |
| `BACKUP_HOUR` / `REMINDER_HOUR` | 2 / 9 | jam backup otomatis & pengingat harian |
| `SESSION_HOURS` / `REMEMBER_DAYS` | 12 / 30 | lama sesi login |
| `BACKUP_KEEP` | 30 | jumlah backup harian |
| `TRUST_PROXY` | false | `true` kalau di belakang Caddy/Nginx/platform |
| `ANTHROPIC_API_KEY` | (kosong) | aktifkan fitur AI |
| `ANTHROPIC_MODEL` | claude-sonnet-5-5 | model Claude |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | (kosong) / 465 | email keluar |
| `TELEGRAM_BOT_TOKEN` | (kosong) | bot Telegram |
| `GOOGLE_SHEET_ID` `GOOGLE_SA_KEY_FILE` | (kosong) | cermin Google Sheet |
| `SHEETS_SYNC_MINUTES` | 10 | jeda sinkron Google Sheet |

## 11. Masalah umum

- **"Server belum tersambung"** → server belum jalan / mati. Jalankan `npm start`, lalu muat ulang halaman.
- **Port sudah dipakai** → ganti `PORT=8081` di `.env`.
- **Tombol AI tidak muncul** → `ANTHROPIC_API_KEY` belum diisi atau server belum di-restart.
- **Email gagal** → cek Pengaturan → Integrasi (tombol *Tes email*). Gmail wajib pakai App password, bukan password biasa.
- **Telegram tidak masuk** → pastikan sudah kirim `/start` ke bot dan chat ID terhubung ke akun.
- **Google Sheet error 403/404** → Sheet belum di-share ke email service account sebagai Editor.
- **Tidak bisa dipasang di HP** → harus dibuka lewat `https://` (setelah hosting).
- **Data aneh setelah salah input** → Tutup Buku → *Edit & Penyesuaian*, *Buka untuk revisi*, atau restore dari backup harian.
