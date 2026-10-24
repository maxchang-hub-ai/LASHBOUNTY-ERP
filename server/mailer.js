"use strict";
// Pengirim email SMTP sederhana (tanpa dependensi): SSL port 465 atau STARTTLS port 587.
// Cocok untuk Gmail / Google Workspace (pakai App Password), Outlook, atau SMTP hosting.
const net = require("net");
const tls = require("tls");
const crypto = require("crypto");

const b64 = s => Buffer.from(String(s), "utf8").toString("base64");
const encWord = s => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;
const wrap76 = s => s.replace(/.{1,76}/g, "$&\r\n");
const addrOnly = a => { const m = String(a).match(/<([^>]+)>/); return (m ? m[1] : String(a)).trim(); };
const validEmail = a => /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]+$/.test(addrOnly(a));
const fmtAddr = a => { const m = String(a).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/); return m && m[1] ? `${encWord(m[1])} <${m[2]}>` : addrOnly(a); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function buildMessage({ from, to, cc = [], replyTo, subject, text, attachments = [] }) {
  const mixed = "mix_" + crypto.randomBytes(12).toString("hex"), alt = "alt_" + crypto.randomBytes(12).toString("hex");
  const host = addrOnly(from).split("@")[1] || "localhost";
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#14201B">${esc(text).replace(/\r?\n/g, "<br>")}</body></html>`;
  const head = [
    `From: ${fmtAddr(from)}`, `To: ${to.map(fmtAddr).join(", ")}`, ...(cc.length ? [`Cc: ${cc.map(fmtAddr).join(", ")}`] : []),
    ...(replyTo ? [`Reply-To: ${fmtAddr(replyTo)}`] : []), `Subject: ${encWord(subject)}`, `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomBytes(16).toString("hex")}@${host}>`, "MIME-Version: 1.0", `Content-Type: multipart/mixed; boundary="${mixed}"`,
  ];
  let body = `--${mixed}\r\nContent-Type: multipart/alternative; boundary="${alt}"\r\n\r\n` +
    `--${alt}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(b64(text))}\r\n` +
    `--${alt}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(b64(html))}\r\n--${alt}--\r\n`;
  for (const a of attachments) {
    const name = String(a.filename || "lampiran").replace(/[\r\n"]/g, "");
    body += `--${mixed}\r\nContent-Type: ${a.contentType || "application/octet-stream"}; name="${encWord(name)}"\r\nContent-Disposition: attachment; filename="${encWord(name)}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(String(a.data).replace(/\s+/g, ""))}\r\n`;
  }
  body += `--${mixed}--\r\n`;
  return head.join("\r\n") + "\r\n\r\n" + body;
}

class SmtpConn {
  constructor(sock) { this.sock = sock; this.buf = ""; this.waiters = []; this.bind(sock); }
  bind(sock) { this.sock = sock; sock.setEncoding("utf8"); sock.on("data", d => { this.buf += d; this.pump(); }); sock.on("error", err => this.fail(err)); sock.on("close", () => this.fail(new Error("Koneksi SMTP tertutup."))); }
  fail(err) { const w = this.waiters; this.waiters = []; w.forEach(x => x.reject(err)); this.dead = err; }
  pump() {
    while (this.waiters.length) {
      const lines = this.buf.split("\r\n"); let end = -1;
      for (let i = 0; i < lines.length - 1; i++) if (/^\d{3} /.test(lines[i]) || /^\d{3}$/.test(lines[i])) { end = i; break; }
      if (end < 0) return;
      const resp = lines.slice(0, end + 1); this.buf = lines.slice(end + 1).join("\r\n");
      this.waiters.shift().resolve({ code: +resp[end].slice(0, 3), text: resp.join("\n") });
    }
  }
  read() { return new Promise((resolve, reject) => { if (this.dead) return reject(this.dead); this.waiters.push({ resolve, reject }); this.pump(); }); }
  async cmd(line, expect) {
    if (line != null) this.sock.write(line + "\r\n");
    const r = await this.read();
    if (expect && !expect.includes(r.code)) throw Object.assign(new Error(`SMTP ${line ? line.split(" ")[0] : "greeting"} ditolak: ${r.text}`), { code: "smtp_error" });
    return r;
  }
}

async function sendMail(cfg, msg) {
  const { host, port, secure, user, pass, from } = cfg;
  if (!host || !from) throw Object.assign(new Error("Email belum diatur di server (SMTP_HOST, SMTP_FROM)."), { code: "not_configured", status: 503 });
  const to = (msg.to || []).filter(validEmail), cc = (msg.cc || []).filter(validEmail);
  if (!to.length) throw Object.assign(new Error("Alamat email penerima belum benar."), { code: "invalid_argument", status: 400 });
  const raw = buildMessage({ ...msg, from, to, cc });
  const sock = await new Promise((resolve, reject) => {
    const opts = { host, port, servername: host, timeout: 20000 };
    const s = secure ? tls.connect(opts, () => resolve(s)) : net.connect(opts, () => resolve(s));
    s.once("error", reject); s.setTimeout(30000, () => s.destroy(new Error("SMTP timeout")));
  });
  const c = new SmtpConn(sock);
  try {
    await c.cmd(null, [220]);
    const name = "lash-bounty-erp";
    let ehlo = await c.cmd("EHLO " + name, [250]);
    if (!secure && /STARTTLS/i.test(ehlo.text)) {
      await c.cmd("STARTTLS", [220]);
      const tsock = await new Promise((resolve, reject) => { const t = tls.connect({ socket: sock, servername: host }, () => resolve(t)); t.once("error", reject); });
      sock.removeAllListeners("data"); c.buf = ""; c.bind(tsock);
      ehlo = await c.cmd("EHLO " + name, [250]);
    }
    if (user) {
      if (/AUTH[^\n]*PLAIN/i.test(ehlo.text)) await c.cmd("AUTH PLAIN " + Buffer.from("\0" + user + "\0" + pass).toString("base64"), [235]);
      else { await c.cmd("AUTH LOGIN", [334]); await c.cmd(b64(user), [334]); await c.cmd(b64(pass), [235]); }
    }
    await c.cmd(`MAIL FROM:<${addrOnly(from)}>`, [250]);
    for (const r of [...to, ...cc]) await c.cmd(`RCPT TO:<${addrOnly(r)}>`, [250, 251]);
    await c.cmd("DATA", [354]);
    await c.cmd(raw.replace(/\r\n\./g, "\r\n..") + "\r\n.", [250]);
    await c.cmd("QUIT", [221]).catch(() => {});
    return { ok: true, to: to.length + cc.length };
  } finally { try { c.sock.end(); } catch {} }
}

module.exports = { sendMail, buildMessage, validEmail };
