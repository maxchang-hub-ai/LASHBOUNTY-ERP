"use strict";
// Konfigurasi server. Nilai dibaca dari environment variable atau file .env di root proyek.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function loadEnvFile(file) {
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch { return; }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    if (process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}
loadEnvFile(path.join(ROOT, ".env"));

const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };

const config = {
  version: require(path.join(ROOT, "package.json")).version,
  root: ROOT,
  publicDir: path.join(ROOT, "public"),
  host: process.env.HOST || "0.0.0.0",
  port: int(process.env.PORT, 8080),
  dataDir: path.resolve(ROOT, process.env.DATA_DIR || "data"),
  timezone: process.env.APP_TZ || "Asia/Jakarta",
  sessionHours: int(process.env.SESSION_HOURS, 12),
  rememberDays: int(process.env.REMEMBER_DAYS, 30),
  backupKeep: int(process.env.BACKUP_KEEP, 30),
  trustProxy: /^(1|true|yes)$/i.test(process.env.TRUST_PROXY || ""),
  appUrl: process.env.APP_URL || "",
  backupHour: int(process.env.BACKUP_HOUR, 2),
  reminderHour: int(process.env.REMINDER_HOUR, 9),
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: int(process.env.SMTP_PORT, 465),
    secure: process.env.SMTP_SECURE ? /^(1|true|yes)$/i.test(process.env.SMTP_SECURE) : int(process.env.SMTP_PORT, 465) === 465,
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
  },
  telegram: { token: process.env.TELEGRAM_BOT_TOKEN || "", baseUrl: process.env.TELEGRAM_API_URL || "" },
  sheets: {
    sheetId: process.env.GOOGLE_SHEET_ID || "",
    keyFile: process.env.GOOGLE_SA_KEY_FILE ? path.resolve(ROOT, process.env.GOOGLE_SA_KEY_FILE) : "",
    keyJson: process.env.GOOGLE_SA_JSON || "",
    intervalMin: int(process.env.SHEETS_SYNC_MINUTES, 10),
    baseUrl: process.env.GOOGLE_SHEETS_API_URL || "",
  },
  ai: {
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
    baseUrl: (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, ""),
    maxTokens: int(process.env.ANTHROPIC_MAX_TOKENS, 2048),
  },
};

module.exports = config;
