Folder ini berisi data aplikasi dan dibuat otomatis saat server jalan:
  db/            database (satu file JSON per koleksi)
  sessions.json  sesi login aktif
  backups/       backup harian otomatis jam 02:00 (lbdb-YYYY-MM-DD.json)
  seed-users.json  akun awal V.1.1 (hanya hash password); setelah dipakai berganti nama jadi seed-users.applied.json
  google-key.json  (opsional) kunci service account Google Sheet

Untuk pindah dari komputer offline ke cloud: hentikan server, lalu salin seluruh folder data ini ke server cloud.
Jangan hapus atau edit file di sini saat server sedang jalan.
