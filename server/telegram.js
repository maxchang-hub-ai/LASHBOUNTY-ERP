"use strict";
// Bot Telegram: kirim notifikasi & menyimpan daftar chat yang pernah menyapa bot (untuk dihubungkan ke akun/karyawan).
class Telegram {
  constructor(cfg, store) {
    this.token = cfg.telegram.token; this.base = (cfg.telegram.baseUrl || "https://api.telegram.org").replace(/\/+$/, "");
    this.store = store; this.offset = 0; this.stopped = false; this.me = null; this.lastError = "";
  }
  get enabled() { return !!this.token; }
  async api(method, body) {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), method === "getUpdates" ? 40000 : 15000);
    try {
      const r = await fetch(`${this.base}/bot${this.token}/${method}`, { method: "POST", signal: ctrl.signal, headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) throw Object.assign(new Error(j.description || "Telegram error " + r.status), { code: "telegram_error" });
      return j.result;
    } finally { clearTimeout(t); }
  }
  async send(chatId, text) {
    if (!this.enabled) throw Object.assign(new Error("Telegram belum diatur (TELEGRAM_BOT_TOKEN)."), { code: "not_configured", status: 503 });
    const chunks = String(text).match(/[\s\S]{1,3900}/g) || [""];
    for (const c of chunks) await this.api("sendMessage", { chat_id: chatId, text: c, disable_web_page_preview: true });
    return { ok: true };
  }
  // Long-polling: setiap chat yang mengirim pesan ke bot dicatat di koleksi tgchats.
  async start() {
    if (!this.enabled) return;
    try { this.me = await this.api("getMe"); this.lastError = ""; } catch (err) { this.lastError = err.message; console.error("[telegram]", err.message); }
    const loop = async () => {
      while (!this.stopped) {
        try {
          const ups = await this.api("getUpdates", { offset: this.offset, timeout: 30, allowed_updates: ["message"] });
          for (const u of ups || []) {
            this.offset = u.update_id + 1; const m = u.message; if (!m?.chat) continue;
            const id = String(m.chat.id), name = [m.chat.first_name, m.chat.last_name].filter(Boolean).join(" ") || m.chat.title || m.chat.username || id;
            const prev = this.store.get("tgchats", id);
            this.store.set("tgchats", id, { id, nama: name, username: m.chat.username || "", tipe: m.chat.type, at: new Date().toISOString(), first: prev?.first || new Date().toISOString() });
            if (!prev || /^\/(start|id)/.test(m.text || "")) this.send(id, `Halo ${name}! Bot Lash Bounty ERP sudah terhubung.\nChat ID kamu: ${id}\nMinta admin menghubungkan chat ini di aplikasi (Pengaturan → Integrasi) supaya kamu menerima pengingat & pengumuman.`).catch(() => {});
          }
          this.lastError = "";
        } catch (err) { this.lastError = err.message; if (!this.stopped) await new Promise(r => setTimeout(r, 10000)); }
      }
    };
    loop();
  }
  stop() { this.stopped = true; }
}
module.exports = { Telegram };
