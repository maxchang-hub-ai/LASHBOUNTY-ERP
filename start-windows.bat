@echo off
title Lash Bounty ERP
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Download dan install versi LTS dari https://nodejs.org lalu jalankan file ini lagi.
  pause
  exit /b 1
)
if not exist .env copy .env.example .env >nul
node scripts\check.js
if errorlevel 1 (
  pause
  exit /b 1
)
echo.
echo Buka di browser: http://localhost:8080   (tutup jendela ini untuk menghentikan server)
start "" http://localhost:8080
node server\index.js
pause
