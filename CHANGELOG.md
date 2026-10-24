# Changelog

## 1.1.0 — 24 Oktober 2026 · Lash Bounty ERP V.1.1

**Akun**
- 6 akun awal (Kevin & Reyza Owner, Yuli Lim & Ning Surya Head of admin, Ayyas Eugene & Hapni Trainer) dari `data/seed-users.json`, password hanya sebagai hash.
- Role baru **Trainer** (KPI + input cabang + permintaan barang). Username otomatis tanpa spasi ("Super Admin" → `superadmin`).
- **Akun saya**: ganti password sendiri & tanda tangan digital (gambar di layar atau upload foto). Email & Telegram per akun.

**Accounting**
- **Import AI**: chat dengan AI + upload laporan lama (PDF, Excel, CSV, foto). AI bertanya sampai jelas, cek total, lalu data omzet, biaya, payroll, gaji owner & status tutup buku dimasukkan ke sistem.
- Import CSV sekarang menerima **Excel, PDF, dan foto** (PDF/foto dibaca AI sesuai kolom template).
- **Refund** (garansi, salah transfer, lebih transfer, transaksi dobel, lainnya) dengan status & konfirmasi **khusus Owner**, notifikasi ke owner, tandai ditransfer + catat biaya.
- Tutup buku: **Edit & Penyesuaian** (Talk to AI yang mengusulkan perubahan + edit manual & penyesuaian), **Riwayat** (buka & download laporan per periode, beberapa PDF sekaligus).
- Laporan final selalu memuat **Dibuat oleh (Yuli) & Diketahui oleh (Kevin) dengan tanda tangan**; tanda tangan otomatis minta ulang kalau periode direvisi. Logo di laporan.
- **Kirim laporan**: email dengan lampiran PDF, WhatsApp, atau salin pesan; template email sopan yang bisa diedit & disimpan.

**Banking:** **Tabungan Sewa** Tebet & Bekasi (10 jt/bulan masing-masing ke rekening pribadi Kevin) — setoran tercatat otomatis sebagai biaya "Biaya sewa tempat (ditabung)" di cabang, penarikan untuk bayar sewa tahunan, rekap 12 bulan, pengingat.

**Persediaan**
- **Permintaan barang** cabang → pusat: diproses Head of admin (menunggu pesanan / dikirim + estimasi sampai), cabang klik *Sudah diterima* → stok bertambah (tidak menyentuh HPP). Lewat 3 hari dari estimasi → owner dinotifikasi.
- **Grafik pemakaian barang** 6 bulan, filter per cabang / semua cabang dan per barang, peringkat & tabel.
- Aset: **Musnahkan** unit rusak + **Berita Acara Pemusnahan** (PDF, nomor otomatis, tanda tangan, kirim email).

**HRD**
- Data karyawan lengkap: alamat, KTP, HP, email, kontak darurat, bank & rekening, Telegram (data pribadi hanya untuk admin/HRD).
- **Kasbon** per orang dari rekening pusat, potongan gaji di payroll (kolom *Pot. kasbon*, saran cicilan), dicatat sebagai piutang di Aset — tidak masuk income statement.
- **Pengumuman**: blast email + Telegram + daftar kirim WhatsApp ke semua / per cabang / pilih karyawan.
- Slip gaji bisa dikirim email / WA / salin.

**Notifikasi & integrasi:** Telegram bot & email untuk pengeluaran besar, Ask Boss, permintaan barang, refund, tutup buku final, dan pengingat harian jam 09:00. Google Sheet sebagai cermin otomatis semua catatan. Halaman **Pengaturan → Integrasi & logo** (status, tes kirim, chat Telegram, riwayat notifikasi, backup).

**Lainnya:** backup otomatis **jam 02:00**, **dashboard mobile** dengan preview iPhone/Android + pasang di HP (PWA), **logo Lash Bounty** (bisa diganti dari aplikasi) & **tema terang/gelap**, tombol **QR** di setiap link khusus.

**Tes:** 22 tes server (termasuk SMTP, Telegram, Google Sheet palsu), E2E browser v1.0 + v1.1.

## 1.0.0 — 24 Oktober 2026 · Lash Bounty ERP V.1.0

Rilis pertama versi mandiri (server sendiri, bisa offline & cloud), setara simulasi di claude.ai versi 16.

**Accounting**
- Jurnal pengeluaran: input petty cash (scan nota AI, tanpa struk + rincian), biaya cabang di luar petty cash (termasuk Kantor Pusat), report pengeluaran, pengeluaran pusat.
- Omzet: import Zenwel "Sales by item", omzet manual (Kantor Pusat → other income), metode pembayaran harian + import CSV pembayaran, kas cabang & setoran ke bank.
- Tutup buku: checklist + detail yang belum beres, pre-final → gaji Kevin & Reyza → final, buka untuk revisi dengan alasan & riwayat, laporan Simple / Lash Bounty X Wendy Walters (Walters Lash 30% 100% untuk Wendy, ads & office fee, bagi hasil 50:50, lampiran) / Global / Expertise, export PDF & CSV.
- Import CSV dengan template.

**Banking** (Owner & Head of admin): rekening (EDC BCA, QRIS Maspion, EDC Pluit manual, EDC Mandiri), upload mutasi dari foto (AI) / CSV / manual, crosscheck uang masuk vs POS per hari dengan jeda cair & toleransi MDR, deteksi transaksi dobel, tandai dicek, notifikasi & WA ke owner, saldo bank by catatan vs by reality.

**Customer:** database customer (HP/WA, kunjungan, total belanja, layanan favorit, rating, label, catatan), input transaksi & import CSV.

**Persediaan:** stok barang (opening, masuk/keluar, opname, kartu & posisi stok, riwayat), aset.

**HRD:** data karyawan (termasuk Kantor Pusat), absensi + link check-in tanpa login, payroll, KPI, cek slip & kirim WA.

**Lainnya:** dashboard owner (omzet, notifikasi pengeluaran besar, bandingkan bulan, saldo bank, ringkasan AI), Ask Me! (AI) & Ask Boss, login username/password per role, riwayat perubahan, backup Excel.

**Server mandiri:** database JSON per koleksi dengan tulis atomik & backup harian, hak akses diperiksa di server, password PBKDF2, realtime antar perangkat, proxy Claude API opsional, library & font lokal (tanpa internet), Docker, script backup/restore/reset password, tes otomatis.
