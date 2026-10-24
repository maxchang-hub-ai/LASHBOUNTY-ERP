/* Lash Bounty ERP · panel MODE DEMO: akun contoh di layar login, kotak keluar (email/Telegram simulasi), reset data. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PW = window.LB_DEMO.password;
  const ACC = [["maxxchang", "Kevin · Owner"], ["superadmin", "Yuli Lim · Head of admin"], ["trainer01", "Ayyas · Trainer"], ["tebet", "Staff Tebet"]];
  // akun contoh di kartu login
  const lg = $("lgForm");
  if (lg) { const box = document.createElement("div"); box.className = "demo-acc"; box.innerHTML = `<b>Mode demo</b><span>Klik akun untuk mengisi otomatis · password semua akun: <code>${esc(PW)}</code></span><div class="demo-chips">${ACC.map(([u, l]) => `<button type="button" class="demo-chip" data-demou="${u}"><b>${u}</b><small>${esc(l)}</small></button>`).join("")}</div>`;
    lg.parentNode.insertBefore(box, lg);
    box.addEventListener("click", e => { const b = e.target.closest("[data-demou]"); if (!b) return; $("lgUser").value = b.dataset.demou; $("lgPass").value = PW; $("lgGo").focus(); }); }
  // pita demo
  const bar = document.createElement("div"); bar.className = "demo-bar"; bar.setAttribute("role", "region"); bar.setAttribute("aria-label", "Mode demo");
  bar.innerHTML = `<span class="demo-tag">DEMO</span><span class="demo-txt">Pratinjau - data contoh di browser ini - backend bersama belum terhubung</span><button type="button" id="demoOut">Kotak keluar <b id="demoOutN">0</b></button><button type="button" id="demoReset">Reset demo</button>`;
  document.body.appendChild(bar);
  const sheet = document.createElement("div"); sheet.className = "sheet"; sheet.id = "demoSheet"; sheet.hidden = true;
  sheet.innerHTML = `<div class="sheet-card" role="dialog" aria-labelledby="demoSheetT"><div class="sec-h"><div><h2 id="demoSheetT">Kotak keluar demo</h2><span class="note">Di mode demo, email, Telegram, notifikasi & pengumuman tidak benar-benar dikirim. Semua yang akan terkirim dicatat di sini.</span></div><button class="btn ghost" type="button" id="demoClose" aria-label="Tutup">✕</button></div><div id="demoList" class="demo-list"></div></div>`;
  document.body.appendChild(sheet);
  const render = () => { const L = window.LB_DEMO.outbox(); $("demoOutN").textContent = L.length;
    $("demoList").innerHTML = L.length ? L.map(o => `<div class="demo-msg"><div class="demo-mh"><span class="pill ${o.kanal === "Email" ? "ok" : o.kanal === "Notifikasi" ? "warn" : ""}">${esc(o.kanal)}</span><b>${esc(o.subject || "")}</b><small>${esc(new Date(o.at).toLocaleString("id-ID"))}</small></div><div class="note">Ke: ${esc(o.ke || "–")}${o.lampiran ? " · 📎 " + esc(o.lampiran) : ""}</div><pre>${esc(o.text || "")}</pre></div>`).join("") : `<div class="empty">Belum ada. Coba kirim laporan lewat email, ajukan refund, atau buat pengumuman.</div>`; };
  window.addEventListener("lbdemo-outbox", render); window.LB_DEMO.ready.then(render);
  $("demoOut").addEventListener("click", () => { render(); sheet.style.zIndex = "999"; sheet.hidden = false; });
  $("demoClose").addEventListener("click", () => { sheet.hidden = true; });
  sheet.addEventListener("click", e => { if (e.target === sheet) sheet.hidden = true; });
  document.addEventListener("keydown", e => { if (e.key === "Escape") sheet.hidden = true; });
  $("demoReset").addEventListener("click", async e => { const b = e.currentTarget; if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Yakin? Semua data demo kembali awal"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Reset demo"; }, 4000); return; }
    b.disabled = true; b.textContent = "Mengembalikan…"; await window.LB_DEMO.reset(); try { localStorage.removeItem("lb-preview-token"); sessionStorage.removeItem("lb-preview-token"); } catch {} try { const a = JSON.parse(window.name || "{}"); if (a.kv) delete a.kv["lb-preview-token"]; window.name = JSON.stringify(a); } catch {} location.reload(); });
})();
