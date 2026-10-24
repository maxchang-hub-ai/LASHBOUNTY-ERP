"use strict";
// Proxy ke Claude API (Anthropic) untuk Ask Me!, ringkasan AI, scan nota & baca foto mutasi.
// Aktif hanya kalau ANTHROPIC_API_KEY diisi. API key tidak pernah dikirim ke browser.
const MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"];

async function complete(config, body) {
  const { apiKey, model, baseUrl, maxTokens } = config.ai;
  if (!apiKey) throw Object.assign(new Error("AI belum diaktifkan di server."), { code: "sampling_disabled", status: 503 });
  let messages = Array.isArray(body.messages) ? body.messages : [];
  messages = messages.filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length)
    .map(m => ({ role: m.role, content: m.content.slice(0, 300000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") throw Object.assign(new Error("Pesan tidak valid."), { code: "invalid_argument", status: 400 });
  const images = (Array.isArray(body.images) ? body.images : []).filter(im => im && MEDIA.includes(im.media_type) && typeof im.data === "string").slice(0, 8);
  const docs = (Array.isArray(body.documents) ? body.documents : []).filter(d => d && d.media_type === "application/pdf" && typeof d.data === "string").slice(0, 5);
  // file (PDF/gambar) ditaruh di pesan user pertama supaya tetap jadi konteks sepanjang percakapan
  if (images.length || docs.length) {
    const at = Math.max(0, Math.min(messages.length - 1, Number.isInteger(body.attachAt) ? body.attachAt : messages.length - 1));
    const m = messages[at];
    if (m.role === "user") m.content = [...docs.map(d => ({ type: "document", source: { type: "base64", media_type: "application/pdf", data: d.data }, ...(d.name ? { title: String(d.name).slice(0, 200) } : {}) })),
      ...images.map(im => ({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } })), { type: "text", text: m.content }];
  }
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 240000);
  let res;
  try {
    res = await fetch(baseUrl + "/v1/messages", {
      method: "POST", signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: Math.min(Math.max(maxTokens, parseInt(body.maxTokens, 10) || 0), 16000), messages, ...(body.system ? { system: String(body.system).slice(0, 20000) } : {}) }),
    });
  } catch (err) {
    throw Object.assign(new Error("Tidak bisa menghubungi Claude API: " + (err?.name === "AbortError" ? "timeout" : err.message)), { code: "unavailable", status: 502 });
  } finally { clearTimeout(t); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = res.status === 429 ? "rate_limited" : res.status === 401 || res.status === 403 ? "sampling_disabled" : "unavailable";
    throw Object.assign(new Error(j?.error?.message || "Claude API error " + res.status), { code, status: res.status === 429 ? 429 : 502 });
  }
  const text = (j.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  return { text, truncated: j.stop_reason === "max_tokens" };
}

module.exports = { complete, MEDIA };
