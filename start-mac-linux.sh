#!/usr/bin/env bash
# Jalankan Lash Bounty ERP di Mac / Linux. Pakai: ./start-mac-linux.sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js belum terpasang. Install versi LTS dari https://nodejs.org lalu jalankan lagi."; exit 1
fi
[ -f .env ] || cp .env.example .env
node scripts/check.js || exit 1
PORT_NOW=$(grep -E '^PORT=' .env | cut -d= -f2); PORT_NOW=${PORT_NOW:-8080}
echo ""; echo "Buka di browser: http://localhost:${PORT_NOW}   (Ctrl+C untuk berhenti)"
( sleep 1.5; (command -v open >/dev/null && open "http://localhost:${PORT_NOW}") || (command -v xdg-open >/dev/null && xdg-open "http://localhost:${PORT_NOW}") ) >/dev/null 2>&1 &
exec node server/index.js
