"use strict";
// Notifikasi otomatis (Telegram + Email), pengingat harian, backup jam 02:00, dan sinkron Google Sheet terjadwal.
const { sendMail, validEmail } = require("./mailer");
const { todayIn } = require("./rules");

const rp = n => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const fmtD = iso => { const B = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"]; const [y, m, d] = String(iso || "").split("-"); return d ? `${+d} ${B[+m - 1]} ${y}` : String(iso || ""); };
const short = c => String(c || "").replace(/^cabang\s+/i, "") || "–";
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

class Notifier {
  constructor(cfg, store, telegram) {
    this.cfg = cfg; this.store = store; this.tg = telegram; this.log = [];
    this.ran = {}; this.timer = null; this.sheets = null;
  }
  get emailOn() { return !!(this.cfg.smtp.host && this.cfg.smtp.from); }
  settings() { return this.store.get("settings", "notify") || {}; }
  appUrl() { return (this.cfg.appUrl || "").replace(/\/+$/, ""); }
  // penerima per role dari akun (users): field tgChat & email; ditambah daftar tambahan di settings/notify
  recipients(roles) {
    const s = this.settings(), out = { tg: new Set(), email: new Set() };
    for (const { data: u } of this.store.list("users")) {
      if (u.aktif === false || !roles.includes(u.role)) continue;
      if (u.tgChat) out.tg.add(String(u.tgChat)); if (u.email && validEmail(u.email)) out.email.add(u.email);
    }
    for (const r of roles) { (s[r]?.tg || []).forEach(x => x && out.tg.add(String(x))); (s[r]?.email || []).forEach(x => validEmail(x) && out.email.add(x)); }
    return out;
  }
  userRecipients(username) {
    const u = this.store.get("users", username), out = { tg: new Set(), email: new Set() };
    if (u?.tgChat) out.tg.add(String(u.tgChat)); if (u?.email && validEmail(u.email)) out.email.add(u.email);
    return out;
  }
  async deliver(rcpt, subject, text, event) {
    const s = this.settings(), res = { tg: 0, email: 0, errors: [] };
    if (s.events && s.events[event] === false) return res;
    const body = text + (this.appUrl() ? `\n\nBuka aplikasi: ${this.appUrl()}` : "");
    if (this.tg?.enabled && s.telegramOff !== true) for (const id of rcpt.tg) { try { await this.tg.send(id, `${subject}\n\n${body}`); res.tg++; } catch (err) { res.errors.push("Telegram " + id + ": " + err.message); } }
    if (this.emailOn && s.emailOff !== true && rcpt.email.size) {
      try { await sendMail(this.cfg.smtp, { to: [...rcpt.email], subject: "[Lash Bounty ERP] " + subject, text: body }); res.email = rcpt.email.size; } catch (err) { res.errors.push("Email: " + err.message); }
    }
    this.log.unshift({ at: new Date().toISOString(), event, subject, ...res }); this.log.length = Math.min(this.log.length, 100);
    if (res.errors.length) console.error("[notify]", event, res.errors.join(" | "));
    return res;
  }
  toRoles(roles, subject, text, event) { return this.deliver(this.recipients(roles), subject, text, event); }

  // ---- notifikasi dari perubahan data
  onChange(c, id, before, after) {
    const hr = this.store.get("settings", "hr") || {}, min = hr.notifMin > 0 ? hr.notifMin : 500000;
    try {
      if ((c === "expenses" || c === "pusat") && !before && after && (after.jumlah || 0) >= min && !after.contoh && !after.tabungan)
        this.toRoles(["owner"], `Pengeluaran di atas ${rp(min)}`, [`${short(after.cabang || after.unit)} · ${fmtD(after.tanggal)}`, after.kategori ? `Kategori: ${after.kategori}` : "Petty cash", `Keterangan: ${after.keterangan || "-"}`, `Jumlah: ${rp(after.jumlah)}`, after.pengisi ? `Diisi oleh: ${after.pengisi}` : ""].filter(Boolean).join("\n"), "bigExpense");
      if (c === "askboss" && after) {
        const old = new Map((before?.threads || []).map(t => [t.id, t]));
        for (const t of after.threads || []) {
          const p = old.get(t.id);
          if (!p) { this.toRoles(["owner"], `Ask Boss dari ${t.nama || t.from}`, `${t.topik}\n${t.cabang ? short(t.cabang) + "\n" : ""}\n${t.pesan}`, "askBoss"); continue; }
          const nr = (t.replies || []).slice((p.replies || []).length);
          for (const r of nr) {
            if (r.boss) this.deliver(this.userRecipients(t.from), "Balasan owner untuk pertanyaanmu", `${t.topik}\n\n${r.text}`, "askBoss");
            else this.toRoles(["owner"], `Ask Boss · balasan ${t.nama || t.from}`, `${t.topik}\n\n${r.text}`, "askBoss");
          }
        }
      }
      if (c === "permintaan" && after) {
        if (!before) this.toRoles(["head"], `Permintaan barang ${short(after.cabang)}`, `${(after.items || []).map(i => `• ${i.nama}: ${i.qty} ${i.satuan || ""}`).join("\n")}\n${after.catatan ? "Catatan: " + after.catatan + "\n" : ""}Diminta oleh: ${after.nama || after.by || "-"}`, "permintaan");
        else if (before.status !== after.status && after.by) this.deliver(this.userRecipients(after.by), `Permintaan barang: ${after.status}`, `${short(after.cabang)} · ${(after.items || []).map(i => i.nama + " " + i.qty).join(", ")}${after.estimasi ? "\nEstimasi sampai: " + fmtD(after.estimasi) : ""}`, "permintaan");
      }
      if (c === "refund" && after) {
        if (!before) this.toRoles(["owner"], "Refund perlu konfirmasi owner", `${short(after.cabang)} · ${after.alasan}\nCustomer: ${after.customer || "-"}\nJumlah: ${rp(after.jumlah)}\n${after.keterangan || ""}`, "refund");
        else if (before.status !== after.status && ["disetujui", "ditolak"].includes(after.status)) this.toRoles(["head"], `Refund ${after.status} owner`, `${after.customer || "-"} · ${rp(after.jumlah)}\n${after.catatanOwner || ""}`, "refund");
      }
      if (c === "closing" && after && before?.status !== "closed" && after.status === "closed")
        this.toRoles(["owner", "head"], `Tutup buku ${id} sudah final`, `Ditutup oleh ${after.closedBy || "-"}${after.ringkasan?.labaBersih != null ? "\nLaba bersih: " + rp(after.ringkasan.labaBersih) : ""}`, "closing");
    } catch (err) { console.error("[notify] onChange:", err.message); }
  }

  // ---- pengingat harian
  reminders() {
    const today = todayIn(this.cfg.timezone), out = [];
    const late = this.store.list("permintaan").map(x => ({ id: x.id, ...x.data })).filter(p => !["diterima", "ditolak", "batal"].includes(p.status)).filter(p => {
      const due = p.estimasi || addDays(String(p.at || p.tanggal || today).slice(0, 10), 0); return addDays(due, 3) < today; });
    if (late.length) out.push([["owner"], `${late.length} permintaan barang terlambat > 3 hari`, late.slice(0, 15).map(p => `• ${short(p.cabang)}: ${(p.items || []).map(i => i.nama).join(", ")} · ${p.status}${p.estimasi ? " · estimasi " + fmtD(p.estimasi) : ""}`).join("\n"), "reminder"]);
    const ref = this.store.list("refund").map(x => x.data).filter(r => r.status === "diajukan");
    if (ref.length) out.push([["owner"], `${ref.length} refund menunggu konfirmasi owner`, ref.slice(0, 15).map(r => `• ${short(r.cabang)} · ${r.customer || "-"} · ${rp(r.jumlah)} (${r.alasan})`).join("\n"), "reminder"]);
    const ab = this.store.list("askboss").flatMap(d => d.data.threads || []).filter(t => t.status !== "selesai" && !t.bossSeen);
    if (ab.length) out.push([["owner"], `${ab.length} pertanyaan Ask Boss belum dibaca`, ab.slice(0, 10).map(t => `• ${t.nama || t.from}: ${String(t.pesan).slice(0, 80)}`).join("\n"), "reminder"]);
    const cabs = (this.store.get("settings", "main")?.cabang || []).map(c => typeof c === "string" ? c : c?.nama).filter(Boolean), y = addDays(today, -1);
    const have = new Set(this.store.list("sales").map(x => x.data).filter(s => s.tanggal === y && s.sumber !== "Manual").map(s => s.cabang));
    const miss = cabs.filter(c => !have.has(c));
    if (miss.length) out.push([["head"], `Laporan Zenwel ${fmtD(y)} belum diupload`, miss.map(c => "• " + short(c)).join("\n"), "reminder"]);
    const d = +today.slice(8);
    if (d >= 27 && d <= 30) { const [Y, M] = today.split("-").map(Number), per = `${Y}-${String(M).padStart(2, "0")}`, C = this.store.get("closing", per);
      if (!C || C.status !== "closed") out.push([["owner", "head"], `Periode ${per} sudah lewat tanggal 26`, "Tutup buku periode ini belum final. Cek Accounting → Tutup Buku → Checklist & kunci.", "reminder"]); }
    // tabungan sewa: tanggal 20–26, setoran periode berjalan belum dicatat
    const tcab = Object.keys(this.store.get("bankcfg", "main")?.tabungan?.cabang || {});
    if (tcab.length && d >= 20 && d <= 26) { const per = today.slice(0, 7), done = new Set(this.store.list("tabungan").map(x => x.data).filter(t => t.tipe === "setor" && t.periode === per).map(t => t.cabang));
      const belum = tcab.filter(c => !done.has(c)); if (belum.length) out.push([["owner", "head"], `Tabungan sewa ${per} belum disetor`, belum.map(c => "• " + short(c)).join("\n") + "\nCatat di Banking → Tabungan Sewa.", "reminder"]); }
    return out;
  }
  async runReminders() { const list = this.reminders(); for (const [roles, s, t, e] of list) await this.toRoles(roles, s, t, e); return list.length; }

  // ---- jadwal: cek setiap menit
  start({ backup, sheets }) {
    this.sheets = sheets;
    const tick = async () => {
      const now = new Date(), parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: this.cfg.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now).map(p => [p.type, p.value]));
      const h = +parts.hour % 24, m = +parts.minute, today = todayIn(this.cfg.timezone);
      const once = async (key, fn) => { if (this.ran[key] === today) return; this.ran[key] = today; try { await fn(); } catch (err) { console.error("[jadwal]", key, err.message); } };
      if (h === this.cfg.backupHour && m < 10) await once("backup", () => backup(true));
      if (h === this.cfg.reminderHour && m < 10) await once("reminder", () => this.runReminders());
      if (sheets?.enabled && m % Math.max(1, this.cfg.sheets.intervalMin) === 0) { try { await sheets.sync(); } catch {} }
    };
    this.timer = setInterval(tick, 60 * 1000); this.timer.unref();
  }
  stop() { clearInterval(this.timer); }
}
module.exports = { Notifier };
