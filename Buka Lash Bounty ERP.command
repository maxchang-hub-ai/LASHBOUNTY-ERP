#!/bin/bash
# Klik 2x file ini di Finder untuk menjalankan Lash Bounty ERP di Mac.
# Jendela Terminal yang terbuka = server. Jangan ditutup selama aplikasi dipakai.
cd "$(dirname "$0")" || exit 1
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Node.js belum terpasang."
  echo "Download versi LTS di https://nodejs.org (pilih macOS Installer .pkg), install, lalu klik 2x file ini lagi."
  open "https://nodejs.org/en/download" >/dev/null 2>&1
  read -r -p "Tekan Enter untuk menutup..."
  exit 1
fi
chmod +x ./start-mac-linux.sh 2>/dev/null
# caffeinate: Mac tidak tidur otomatis selama server jalan (tutup layar laptop tetap membuat Mac tidur)
if command -v caffeinate >/dev/null 2>&1; then caffeinate -is ./start-mac-linux.sh; else ./start-mac-linux.sh; fi
echo ""
read -r -p "Server berhenti. Tekan Enter untuk menutup..."
