/* Lash Bounty ERP v1.1.0 — aplikasi (berjalan di atas js/lb-standalone.js) */
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const BLN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const HARI = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const fmt = n => new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
  const rp = n => "Rp " + fmt(n);
  const rpShort = n => { n = n || 0; if (Math.abs(n) >= 1e9) return "Rp " + (n/1e9).toFixed(2).replace(".", ",") + " M"; if (Math.abs(n) >= 1e6) return "Rp " + (n/1e6).toFixed(1).replace(".", ",") + " jt"; return rp(n); };
  const pct = x => (x*100).toFixed(1).replace(".", ",") + "%";
  const mKey = d => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
  // token rentang: "2026-10" (bulan), "2026-Q4", "2026-H2", "2026-Y"
  const isTok = k => /-(Q[1-4]|H[12]|Y)$/.test(String(k));
  const tokKeys = k => { if (!isTok(k)) return [k]; const [y, t] = k.split("-"); const n = t === "Y" ? 12 : t[0] === "H" ? 6 : 3, s0 = t === "Y" ? 1 : (+t[1] - 1) * n + 1; return Array.from({ length:n }, (_, i) => y + "-" + String(s0 + i).padStart(2, "0")); };
  const tokOf = (k, span) => { const [y, m] = k.split("-").map(Number); return span === 12 ? y + "-Y" : span === 6 ? y + "-H" + (m <= 6 ? 1 : 2) : span === 3 ? y + "-Q" + Math.ceil(m / 3) : k; };
  const mName = k => { if (isTok(k)) { const [y, t] = k.split("-"); return t === "Y" ? "Tahun " + y : t[0] === "H" ? "Semester " + t[1] + " " + y : t + " " + y; } const [y,m] = k.split("-"); return BLN[+m-1] + " " + y; };
  const prevMonth = k => { const [y,m] = k.split("-").map(Number); return mKey(new Date(y, m-2, 1)); };
  const nextKey = k => { const [y,m] = k.split("-").map(Number); return mKey(new Date(y, m, 1)); };
  const prevKey = k => { if (!isTok(k)) return prevMonth(k); const ks = tokKeys(k); let p = ks[0]; for (let i = 0; i < ks.length; i++) p = prevMonth(p); return tokOf(p, ks.length); };
  const firstKey = k => tokKeys(k)[0], lastKey = k => { const ks = tokKeys(k); return ks[ks.length - 1]; };
  // periode tutup buku: 27 bulan lalu s/d 26 bulan ini, diberi nama bulan akhirnya
  const perOf = iso => { const k = String(iso).slice(0,7); return +String(iso).slice(8,10) >= 27 ? nextKey(k) : k; };
  const perStart = k => prevMonth(firstKey(k)) + "-27", perEnd = k => lastKey(k) + "-26";
  const inPer = (iso, k) => !!iso && iso >= perStart(k) && iso <= perEnd(k);
  const perBulans = k => { const p = prevKey(k); return [prevMonth(firstKey(p)), ...tokKeys(p), ...tokKeys(k)]; };
  const perRange = k => { const a = perStart(k).split("-").map(Number), b = perEnd(k).split("-").map(Number);
    return a[2] + " " + BLN[a[1]-1].slice(0,3) + (a[0] !== b[0] ? " " + a[0] : "") + " – " + b[2] + " " + BLN[b[1]-1].slice(0,3) + " " + b[0]; };
  const perName = k => isTok(k) ? mName(k) : "Periode " + mName(k);
  const isoOf = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const perDays = k => { const out = []; const [y,m,dd] = perStart(k).split("-").map(Number), end = perEnd(k); for (let d = new Date(y, m-1, dd); isoOf(d) <= end; d.setDate(d.getDate()+1)) out.push(isoOf(d)); return out; };
  const todayISO = () => { const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
  function fmtDate(iso){ if(!iso) return ""; const [y,m,d]=iso.split("-"); return +d + " " + BLN[+m-1].slice(0,3) + " " + y; }
  function fmtDay(iso){ const [y,m,d]=iso.split("-").map(Number); return HARI[new Date(y,m-1,d).getDay()] + ", " + d + " " + BLN[m-1] + " " + y; }
  const shortCab = c => c === "Pusat" ? "Kantor Pusat" : String(c||"").replace(/^cabang\s+/i,"");
  const ls = { get(k){ try { return localStorage.getItem(k); } catch { return null; } }, set(k,v){ try { localStorage.setItem(k,v); } catch {} } };

  const S = { db:null, user:null, sample:null, dl:null, uid:null, admin:false,
    cfg:null, cfgLoaded:false, rows:[], rowsLoaded:false, month:null, unsubRows:null, aiCtl:null, booted:false };

  let toastT; function toast(msg){ const t=$("toast"); t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,2600); }

  /* ---------- period selector ---------- */
  S.span = [1,3,6,12].includes(+ls.get("rpc-span")) ? +ls.get("rpc-span") : 1;
  S.rk = tokOf(perOf(todayISO()), S.span);
  function anchorMonth(){ const ks = tokKeys(S.rk), cur = perOf(todayISO()); return ks.includes(cur) ? cur : cur > ks[ks.length - 1] ? ks[ks.length - 1] : ks[0]; }
  S.month = anchorMonth();
  function buildPerSel(){
    const cur = perOf(todayISO()), opts = [];
    if (S.span === 1) { opts.push(nextKey(cur)); let k = cur; for (let i = 0; i < 13; i++) { opts.push(k); k = prevMonth(k); } }
    else { let t = tokOf(cur, S.span); for (let i = 0; i < (S.span === 12 ? 3 : S.span === 6 ? 4 : 6); i++) { opts.push(t); t = prevKey(t); } }
    if (!opts.includes(S.rk)) opts.push(S.rk);
    $("monthSel").innerHTML = opts.map(k => `<option value="${k}">${mName(k)} · ${perRange(k)}</option>`).join(""); $("monthSel").value = S.rk; $("spanSel").value = String(S.span);
  }
  function setPeriod(rk){ S.rk = rk; S.month = anchorMonth(); buildPerSel(); resubscribe(); renderAll(); }
  function jumpTo(iso){ if (!S.db || inPer(iso, S.rk)) return; const k = tokOf(perOf(iso), S.span); setPeriod(k); }
  function resubscribe(){ subscribeRows(); subscribeSales(); subscribePusat(); subscribeHr(); }
  buildPerSel();
  $("monthSel").addEventListener("change", e => setPeriod(e.target.value));
  $("spanSel").addEventListener("change", e => { S.span = +e.target.value; ls.set("rpc-span", String(S.span)); setPeriod(tokOf(S.month, S.span)); });
  // multi-query: "in" maksimal 3 bulan per query supaya tidak tembus batas 1000 dokumen
  function subMany(coll, field, values, cb, onErr){
    const parts = []; for (let i = 0; i < values.length; i += 3) parts.push(values.slice(i, i + 3));
    const res = parts.map(() => null);
    const uns = parts.map((p, i) => S.db.collection(coll).where(field, "in", p).limit(1000).onSnapshot(sn => { res[i] = sn.docs.map(d => ({ id:d.id, ...d.data() })); if (res.every(Boolean)) cb(res.flat()); }, onErr));
    return () => uns.forEach(u => u && u());
  }

  /* ---------- tabs & link mode ---------- */
  // ---- navigasi 3 tingkat: kolom utama → sekunder → tersier
  const tabs = ["dash","input","biaya","rekap","omzet","stok","pusat","hrd","impor","tutup","atur","absen","ask","bank","cust","minta","refund"];
  const ADMIN_TABS = ["dash","pusat","hrd","impor","tutup"], STAFF_TABS = ["input","stok","absen","minta"], MONTHLY_TABS = ["stok","hrd"];
  const NAV = [
    { id:"dash", label:"Dashboard", mod:"dash", sec:[{ id:"ringkasan", label:"Ringkasan" }, { id:"notif", label:"Notifikasi" }, { id:"compare", label:"Bandingkan bulan" }, { id:"mobile", label:"Mobile" }] },
    { id:"acc", label:"Accounting", sec:[
      { id:"jurnal", label:"Jurnal Pengeluaran", ter:[{ id:"input", label:"Input Pengeluaran", mod:"acc_input" }, { id:"biaya", label:"Biaya Cabang", mod:"acc_biaya" }, { id:"report", label:"Report Pengeluaran", mod:"acc_report" }, { id:"pusat", label:"Pengeluaran Pusat", mod:"acc_pusat" }] },
      { id:"omzet", label:"Omzet", mod:"acc_omzet", ter:[{ id:"input", label:"Input Omzet" }, { id:"report", label:"Report Omzet" }] },
      { id:"tutup", label:"Tutup Buku", mod:"acc_tutup", ter:[{ id:"cek", label:"Checklist & kunci" }, { id:"simple", label:"Simple" }, { id:"wendy", label:"Cabang Wendy" }, { id:"global", label:"Global" }, { id:"expert", label:"Expertise" }, { id:"edit", label:"Edit & Penyesuaian" }, { id:"riwayat", label:"Riwayat" }] },
      { id:"impor", label:"Import", mod:"acc_impor", ter:[{ id:"csv", label:"CSV / Excel / PDF" }, { id:"ai", label:"Import AI (chat)" }] },
      { id:"refund", label:"Refund", mod:"acc_refund" } ] },
    { id:"bank", label:"Banking", mod:"bank", sec:[{ id:"cocok", label:"Crosscheck Mutasi" }, { id:"mutasi", label:"Upload Mutasi" }, { id:"saldo", label:"Saldo Bank" }, { id:"tabungan", label:"Tabungan Sewa" }, { id:"rekening", label:"Rekening" }] },
    { id:"cust", label:"Customer", mod:"cust", sec:[{ id:"db", label:"Database" }, { id:"tx", label:"Transaksi & Import" }] },
    { id:"inv", label:"Persediaan", sec:[
      { id:"stok", label:"Stok Barang", mod:"inv_stok", ter:[{ id:"input", label:"Input Stok" }, { id:"kartu", label:"Kartu Stok" }, { id:"posisi", label:"Posisi Stok" }, { id:"riwayat", label:"Riwayat" }, { id:"grafik", label:"Grafik Pemakaian" }] },
      { id:"minta", label:"Permintaan Barang", mod:"inv_minta" },
      { id:"aset", label:"Aset", mod:"inv_aset" } ] },
    { id:"hrd", label:"HRD", mod:"hrd", sec:[{ id:"karyawan", label:"Data Karyawan" }, { id:"absensi", label:"Absensi" }, { id:"payroll", label:"Payroll" }, { id:"kpi", label:"KPI", mod:"hrd_kpi" }, { id:"kasbon", label:"Kasbon" }, { id:"umum", label:"Pengumuman" }, { id:"slip", label:"Cek Slip" }] },
    { id:"ask", label:"Ask Me!", mod:"ask", sec:[{ id:"ai", label:"Ask Me! (AI)" }, { id:"boss", label:"Ask Boss" }] },
    { id:"set", label:"Pengaturan", mod:"set", sec:[{ id:"cabang", label:"Cabang & link" }, { id:"barang", label:"Barang stok" }, { id:"notif", label:"Notifikasi & absensi" }, { id:"role", label:"Role & akses" }, { id:"log", label:"Riwayat perubahan" }, { id:"integrasi", label:"Integrasi & logo" }, { id:"data", label:"Data & backup" }, { id:"akun", label:"Akun saya", mod:"self" }] }
  ];
  const LEAVES = []; NAV.forEach(m => { if (!m.sec) LEAVES.push({ key:m.id, mod:m.mod, m }); else m.sec.forEach(s2 => { if (!s2.ter) LEAVES.push({ key:m.id + "/" + s2.id, mod:s2.mod || m.mod, m, s:s2 }); else s2.ter.forEach(t => LEAVES.push({ key:m.id + "/" + s2.id + "/" + t.id, mod:t.mod || s2.mod || m.mod, m, s:s2, t })); }); });
  const LEGACY = { dash:"dash/ringkasan", input:"acc/jurnal/input", biaya:"acc/jurnal/biaya", rekap:"acc/jurnal/report", pusat:"acc/jurnal/pusat", omzet:"acc/omzet", tutup:"acc/tutup", impor:"acc/impor", stok:"inv/stok", minta:"inv/minta", refund:"acc/refund", ask:"ask", atur:"set", absen:"absen", bank:"bank", cust:"cust" };
  const legacyOf = k => k === "absen" ? "absen" : k.startsWith("ask") ? "ask" : k.startsWith("bank") ? "bank" : k.startsWith("cust") ? "cust" : k.startsWith("dash") ? "dash" : k === "acc/jurnal/input" ? "input" : k === "acc/jurnal/biaya" ? "biaya" : k === "acc/jurnal/report" ? "rekap" : k === "acc/jurnal/pusat" ? "pusat" :
    k.startsWith("acc/omzet") ? "omzet" : k.startsWith("acc/tutup") ? "tutup" : k.startsWith("acc/impor") ? "impor" : k === "acc/refund" ? "refund" : k === "inv/minta" ? "minta" : k.startsWith("inv") ? "stok" : k.startsWith("hrd") ? "hrd" : k.startsWith("set") ? "atur" : "input";
  // role & level akses (0 tidak, 1 lihat, 2 edit)
  const MODS = [["dash","Dashboard"],["acc_input","Input pengeluaran (petty cash)"],["acc_biaya","Biaya cabang"],["acc_report","Report pengeluaran"],["acc_pusat","Pengeluaran pusat"],["acc_omzet","Omzet"],["acc_tutup","Tutup buku"],["acc_impor","Import CSV / AI"],["acc_refund","Refund"],["inv_stok","Stok barang"],["inv_minta","Permintaan barang"],["inv_aset","Aset"],["hrd","HRD"],["hrd_kpi","KPI karyawan"],["bank","Banking (khusus Owner & Head of admin)"],["cust","Database customer"],["ask","Ask Me! & Ask Boss"],["set","Pengaturan"],["self","Akun saya (ganti password & tanda tangan)"]];
  const ROLES_DEF = { owner:"Owner", head:"Head of admin", admin:"Admin keuangan", hrd:"HRD", manager:"Manager cabang", trainer:"Trainer", staff:"Staff cabang" };
  const allMods = v => Object.fromEntries(MODS.map(([m]) => [m, v]));
  const MATRIX_DEF = { owner: allMods(2), head: allMods(2), admin: { ...allMods(2), set:1, bank:0 },
    hrd: { ...allMods(0), hrd:2, hrd_kpi:2, ask:2, dash:1, self:2 },
    manager: { ...allMods(0), dash:1, acc_input:2, acc_report:1, acc_omzet:1, inv_stok:2, inv_minta:2, inv_aset:1, ask:2, self:2 },
    trainer: { ...allMods(0), acc_input:2, inv_stok:2, inv_minta:2, hrd_kpi:2, ask:2, self:2 },
    staff: { ...allMods(0), acc_input:2, inv_stok:2, inv_minta:2, ask:2, self:2 } };
  function myRole(){ return S.appUser?.role && ROLES_DEF[S.appUser.role] ? S.appUser.role : ""; }
  function perm(mod){ if (!S.booted || !S.db || !S.appUser) return 2; const r = myRole(); if (r === "owner") return 2; if (!r) return 0; if (mod === "bank" && r !== "head") return 0; const M = { ...MATRIX_DEF[r], ...(S.roles?.matrix?.[r] || {}) }; return M[mod] ?? 0; }
  const lvlOf = key => { if (key === "absen") return 2; const L = LEAVES.find(x => x.key === key); return L ? perm(L.mod) : 0; };
  const STAFF_EYEBROW = { minta:"Permintaan barang · ke kantor pusat", input:"Input pengeluaran · petty cash", stok:"Stock opname · hitung stok", absen:"Absensi · check-in masuk & pulang" };
  S.leaf = "";
  function go(key){
    let k2 = key;
    const staffLeaf = document.body.classList.contains("staff") && ["acc/jurnal/input","inv/stok/input","absen","inv/minta"].includes(key);
    if (!staffLeaf) {
      let L = LEAVES.find(x => x.key === key);
      if (!L || lvlOf(L.key) === 0) {
        const cands = LEAVES.filter(x => (x.key === key || x.key.startsWith(key + "/")) && lvlOf(x.key) > 0);
        const rem = ls.get("lb-leaf-" + key); L = cands.find(x => x.key === rem) || cands[0] || LEAVES.find(x => lvlOf(x.key) > 0) || LEAVES.find(x => x.key === "ask");
      }
      k2 = L.key;
    }
    S.leaf = k2; S.tab = legacyOf(k2);
    const parts = k2.split("/");
    if (parts.length > 1) { ls.set("lb-leaf-" + parts[0], k2); if (parts.length > 2) ls.set("lb-leaf-" + parts[0] + "/" + parts[1], k2); }
    if (parts[0] === "hrd") { S.hrdSub = parts[1]; ls.set("rpc-hrd", parts[1]); }
    if (parts[0] === "inv") S.pSub = parts[1] === "aset" ? "aset" : "stok";
    document.querySelectorAll("[data-pg]").forEach(el => { el.hidden = !el.dataset.pg.split(" ").some(p => k2 === p || k2.startsWith(p + "/")); });
    document.body.classList.toggle("ro", !staffLeaf && lvlOf(k2) === 1);
    $("segInput").setAttribute("aria-pressed", S.tab === "input"); $("segStok").setAttribute("aria-pressed", S.tab === "stok"); $("segAbsen").setAttribute("aria-pressed", S.tab === "absen"); $("segMinta").setAttribute("aria-pressed", S.tab === "minta");
    $("staffEyebrow").textContent = STAFF_EYEBROW[S.tab] || STAFF_EYEBROW.input;
    ls.set(document.body.classList.contains("staff") ? "rpc-staff-tab" : "lb-leaf", document.body.classList.contains("staff") ? S.tab : k2);
    $("slipPanel").hidden = $("slipPanel").hidden || !(k2 === "hrd/payroll" || k2 === "hrd/slip");
    renderNav(); renderPerNote();
    if (S.booted) { if (k2 === "hrd/slip") loadSlipHist(); setTimeout(renderAll, 0); }
  }
  function showTab(t){ if (!tabs.includes(t)) t = "input"; if (t === "absen" && !document.body.classList.contains("staff")) t = "hrd";
    if (legacyOf(S.leaf || "") === t && S.leaf) return go(S.leaf);
    go(t === "hrd" ? "hrd/" + (S.hrdSub || "payroll") : document.body.classList.contains("staff") && t === "stok" ? "inv/stok/input" : LEGACY[t] || t); }
  function navBadge(key){ if (!S.booted) return ""; try { const n = key === "dash/notif" ? bigList().filter(x => !x.cek).length : key === "ask/boss" ? abUnread() : key === "bank/cocok" ? bankOpen() : key === "inv/minta" ? (S.admin ? (S.minta || []).filter(p => p.status === "menunggu" || mtLate(p)).length : 0) : key === "acc/refund" ? (isAppOwner() ? (S.refund || []).filter(r => r.status === "diajukan").length : 0) : 0; return n ? ` <span class="nbadge">${n}</span>` : ""; } catch { return ""; } }
  function renderNav(){
    const k = S.leaf || "", [m, sc] = k.split("/");
    document.querySelectorAll("#mainNav [data-main]").forEach(b => { const id = b.dataset.main; b.setAttribute("aria-selected", id === m); b.hidden = !LEAVES.some(x => x.m.id === id && lvlOf(x.key) > 0);
      const lb = (NAV.find(x => x.id === id)?.label || id) + (id === "ask" ? navBadge("ask/boss") : id === "bank" ? navBadge("bank/cocok") : id === "inv" ? navBadge("inv/minta") : id === "acc" ? navBadge("acc/refund") : ""); if (b.dataset.lb !== lb) { b.dataset.lb = lb; b.innerHTML = lb.replace(/^[^<]+/, t => esc(t)); } });
    const M = NAV.find(x => x.id === m), secs = (M?.sec || []).filter(s2 => LEAVES.some(x => x.s === s2 && lvlOf(x.key) > 0));
    $("secNav").hidden = !secs.length; $("secNav").innerHTML = secs.map(s2 => `<button type="button" data-nav="${m}/${s2.id}" aria-pressed="${s2.id === sc}">${esc(s2.label)}${navBadge(m + "/" + s2.id)}</button>`).join("");
    const S2 = M?.sec?.find(x => x.id === sc), ters = (S2?.ter || []).filter(t => lvlOf(m + "/" + sc + "/" + t.id) > 0);
    $("terNav").hidden = !ters.length; $("terNav").innerHTML = ters.map(t => `<button type="button" data-nav="${m}/${sc}/${t.id}" aria-pressed="${k === m + "/" + sc + "/" + t.id}">${esc(t.label)}</button>`).join("");
  }
  function renderPerNote(){ const n = $("perNote"); const on = S.span > 1 && MONTHLY_TABS.includes(S.tab); n.hidden = !on; if (on) n.textContent = "Halaman ini dihitung per bulan: " + perName(S.month) + " (" + perRange(S.month) + ")."; }
  document.querySelectorAll("#mainNav [data-main]").forEach(b => b.addEventListener("click", () => { go(b.dataset.main); window.scrollTo({ top:0 }); }));
  ["secNav","terNav"].forEach(id => $(id).addEventListener("click", e => { const b = e.target.closest("[data-nav]"); if (b) go(b.dataset.nav); }));
  document.querySelectorAll("#staffHead .seg button").forEach(b=>b.addEventListener("click",()=>{ showTab(b.dataset.go); window.scrollTo({top:0}); }));
  const SA = window.LB_STANDALONE;
  const ARTIFACT_URL = SA.appUrl.replace(/\/$/, "") + "/";
  const slug = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/^cabang\s+/,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  const alias = { jurnal:"rekap", pengeluaran:"rekap", report:"rekap", pengaturan:"atur", persediaan:"stok", payroll:"hrd", kpi:"hrd", absensi:"hrd", slip:"hrd", karyawan:"hrd", import:"impor", "tutup-buku":"tutup", accounting:"acc", "ask-me":"ask" };
  const rawHash = () => decodeURIComponent((location.hash||"").slice(1)).toLowerCase();
  const readHash = () => { const h = rawHash(); return alias[h] || h; };
  const isNavKey = t => LEAVES.some(x => x.key === t || x.key.startsWith(t + "/"));
  const isStaffTok = t => !!t && !tabs.includes(t) && !isNavKey(t);
  S.hashTok = readHash();
  if (isStaffTok(S.hashTok)) { document.body.classList.add("staff"); $("cabField").hidden=true; S.span = 1; S.rk = S.month; }
  if (document.body.classList.contains("staff")) $("oCabField").hidden=true;
  function routeHash(initial){
    const h = S.hashTok, raw = rawHash(), staff = document.body.classList.contains("staff");
    if (["payroll","kpi","absensi","slip","karyawan"].includes(raw)) S.hrdSub = raw;
    if (staff) { const saved = ls.get("rpc-staff-tab"); return showTab(h.startsWith("absen-") ? "absen" : (STAFF_TABS.includes(saved) && saved !== "absen" ? saved : "input")); }
    if (isNavKey(h)) { S.tabFromUser = true; return go(h); }
    if (tabs.includes(h)) { S.tabFromUser = true; return showTab(h); }
    if (initial) { const saved = ls.get("lb-leaf"); S.tabFromUser = !!saved && isNavKey(saved); return go(S.tabFromUser ? saved : "acc/jurnal/input"); }
  }
  routeHash(true);
  function applyMode(){
    const tok=S.hashTok; if (!isStaffTok(tok)) { S.staff=null; document.body.classList.remove("staff"); $("cabField").hidden=false; $("oCabField").hidden=false; return; }
    if (!S.cfgLoaded) return;
    const ct = tok.replace(/^absen-/, ""), c = cabList().find(x=>slug(x)===ct) || null;
    S.staff = c; document.body.classList.add("staff"); $("cabField").hidden = true; $("oCabField").hidden = true;
    if (!STAFF_TABS.includes(S.tab)) showTab("input");
    if (c) { $("staffName").textContent = c; if ($("fCabang").value!==c) $("fCabang").value = c; if ($("oCabang").value!==c) $("oCabang").value = c; $("saveBtn").disabled=false; $("opSave").disabled=false; }
    else { $("staffName").textContent = "Link cabang tidak dikenal"; $("saveBtn").disabled=true; $("opSave").disabled=true; }
  }
  window.addEventListener("hashchange", () => { S.hashTok = readHash(); applyMode(); routeHash(false); renderAll(); });

  /* ---------- config ---------- */
  const cabList = () => (S.cfg?.cabang || []).map(c=>typeof c==="string"?c:c?.nama).filter(Boolean);
  function fillSelect(sel, items, keep, placeholder){ const v = keep ?? sel.value; sel.innerHTML = (placeholder?`<option value="">${placeholder}</option>`:"") + items.map(x=>`<option value="${esc(x)}">${esc(x === "Pusat" ? "Kantor Pusat" : x)}</option>`).join(""); if (items.includes(v)) sel.value=v; }

  /* ---------- form ---------- */
  $("fTanggal").value = todayISO();
  const jumlahEl = $("fJumlah");
  const parseRp = s => Number(String(s).replace(/[^\d]/g,"")) || 0;
  jumlahEl.addEventListener("input", () => { const n=parseRp(jumlahEl.value); jumlahEl.value = n ? fmt(n) : ""; });
  $("fCabang").addEventListener("change", e => { ls.set("rpc-cabang", e.target.value); });
  $("fTanggal").addEventListener("change", updateGoesTo);
  function updateGoesTo(){ const v=$("fTanggal").value; $("goesTo").textContent = v ? "Masuk jurnal " + mName(v.slice(0,7)) : ""; }
  updateGoesTo();

  // nama pengisi: satu nama per HP, dipakai di semua form
  const pengisiInputs = () => [...document.querySelectorAll("input.pengisi")];
  { const saved = ls.get("rpc-pengisi") || ""; pengisiInputs().forEach(i => i.value = saved); }
  document.addEventListener("input", e => { if (!e.target.classList?.contains("pengisi")) return; const v = e.target.value; ls.set("rpc-pengisi", v.trim());
    pengisiInputs().forEach(i => { if (i !== e.target) i.value = v; }); });
  const pengisiOf = id => $(id).value.trim();

  // rincian belanja manual (tanpa struk)
  S.rinci = [{ barang:"", qty:1, harga:0 }];
  const rinciTotal = () => S.rinci.reduce((s, r) => s + (Number(r.qty) || 0) * (r.harga || 0), 0);
  function renderRinci(){
    $("rinci").innerHTML = S.rinci.map((r, i) => `<div class="rin-row">
      <input type="text" data-ri="${i}" data-rf="barang" value="${esc(r.barang)}" placeholder="Contoh: Gas LPG 3 kg" aria-label="Nama barang" maxlength="60">
      <input type="text" data-ri="${i}" data-rf="qty" value="${esc(r.qty)}" inputmode="decimal" aria-label="Qty">
      <div class="rp"><span>Rp</span><input type="text" data-ri="${i}" data-rf="harga" value="${r.harga ? fmt(r.harga) : ""}" inputmode="numeric" placeholder="0" aria-label="Harga satuan"></div>
      <button class="btn ghost danger" type="button" data-rdel="${i}" aria-label="Hapus barang" ${S.rinci.length < 2 ? "disabled" : ""}>✕</button></div>`).join("");
    syncRinciTotal();
  }
  function syncRinciTotal(){ if ($("fNoStruk").checked) { const t = rinciTotal(); jumlahEl.value = t ? fmt(t) : ""; } }
  $("rinci").addEventListener("input", e => { const t = e.target; if (t.dataset.ri === undefined) return; const r = S.rinci[+t.dataset.ri];
    if (t.dataset.rf === "harga") { const n = parseRp(t.value); t.value = n ? fmt(n) : ""; r.harga = n; }
    else if (t.dataset.rf === "qty") r.qty = String(t.value).replace(",", ".");
    else r.barang = t.value;
    syncRinciTotal(); });
  $("rinci").addEventListener("click", e => { const b = e.target.closest("[data-rdel]"); if (!b) return; S.rinci.splice(+b.dataset.rdel, 1); renderRinci(); });
  $("addRinci").addEventListener("click", () => { S.rinci.push({ barang:"", qty:1, harga:0 }); renderRinci(); $("rinci").querySelectorAll('input[data-rf="barang"]')[S.rinci.length - 1]?.focus(); });
  function setNoStruk(on){
    $("fNoStruk").checked = on; $("rinciField").hidden = !on; $("notaField").hidden = on;
    jumlahEl.readOnly = on; jumlahEl.closest(".rp").style.opacity = on ? ".75" : "";
    $("scanBox").hidden = !S.scanAvail || on;
    if (on) { $("fNota").value = ""; renderRinci(); } else { jumlahEl.value = ""; }
  }
  $("fNoStruk").addEventListener("change", e => setNoStruk(e.target.checked));
  renderRinci();

  $("form").addEventListener("submit", async e => {
    e.preventDefault();
    const msg=$("formMsg"), noStruk = $("fNoStruk").checked;
    if (!S.db) { msg.textContent="Server belum tersambung. Cek koneksi lalu muat ulang halaman."; return; }
    const doc = { cabang:$("fCabang").value, tanggal:$("fTanggal").value, jumlah:parseRp(jumlahEl.value), keterangan:$("fKet").value.trim(), nota: noStruk ? "" : $("fNota").value.trim(), pengisi: pengisiOf("fPengisi") };
    if (!doc.cabang) { msg.textContent="Pilih cabang dulu."; return; }
    if (!doc.tanggal) { msg.textContent="Isi tanggal."; return; }
    { const lk = lockOf(doc.tanggal); if (lk) { msg.textContent = lk; return; } }
    if (noStruk) {
      const rows = S.rinci.map(r => ({ barang:String(r.barang||"").trim(), qty:Number(r.qty) || 0, harga:r.harga || 0 })).filter(r => r.barang || r.harga);
      if (!rows.length) { msg.textContent="Isi minimal 1 barang di rincian belanja."; return; }
      if (rows.some(r => !r.barang || r.qty <= 0 || r.harga <= 0)) { msg.textContent="Lengkapi rincian: nama barang, qty, dan harga satuan."; return; }
      doc.tanpaStruk = true; doc.rincian = rows; doc.jumlah = rows.reduce((s, r) => s + r.qty * r.harga, 0);
      if (!doc.keterangan) doc.keterangan = rows.map(r => r.barang).slice(0, 3).join(", ") + (rows.length > 3 ? ", dll" : "");
    }
    if (doc.jumlah <= 0) { msg.textContent="Jumlah harus lebih dari 0."; jumlahEl.focus(); return; }
    if (!doc.keterangan) { msg.textContent="Isi keterangan singkat."; $("fKet").focus(); return; }
    if (!doc.pengisi) { msg.textContent="Isi nama pengisi."; $("fPengisi").focus(); return; }
    doc.bulan = doc.tanggal.slice(0,7); doc.by = S.uid || null; doc.at = new Date().toISOString(); doc.contoh = false;
    const btn=$("saveBtn"); btn.disabled=true; msg.textContent="Menyimpan…";
    try {
      const ref = await S.db.collection("expenses").add(doc);
      msg.textContent=""; setWa($("okWa"), doc, "expenses", ref?.id);
      $("okTitle").textContent = "Tersimpan · " + rp(doc.jumlah);
      $("okSub").textContent = "Petty cash " + shortCab(doc.cabang) + " · " + fmtDate(doc.tanggal) + (noStruk ? " · tanpa struk" : "") + ". Silakan catat berikutnya.";
      $("okBox").hidden = false; window.scrollTo({ top:0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      clearTimeout(S.okT); S.okT = setTimeout(()=>{ $("okBox").hidden=true; }, $("okWa").hidden ? 8000 : 60000);
      jumlahEl.value=""; $("fKet").value=""; $("fNota").value="";
      S.rinci = [{ barang:"", qty:1, harga:0 }]; setNoStruk(false);
      jumpTo(doc.tanggal);
    } catch (err) {
      msg.textContent = err?.code==="invalid_argument" ? "Akun kamu belum punya akses untuk menyimpan ini. Hubungi admin." :
        err?.code==="quota_exceeded" ? "Penyimpanan penuh. Minta admin hapus data lama." : "Gagal menyimpan, coba lagi sebentar.";
    } finally { btn.disabled = !!(isStaffTok(S.hashTok) && !S.staff && S.cfgLoaded); }
  });

  /* ---------- AI scan nota ---------- */
  $("scanFile").addEventListener("change", async e => {
    const file = e.target.files?.[0]; e.target.value=""; if (!file || !S.sample) return;
    const btn=$("scanBtn"), msg=$("formMsg"); btn.textContent="Membaca nota…"; msg.textContent="";
    try {
      const out = await S.sample.json(
        "Gambar ini adalah foto nota/struk pengeluaran petty cash sebuah usaha di Indonesia. Ambil datanya.\n" +
        "Balas hanya JSON dengan bentuk: {\"tanggal\":\"YYYY-MM-DD atau null\",\"jumlah\":angka total akhir dalam rupiah tanpa titik atau null,\"keterangan\":\"ringkas maks 8 kata, bahasa Indonesia, sebut barang/jasa yang dibeli\",\"nota\":\"nomor nota/struk atau null\"}. Isi null kalau tidak yakin.",
        { images:[file], modelTier:"default" });
      let n=0;
      if (out?.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(out.tanggal)) { $("fTanggal").value=out.tanggal; updateGoesTo(); n++; }
      if (Number(out?.jumlah) > 0) { jumlahEl.value=fmt(Number(out.jumlah)); n++; }
      if (out?.keterangan) { $("fKet").value=String(out.keterangan).slice(0,140); n++; }
      if (out?.nota) { $("fNota").value=String(out.nota).slice(0,40); n++; }
      msg.textContent = n ? "Terisi dari nota. Cek angkanya, lalu simpan." : "Nota tidak terbaca jelas. Isi manual ya.";
    } catch (err) {
      if (["not_granted","sampling_disabled","not_declared","capability_disabled","capability_removed","images_unavailable"].includes(err?.code)) { $("scanBox").hidden=true; msg.textContent="Scan AI tidak tersedia di tampilan ini."; }
      else if (err?.code==="rate_limited") msg.textContent="Terlalu banyak permintaan. Coba lagi beberapa menit lagi.";
      else if (err?.code==="image_rejected") msg.textContent="Foto tidak bisa dibaca. Coba foto lain (JPG/PNG, lebih terang).";
      else if (err?.code!=="cancelled") msg.textContent="Gagal membaca nota. Coba lagi atau isi manual.";
    } finally { btn.textContent="Pilih foto nota"; }
  });

  /* ---------- data ---------- */
  function subscribeRows(){
    if (!S.db) return;
    if (S.unsubRows) S.unsubRows();
    S.rowsLoaded=false; renderAll();
    S.unsubRows = subMany("expenses", "bulan", perBulans(S.rk), docs => { S.rows = docs; S.rowsLoaded=true; renderAll(); },
      () => { S.rowsLoaded=true; renderAll(); toast("Data tidak bisa dimuat. Muat ulang halaman."); });
  }

  const byDate = (a,b) => (a.tanggal||"").localeCompare(b.tanggal||"") || (a.at||"").localeCompare(b.at||"") || (a.cabang||"").localeCompare(b.cabang||"");
  function agg(){
    const cur = S.rows.filter(r=>inPer(r.tanggal,S.rk)).sort(byDate), prev = S.rows.filter(r=>inPer(r.tanggal,prevKey(S.rk)));
    const cabs = [...cabList()]; cur.concat(prev).forEach(r=>{ if (r.cabang && !cabs.includes(r.cabang)) cabs.push(r.cabang); });
    const by = {}; cabs.forEach(c => by[c] = { total:0, prev:0, n:0, max:0 });
    cur.forEach(r => { const b=by[r.cabang]; b.total+=r.jumlah||0; b.n++; b.max=Math.max(b.max, r.jumlah||0); });
    prev.forEach(r => { by[r.cabang].prev += r.jumlah||0; });
    const total = cur.reduce((s,r)=>s+(r.jumlah||0),0);
    const sudah = cabs.filter(c=>by[c].n>0);
    const prevFair = sudah.reduce((s,c)=>s+by[c].prev,0);
    // journal numbers: JP-YYMM-001 in date order
    const pre = "JP-" + S.rk.slice(2).replace("-", "") + "-";
    cur.forEach((r,i)=>{ r._no = pre + String(i+1).padStart(3,"0"); });
    // flags (per cabang)
    const pool={}; cur.concat(prev).forEach(r=>{ (pool[r.cabang] ??= []).push(r.jumlah||0); });
    const med={}; Object.entries(pool).forEach(([k,a])=>{ const s=[...a].sort((x,y)=>x-y); med[k]= s.length%2? s[(s.length-1)/2] : (s[s.length/2-1]+s[s.length/2])/2; });
    const notaCount={}; cur.forEach(r=>{ if (r.nota){ const key=r.cabang+"|"+r.nota.trim().toLowerCase(); notaCount[key]=(notaCount[key]||0)+1; }});
    const flags=[];
    cur.forEach(r=>{ const f=[];
      if ((pool[r.cabang]||[]).length>=6 && med[r.cabang]>0 && r.jumlah > 5*med[r.cabang] && r.jumlah >= 1000000) f.push("Nominal "+Math.round(r.jumlah/med[r.cabang])+"× dari biasanya");
      if (r.tanpaStruk) f.push("Tanpa struk"); else if (!r.nota) f.push("Tanpa no. nota");
      if (r.nota && notaCount[r.cabang+"|"+r.nota.trim().toLowerCase()]>1) f.push("No. nota dobel");
      if (f.length) flags.push({ r, f });
    });
    flags.sort((a,b)=>b.r.jumlah-a.r.jumlah);
    return { cur, prev, cabs, by, total, sudah, prevFair, flags };
  }

  /* ---------- render ---------- */
  function renderAll(){ renderSelects(); renderInput(); renderJurnal(); renderOmzet(); renderStok(); renderAset(); renderPusat(); renderPayroll(); renderKpi(); renderHrd(); renderAbsen(); renderImpor(); renderTutup(); renderBiaya(); renderRpt(); renderAsk(); renderRole(); renderLog(); renderDash(); renderAtur(); renderHrCfg(); renderTabs(); renderPerPill(); renderPerNote(); renderV15(); renderV11(); }
  function renderTabs(){
    const staff = document.body.classList.contains("staff");
    $("omManPanel").hidden = staff;
    if (staff) { $("pAset").hidden = true; }
    if (S.booted && S.leaf && S.leaf !== "absen" && !staff && lvlOf(S.leaf) === 0) { go(S.leaf.split("/")[0]); return; }
    renderNav(); renderUserChip(); }

  function renderSelects(){
    fillSelect($("zCabang"), cabList(), $("zCabang").value, cabList().length?null:"Belum ada cabang");
    { const keep = $("jmFilter").value; $("jmFilter").innerHTML = `<option value="">Semua cabang</option>` + optList([...cabList(), "Pusat"]); if ([...cabList(), "Pusat"].includes(keep)) $("jmFilter").value=keep; }
    const myC = !S.staff && myCab() && cabList().includes(myCab()) ? [myCab()] : cabList();
    fillSelect($("fCabang"), myC, $("fCabang").value || ls.get("rpc-cabang"), cabList().length?null:"Belum ada cabang");
    fillSelect($("oCabang"), myC, $("oCabang").value || ls.get("rpc-cabang"), cabList().length?null:"Belum ada cabang");
    fillSelect($("bcCabang"), [...cabList(), "Pusat"], $("bcCabang").value, cabList().length?null:"Belum ada cabang");
    fillSelect($("omCabang"), [...cabList(), "Pusat"], $("omCabang").value, cabList().length?null:"Belum ada cabang");
    if (!$("omKat").options.length) $("omKat").innerHTML = optList(OM_KAT);
    if (!$("bcKat").options.length) $("bcKat").innerHTML = optList(CAB_KAT);
    if (!$("pcKat").options.length) $("pcKat").innerHTML = optList(PST_KAT);
    { const kk = $("txKat").value; $("txKat").innerHTML = `<option value="">Semua kategori</option>` + optList(["Petty cash", ...CAB_KAT, "Payroll"], kk); }
    const keep = $("txFilter").value; $("txFilter").innerHTML = `<option value="">Semua cabang</option>` + cabList().map(c=>`<option>${esc(c)}</option>`).join(""); if (cabList().includes(keep)) $("txFilter").value=keep;
  }

  function renderInput(){
    applyMode();
    const st=$("inputState");
    if (!S.db && S.booted) { st.hidden=false; st.textContent="Server belum tersambung. Cek koneksi lalu muat ulang halaman."; }
    else if (S.cfgLoaded && !cabList().length) { st.hidden=false; st.textContent="Belum ada daftar cabang. Admin perlu mengisi cabang di Pengaturan."; }
    else if (S.cfgLoaded && isStaffTok(S.hashTok) && !S.staff) { st.hidden=false; st.textContent="Link ini tidak cocok dengan cabang mana pun. Minta link terbaru ke admin."; }
    else st.hidden=true;
  }

  // two-step delete (admin, journal table)
  document.addEventListener("click", async e => {
    const b = e.target.closest("[data-del]"); if (!b) return;
    if (b.dataset.armed!=="1") { b.dataset.armed="1"; b.textContent="Yakin?"; setTimeout(()=>{ if(b.isConnected){ b.dataset.armed=""; b.textContent="Hapus"; } },3000); return; }
    b.disabled=true;
    try { await S.db.doc("expenses/"+b.dataset.del).delete(); toast("Dihapus dari jurnal"); } catch { toast("Gagal menghapus"); b.disabled=false; }
  });

  /* ---------- grup cabang, kategori biaya ---------- */
  const CAB_KAT = ["Stok bahan (HPP)", "Sewa / mortgage", "IPL", "Listrik", "PAM / air", "Internet & telepon", "Perbaikan cabang", "Refund customer", "Biaya admin EDC & QR", "Ads / iklan", "Office + admin fee", "Lain-lain"];
  const CAB_KAT_ALL = [...CAB_KAT, "Listrik & air"];
  const PST_KAT = ["Marketing", "IPL HO", "Internet & telepon", "Listrik & air", "Kendaraan & leasing", "Sewa / mortgage", "Petty cash pusat", "Operasional trainer", "Penyesuaian kas", "Lain-lain"];
  const PST_SEC = { "Marketing": "exp", "IPL HO": "ho", "Internet & telepon": "ho", "Listrik & air": "ho", "Listrik": "ho", "Kendaraan & leasing": "ho", "Sewa / mortgage": "rent" }, pstSec = kat => PST_SEC[kat] || "oth";
  const cabCfg = () => (S.cfg?.cabang || []).map(c => typeof c === "string" ? { nama:c } : c).filter(c => c && c.nama);
  const grupOf = c => (cabCfg().find(x => x.nama === c)?.grup || "").trim() || "Lainnya";
  const grups = () => { const out = []; cabList().forEach(c => { const g = grupOf(c); if (!out.includes(g)) out.push(g); }); return out; };
  const cabsOfGrup = g => cabList().filter(c => grupOf(c) === g);
  const biayaNorm = p => ({ ...p, unit: p.unit || "Pusat", kategori: p.kategori || (p.akun === "Mortgage" ? "Sewa / mortgage" : "Petty cash pusat") });
  const biayaPer = k => S.ps.map(biayaNorm).filter(p => inPer(p.tanggal, k));
  const optList = (arr, keep) => arr.map(x => `<option value="${esc(x)}" ${x === keep ? "selected" : ""}>${esc(x === "Pusat" ? "Kantor Pusat" : x)}</option>`).join("");
  const sumOf = (arr, f) => arr.reduce((t, x) => t + (f(x) || 0), 0);

  /* ---------- jurnal pengeluaran cabang ---------- */
  function payrollByCab(k = S.month){ const o = {}; (S.prDocs[k]?.rows || []).forEach(r => { const c = r.cabang || "Pusat"; o[c] = (o[c] || 0) + thp(r, k); }); return o; }
  function jurnalLines(k){
    const L = [];
    S.rows.filter(r => inPer(r.tanggal, k)).forEach(r => L.push({ src:"pc", id:r.id, tanggal:r.tanggal, cabang:r.cabang, kat:"Petty cash", ket:r.keterangan, nota:r.nota, jumlah:r.jumlah || 0, r }));
    biayaPer(k).filter(p => p.unit !== "Pusat").forEach(p => L.push({ src:"bc", id:p.id, tanggal:p.tanggal, cabang:p.unit, kat:p.kategori, ket:p.keterangan, nota:p.nota, jumlah:p.jumlah || 0, r:p }));
    tokKeys(k).forEach(mk => { const P = S.prDocs[mk]; if (!P) return; Object.entries(payrollByCab(mk)).forEach(([c, v]) => { if (c !== "Pusat" && v) L.push({ src:"pr", id:null, tanggal:P.tglBayar || perEnd(mk), cabang:c, kat:"Payroll",
      ket:"Payroll " + perName(mk) + " · " + (P.rows || []).filter(r => r.cabang === c).length + " karyawan" + (P.status === "final" ? "" : " (draft)"), nota:"", jumlah:v, r:{ contoh:P.contoh } }); }); });
    return L.sort((a, b) => (a.tanggal||"").localeCompare(b.tanggal||"") || (a.cabang||"").localeCompare(b.cabang||""));
  }
  function renderJurnal(){
    const A = agg(), k = S.rk, L = jurnalLines(k), cabs = [...cabList()];
    $("bcPanel").hidden = S.booted && !S.admin;
    L.forEach(l => { if (l.cabang && !cabs.includes(l.cabang)) cabs.push(l.cabang); });
    const KCOLS = ["Petty cash", "HPP", "Bulanan", "Sewa / mortgage", "Lainnya", "Payroll"];
    const colOf = l => l.kat === "Petty cash" || l.kat === "Payroll" ? l.kat : ({ hpp:"HPP", bulanan:"Bulanan", sewa:"Sewa / mortgage", lain:"Lainnya" })[katGrp(l.kat)];
    const tot = (c, kat) => sumOf(L.filter(l => l.cabang === c && (!kat || colOf(l) === kat)), l => l.jumlah);
    const all = sumOf(L, l => l.jumlah), pc = sumOf(L.filter(l => l.kat === "Petty cash"), l => l.jumlah), py = sumOf(L.filter(l => l.kat === "Payroll"), l => l.jumlah);
    const belum = cabList().filter(c => !A.by[c]?.n);
    $("kpis").innerHTML = [
      ["Total pengeluaran cabang", `<span class="num">${rpShort(all)}</span>`, perRange(k)],
      ["Petty cash", `<span class="num">${rpShort(pc)}</span>`, belum.length ? "Belum setor: " + esc(belum.map(shortCab).join(", ")) : "semua cabang sudah setor"],
      ["Di luar petty cash", `<span class="num">${rpShort(all - pc - py)}</span>`, "sewa, listrik, perbaikan, dll"],
      ["Payroll cabang", `<span class="num">${rpShort(py)}</span>`, tokKeys(k).some(mk => S.prDocs[mk]) ? (k => { const ex = tokKeys(k).filter(mk => S.prDocs[mk]), f = ex.filter(mk => S.prDocs[mk].status === "final").length; return ex.length === 1 ? (f ? "sudah dibayar" : "draft") : f + " dari " + ex.length + " payroll sudah dibayar"; })(k) : (S.admin ? "payroll belum dibuat" : "khusus admin")]
    ].map(([l,v,s]) => `<div class="kpi"><span class="l">${l}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join("");
    $("cabHint").textContent = perRange(k);
    if (!cabs.length) $("cabTable").innerHTML = `<tr><td class="empty">Belum ada cabang. Tambahkan di tab Pengaturan.</td></tr>`;
    else {
      const rowFor = (label, list, cls) => `<tr class="${cls || ""}"><td>${label}</td>${KCOLS.map(kat => `<td class="r num">${fmtOrDash(sumOf(list, c => tot(c, kat)))}</td>`).join("")}<td class="r num"><b>${fmt(sumOf(list, c => tot(c)))}</b></td></tr>`;
      let h = `<thead><tr><th>Cabang</th>${KCOLS.map(x => `<th class="r">${esc(x)}</th>`).join("")}<th class="r">Total</th></tr></thead><tbody>`;
      grups().forEach(g => { const cs = cabsOfGrup(g); cs.forEach(c => { h += rowFor(`<b>${esc(c)}</b>${A.by[c]?.n ? "" : ` <span class="pill no" style="font-size:11px">PC belum setor</span>`}`, [c]); });
        if (grups().length > 1 || cs.length > 1) h += rowFor(`Subtotal ${esc(g)}`, cs, "sub"); });
      cabs.filter(c => !cabList().includes(c)).forEach(c => { h += rowFor(esc(c), [c]); });
      h += rowFor("Total semua cabang", cabs, "total") + `</tbody>`;
      $("cabTable").innerHTML = h;
    }
    $("flagCount").textContent = A.flags.length ? A.flags.length + " item" : "";
    $("flags").innerHTML = A.flags.length ? A.flags.slice(0,6).map(({r,f})=>`<div class="flag"><span class="pill warn">${esc(f[0])}</span><div class="w"><b>${esc(r.keterangan)}</b><span>${esc(r._no)} · ${esc(shortCab(r.cabang))} · ${esc(fmtDate(r.tanggal))}${f.length>1?" · "+esc(f.slice(1).join(", ")):""}</span></div><span class="num">${rp(r.jumlah)}</span></div>`).join("") + (A.flags.length>6?`<p class="note">+${A.flags.length-6} item lain, lihat jurnal di bawah.</p>`:"")
      : `<div class="empty">${A.cur.length?"Tidak ada yang janggal periode ini.":"Belum ada data."}</div>`;
    // jurnal
    const fv = $("txFilter").value, fk = $("txKat").value;
    $("jrTitle").textContent = (fv || "Semua cabang") + (fk ? " · " + fk : "") + " · " + perName(k);
    const flagMap = new Map(A.flags.map(x => [x.r.id, x.f]));
    const pre = "JP-" + k.slice(2).replace("-", "") + "-";
    L.forEach((l, i) => l.no = pre + String(i + 1).padStart(3, "0"));
    const tx = L.filter(l => (!fv || l.cabang === fv) && (!fk || l.kat === fk));
    if (!S.rowsLoaded && S.db) { $("txTable").innerHTML = `<tr><td class="empty">Memuat jurnal…</td></tr>`; return; }
    if (!tx.length) { $("txTable").innerHTML = `<tr><td class="empty">Belum ada pengeluaran di ${perName(k)}${fv ? " untuk " + esc(fv) : ""}${fk ? " (" + esc(fk) + ")" : ""}.</td></tr>`; return; }
    let html = `<thead><tr><th>No. jurnal</th><th>Tanggal</th><th>Cabang</th><th>Kategori</th><th>Keterangan</th><th>No. bukti</th><th class="r">Jumlah (Rp)</th>${S.admin ? "<th></th>" : ""}</tr></thead><tbody>`;
    let day = null; const colN = S.admin ? 8 : 7;
    tx.forEach(l => { const r = l.r || {};
      if (l.tanggal !== day) { day = l.tanggal; html += `<tr class="day"><td colspan="${colN}">${esc(fmtDay(day))}</td></tr>`; }
      html += `<tr><td class="no num">${esc(l.no)}</td><td class="num">${esc(fmtDate(l.tanggal))}</td><td>${esc(shortCab(l.cabang))}</td>
        <td><span class="kat ${l.src}">${esc(l.kat)}</span></td>
        <td class="k">${esc(l.ket)} ${r.contoh ? `<span class="tag contoh">contoh</span>` : ""} ${flagMap.has(l.id) ? `<span class="pill warn">${esc(flagMap.get(l.id)[0])}</span>` : ""}${r.tanpaStruk && r.rincian ? `<small>Rincian: ${esc(r.rincian.map(x => x.barang + " " + fmtQty(x.qty) + "× " + rp(x.harga)).join(" · "))}</small>` : ""}${r.pengisi ? `<small>Diisi oleh ${esc(r.pengisi)}</small>` : ""}</td>
        <td class="num">${esc(l.nota || "–")}</td><td class="r num">${fmt(l.jumlah)}</td>
        ${S.admin ? `<td class="r">${l.src === "pc" ? `<button class="btn ghost danger" data-del="${esc(l.id)}">Hapus</button>` : l.src === "bc" ? `<button class="btn ghost danger" data-delps="${esc(l.id)}">Hapus</button>` : ""}</td>` : ""}</tr>`; });
    html += `<tr class="total"><td colspan="6">Total · ${tx.length} catatan</td><td class="r num">${fmt(sumOf(tx, l => l.jumlah))}</td>${S.admin ? "<td></td>" : ""}</tr></tbody>`;
    $("txTable").innerHTML = html;
  }
  const fmtOrDash = v => v ? fmt(v) : "–";
  $("txFilter").addEventListener("change", renderJurnal);
  $("txKat").addEventListener("change", renderJurnal);
  $("bcTgl").value = todayISO();
  ["bcJml"].forEach(id => $(id).addEventListener("input", e => { const n = parseRp(e.target.value); e.target.value = n ? fmt(n) : ""; }));
  async function addBiaya(doc, msgEl){
    if (!S.db) { msgEl.textContent = "Penyimpanan belum tersambung."; return false; }
    if (!doc.tanggal) { msgEl.textContent = "Isi tanggal."; return false; }
    { const lk = lockOf(doc.tanggal); if (lk) { msgEl.textContent = lk; return false; } }
    if (!(doc.jumlah > 0)) { msgEl.textContent = "Jumlah harus lebih dari 0."; return false; }
    if (!doc.keterangan) { msgEl.textContent = "Isi keterangan."; return false; }
    if (!doc.pengisi) { msgEl.textContent = "Isi nama pengisi."; return false; }
    msgEl.textContent = "Menyimpan…";
    try { const ref = await S.db.collection("pusat").add({ ...doc, bulan: doc.tanggal.slice(0,7), by: S.uid || null, at: new Date().toISOString(), contoh: false });
      msgEl.textContent = ""; toast("Tersimpan: " + doc.kategori + " · " + rp(doc.jumlah)); return ref?.id || true; }
    catch (err) { msgEl.textContent = err?.code === "invalid_argument" ? "Hanya admin yang bisa mencatat pengeluaran ini." : "Gagal menyimpan, coba lagi."; return false; }
  }
  $("bcForm").addEventListener("submit", async e => { e.preventDefault();
    const doc = { unit:$("bcCabang").value, kategori:$("bcKat").value, tanggal:$("bcTgl").value, jumlah:parseRp($("bcJml").value), keterangan:$("bcKet").value.trim(), nota:$("bcNota").value.trim(), dana:$("bcDana").value.trim(), pengisi:$("bcPengisi").value.trim() };
    if (!doc.unit) { $("bcMsg").textContent = "Pilih cabang."; return; }
    $("bcWa").hidden = true; const id = await addBiaya(doc, $("bcMsg")); if (id) { setWa($("bcWa"), doc, "pusat", typeof id === "string" ? id : null); $("bcJml").value = ""; $("bcKet").value = ""; $("bcNota").value = ""; jumpTo(doc.tanggal); } });
  $("csvBtn").addEventListener("click", async () => {
    const fv = $("txFilter").value, fk = $("txKat").value; const tx = jurnalLines(S.rk).filter(l => (!fv || l.cabang === fv) && (!fk || l.kat === fk));
    if (!tx.length) { toast("Belum ada data periode ini"); return; }
    const q = v => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
    const lines = [["Tanggal","Cabang","Grup","Kategori","Keterangan","No Bukti","Tanpa struk","Diisi oleh","Jumlah (Rp)"].join(",")];
    tx.forEach(l => lines.push([l.tanggal, l.cabang, grupOf(l.cabang), l.kat, l.ket, l.nota, l.r?.tanpaStruk ? "ya" : "", l.r?.pengisi || "", l.jumlah].map(q).join(",")));
    lines.push(["","","","","TOTAL","","","", sumOf(tx, l => l.jumlah)].map(q).join(","));
    try { await S.dl.save({ filename:`Jurnal Pengeluaran ${fv ? shortCab(fv) + " " : ""}${perName(S.rk)}.csv`, data:"﻿" + lines.join("\n") }); toast("File disimpan"); }
    catch (err) { if (err?.code === "declined") return; toast("Download gagal, coba lagi"); }
  });


  /* ---------- AI summary ---------- */
  $("aiBtn").addEventListener("click", async () => {
    if (!S.sample) return;
    const A = agg(); const out=$("aiOut"), btn=$("aiBtn");
    if (!A.cur.length) { out.hidden=false; out.textContent="Belum ada data di bulan ini untuk diringkas."; return; }
    S.aiCtl?.abort(); S.aiCtl = new AbortController();
    const data = {
      periode: perName(S.rk) + " (" + perRange(S.rk) + ")", periode_lalu: perName(prevKey(S.rk)), total_petty_cash: A.total, jumlah_transaksi: A.cur.length,
      perubahan_vs_bulan_lalu_cabang_yang_sudah_setor: A.prevFair? +(A.total/A.prevFair-1).toFixed(3):null,
      cabang: A.cabs.map(c=>({ nama:c, total_petty_cash:A.by[c].total, petty_cash_bulan_lalu:A.by[c].prev, jumlah_transaksi:A.by[c].n, status:A.by[c].n?"sudah setor":"belum setor",
        omzet_zenwel: S.sales.filter(s=>inPer(s.tanggal,S.rk) && s.cabang===c).reduce((t,s)=>t+(s.total||0),0),
        hari_laporan_zenwel: new Set(S.sales.filter(s=>inPer(s.tanggal,S.rk) && s.cabang===c).map(s=>s.tanggal)).size })),
      transaksi_terbesar: [...A.cur].sort((a,b)=>b.jumlah-a.jumlah).slice(0,5).map(r=>({ cabang:r.cabang, tanggal:r.tanggal, keterangan:r.keterangan, jumlah:r.jumlah })),
      perlu_dicek: A.flags.slice(0,10).map(({r,f})=>({ no:r._no, cabang:r.cabang, keterangan:r.keterangan, jumlah:r.jumlah, alasan:f }))
    };
    btn.disabled=true; btn.textContent="Menulis…"; out.hidden=false; out.textContent="Membaca jurnal…";
    try {
      await S.sample(
        "Kamu membantu admin keuangan sebuah usaha salon lash & nail multi-cabang di Indonesia. Berikut rekap jurnal pengeluaran petty cash bulanan semua cabang (angka dalam rupiah) dalam JSON.\n\n" + JSON.stringify(data) +
        "\n\nTulis ringkasan untuk owner dalam bahasa Indonesia yang santai tapi profesional. Format: satu kalimat pembuka berisi total petty cash bulan ini dan jumlah transaksinya, lalu 4–6 poin diawali \"- \". Bahas: cabang yang belum setor, cabang dengan pengeluaran naik atau turun paling besar vs bulan lalu (hanya cabang yang sudah setor), transaksi terbesar, item yang perlu dicek (sebut no. jurnalnya), dan kalau omzet Zenwel tersedia, rasio petty cash terhadap omzet per cabang serta cabang yang laporan Zenwel-nya belum lengkap. Tulis angka sebagai Rp dengan pemisah titik, atau 'jt' untuk juta. Jangan pakai markdown tebal atau judul. Jangan mengarang angka di luar data.",
        { signal:S.aiCtl.signal, cache:false, onText:({text})=>{ out.textContent=text; } });
    } catch (err) {
      if (["not_granted","sampling_disabled","not_declared","capability_disabled","capability_removed"].includes(err?.code)) { out.textContent="Ringkasan AI tidak tersedia di tampilan ini."; btn.hidden=true; }
      else if (err?.code==="rate_limited") out.textContent=(err.text?err.text+"\n\n":"")+"Batas pemakaian tercapai. Coba lagi nanti.";
      else if (err?.code==="refused") out.textContent="Ringkasan tidak bisa dibuat untuk data ini.";
      else if (err?.code!=="cancelled") out.textContent=(err?.text?err.text+"\n\n(terputus) ":"")+"Gagal membuat ringkasan. Coba lagi.";
    } finally { btn.disabled=false; btn.textContent="Buat ulang"; }
  });

  /* ---------- omzet (import Zenwel) ---------- */
  S.sales = []; S.salesLoaded = false; S.unsubSales = null; S.zParsed = null; S.zReplace = false;
  $("zTanggal").value = todayISO();
  function subscribeSales(){
    if (!S.db) return;
    if (S.unsubSales) S.unsubSales();
    S.salesLoaded = false;
    S.unsubSales = subMany("sales", "bulan", perBulans(S.rk), docs => { S.sales = docs.filter(x => x.cabang !== "Pusat"); S.salesPst = docs.filter(x => x.cabang === "Pusat"); S.salesLoaded = true; renderAll(); },
      () => { S.salesLoaded = true; renderAll(); });
  }
  function parseCSV(text){
    text = text.replace(/^﻿/, "");
    const first = text.split(/\r?\n/)[0] || ""; const delim = (first.split(";").length > first.split(",").length) ? ";" : ",";
    const rows = []; let row = [], f = "", q = false;
    for (let i = 0; i < text.length; i++) { const ch = text[i];
      if (q) { if (ch === '"') { if (text[i+1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
      else if (ch === '"') q = true;
      else if (ch === delim) { row.push(f); f = ""; }
      else if (ch === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
      else if (ch !== "\r") f += ch; }
    if (f !== "" || row.length) { row.push(f); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ""));
  }
  function num(s){
    s = String(s ?? "").trim().replace(/^rp\.?\s*/i, ""); if (!s) return 0;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
    else s = s.replace(",", ".");
    const n = Number(s); return Number.isFinite(n) ? n : 0;
  }
  const ZCOL = { item:["item","nama item","produk","layanan"], qty:["items sold","qty","quantity","jumlah"], gross:["gross sales"], disc:["discounts","diskon"], refund:["refunds"], net:["net sales"], tax:["tax","pajak"], voucher:["sales by voucher redemption"], rounding:["rounding amount"], total:["total sales"] };
  function parseZenwel(text){
    const rows = parseCSV(text); if (rows.length < 2) throw new Error("File kosong atau tidak terbaca.");
    const head = rows[0].map(h => h.trim().toLowerCase()); const ix = {};
    Object.entries(ZCOL).forEach(([k, names]) => { ix[k] = head.findIndex(h => names.includes(h)); });
    if (ix.item < 0 || (ix.total < 0 && ix.net < 0)) throw new Error("Kolom tidak dikenali. Pastikan file-nya export \"Sales by item\" dari Zenwel dalam format CSV.");
    const g = (r, k) => ix[k] >= 0 ? num(r[ix[k]]) : 0;
    let fileTotal = null; const items = [];
    rows.slice(1).forEach(r => { const name = String(r[ix.item] ?? "").trim(); if (!name) return;
      const total = ix.total >= 0 ? g(r,"total") : g(r,"net");
      if (name.toLowerCase() === "total") { fileTotal = total; return; }
      items.push({ item:name, qty:g(r,"qty"), gross:g(r,"gross"), disc:g(r,"disc"), refund:g(r,"refund"), net:g(r,"net"), tax:g(r,"tax"), voucher:g(r,"voucher"), rounding:g(r,"rounding"), total }); });
    if (!items.length) throw new Error("Tidak ada baris penjualan di file ini.");
    const sum = k => Math.round(items.reduce((s, it) => s + (it[k] || 0), 0) * 100) / 100;
    return { items, total:sum("total"), net:sum("net"), gross:sum("gross"), disc:sum("disc"), refund:sum("refund"), qty:sum("qty"), fileTotal };
  }
  function zReset(msg){ S.zParsed = null; S.zReplace = false; $("zPreview").innerHTML = ""; $("zSave").disabled = true; $("zSave").textContent = "Simpan ke jurnal masuk"; $("zMsg").textContent = msg || ""; }
  async function zLoadFile(file){
    if (!file) return; zReset("Membaca file…");
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") { zReset("Pakai file CSV ya. Di Zenwel pilih export ke CSV."); return; }
    const readText = f => typeof f.text === "function" ? f.text() : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(f); });
    let p; try { p = parseZenwel(await readText(file)); } catch (err) { zReset(err?.message || "File tidak terbaca."); return; }
    p.file = file.name;
    const m = file.name.match(/(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})/); let note = "";
    if (m) { $("zTanggal").value = m[2]; if (m[1] !== m[2]) note = `File ini berisi ${fmtDate(m[1])} s/d ${fmtDate(m[2])}. Akan disimpan sebagai satu catatan di ${fmtDate(m[2])}; sebaiknya export per hari.`; }
    else note = "Tanggal tidak terbaca dari nama file, cek lagi tanggal laporannya.";
    S.zParsed = p;
    const okTot = p.fileTotal == null || Math.abs(p.fileTotal - p.total) < 1;
    $("zPreview").innerHTML = `<div class="zprev"><div class="scroll"><table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Total sales</th></tr></thead><tbody>` +
      p.items.map(it => `<tr><td>${esc(it.item)}</td><td class="r num">${esc(fmtQty(it.qty))}</td><td class="r num">${fmt(it.total)}</td></tr>`).join("") +
      `<tr class="total"><td>Total · ${p.items.length} item</td><td class="r num">${esc(fmtQty(p.qty))}</td><td class="r num">${fmt(p.total)}</td></tr></tbody></table></div>` +
      `<div class="zcheck ${okTot ? "okc" : "bad"}">${p.fileTotal == null ? "File tidak punya baris Total, angka dijumlah dari item." : okTot ? "✓ Cocok dengan baris Total di file (" + rp(p.fileTotal) + ")" : "Jumlah item (" + rp(p.total) + ") beda dengan baris Total di file (" + rp(p.fileTotal) + "). Cek file-nya."}</div></div>`;
    $("zMsg").textContent = note; $("zSave").disabled = false;
  }
  $("zFile").addEventListener("change", e => { const f = e.target.files?.[0]; e.target.value = ""; zLoadFile(f); });
  const zDrop = $("zDrop");
  ["dragenter","dragover"].forEach(ev => zDrop.addEventListener(ev, e => { e.preventDefault(); zDrop.classList.add("over"); }));
  ["dragleave","drop"].forEach(ev => zDrop.addEventListener(ev, e => { e.preventDefault(); zDrop.classList.remove("over"); }));
  zDrop.addEventListener("drop", e => zLoadFile(e.dataTransfer?.files?.[0]));
  ["zCabang","zTanggal"].forEach(id => $(id).addEventListener("change", () => { if (S.zReplace) { S.zReplace = false; $("zSave").textContent = "Simpan ke jurnal masuk"; } }));
  $("zSave").addEventListener("click", async () => {
    const p = S.zParsed, c = $("zCabang").value, tgl = $("zTanggal").value, msg = $("zMsg");
    if (!S.db) { msg.textContent = "Penyimpanan belum tersambung."; return; }
    if (!p) { msg.textContent = "Pilih file dulu."; return; }
    if (!c) { msg.textContent = "Pilih cabang dulu."; return; }
    if (!tgl) { msg.textContent = "Isi tanggal laporan."; return; }
    { const lk = lockOf(tgl); if (lk) { msg.textContent = lk; return; } }
    const id = "z_" + slug(c) + "_" + tgl; const ref = S.db.doc("sales/" + id);
    const btn = $("zSave"); btn.disabled = true;
    try {
      if (!S.zReplace) { const ex = await ref.get();
        if (ex.exists) { S.zReplace = true; btn.disabled = false; btn.textContent = "Ganti laporan yang sudah ada";
          msg.textContent = `Laporan ${shortCab(c)} tanggal ${fmtDate(tgl)} sudah ada (${rp(ex.data().total)}). Klik sekali lagi untuk mengganti, atau ubah cabang/tanggal.`; return; } }
      msg.textContent = "Menyimpan…";
      await ref.set({ cabang:c, tanggal:tgl, bulan:tgl.slice(0,7), sumber:"Zenwel", file:p.file || "", items:p.items, total:p.total, net:p.net, gross:p.gross, disc:p.disc, refund:p.refund, qty:p.qty, by:S.uid || null, at:new Date().toISOString(), contoh:false });
      toast("Tersimpan: " + shortCab(c) + " · " + fmtDate(tgl) + " · " + rp(p.total));
      zReset(`Tersimpan ke jurnal masuk: ${shortCab(c)} · ${fmtDate(tgl)} · ${rp(p.total)}.`);
      jumpTo(tgl);
    } catch (err) {
      btn.disabled = false; msg.textContent = err?.code === "invalid_argument" ? "Akun kamu belum punya akses tulis." : "Gagal menyimpan, coba lagi sebentar.";
    }
  });
  function elapsedDays(k){ const t = todayISO(), days = perDays(k); if (t > perEnd(k)) return days.length; if (t <= perStart(k)) return 0; return days.filter(d => d < t).length; }
  function renderOmzet(){
    const cabs = [...cabList()]; const ms = S.sales.filter(s => inPer(s.tanggal, S.rk)), ex = S.rows.filter(r => inPer(r.tanggal, S.rk));
    ms.forEach(s => { if (s.cabang && !cabs.includes(s.cabang)) cabs.push(s.cabang); });
    const by = {}; cabs.forEach(c => by[c] = { om:0, pc:0, days:new Set(), last:"" });
    ms.forEach(s => { const b = by[s.cabang]; b.om += s.total || 0; if (s.sumber !== "Manual") b.days.add(s.tanggal); if ((s.tanggal||"") > b.last) b.last = s.tanggal; });
    ex.forEach(r => { if (by[r.cabang]) by[r.cabang].pc += r.jumlah || 0; });
    const om = cabs.reduce((s,c) => s + by[c].om, 0), pc = cabs.reduce((s,c) => s + by[c].pc, 0), need = elapsedDays(S.rk);
    const gaps = cabs.map(c => [c, Math.max(0, need - by[c].days.size)]).filter(x => x[1] > 0);
    const up = cabs.reduce((s,c) => s + by[c].days.size, 0);
    $("omKpis").innerHTML = [
      ["Omzet", `<span class="num">${rpShort(om)}</span>`, perName(S.rk) + (sumOf(ms.filter(x => x.sumber === "Manual"), x => x.total) ? " · manual " + rpShort(sumOf(ms.filter(x => x.sumber === "Manual"), x => x.total)) : "")],
      ["Petty cash", `<span class="num">${rpShort(pc)}</span>`, om ? pct(pc/om) + " dari omzet" : "–"],
      ["Omzet − petty cash", `<span class="num">${rpShort(om - pc)}</span>`, "belum termasuk biaya lain"],
      ["Laporan masuk", `<span class="num">${up} / ${need * cabs.length}</span>`, gaps.length ? "Kurang: " + esc(gaps.map(([c,n]) => shortCab(c) + " " + n + " hr").join(", ")) : (need ? "Lengkap" : "–")]
    ].map(([l,v,s]) => `<div class="kpi"><span class="l">${l}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join("");
    // per cabang
    $("omTable").innerHTML = cabs.length ? `<thead><tr><th>Cabang</th><th class="r">Omzet</th><th class="r">Petty cash</th><th class="r">% petty cash</th><th class="r">Omzet − petty cash</th><th>Laporan</th></tr></thead><tbody>` +
      cabs.map(c => { const b = by[c]; const miss = Math.max(0, need - b.days.size);
        return `<tr><td><b>${esc(c)}</b></td><td class="r num">${rp(b.om)}</td><td class="r num">${rp(b.pc)}</td><td class="r num">${b.om ? pct(b.pc/b.om) : "–"}</td><td class="r num">${rp(b.om - b.pc)}</td>
          <td>${b.days.size ? `<span class="pill ${miss ? "warn" : "ok"}">${b.days.size} hari${miss ? " · kurang " + miss : ""}</span>` : `<span class="pill no">Belum ada</span>`}</td></tr>`; }).join("") +
      `<tr class="total"><td>Total</td><td class="r num">${rp(om)}</td><td class="r num">${rp(pc)}</td><td class="r num">${om ? pct(pc/om) : "–"}</td><td class="r num">${rp(om - pc)}</td><td></td></tr></tbody>`
      : `<tr><td class="empty">Belum ada cabang.</td></tr>`;
    // top items
    const agg = {}; ms.forEach(s => (s.items || []).forEach(it => { const a = agg[it.item] ??= { qty:0, total:0 }; a.qty += it.qty || 0; a.total += it.total || 0; }));
    const top = Object.entries(agg).sort((a,b) => b[1].total - a[1].total).slice(0, 8); const mx = Math.max(1, ...top.map(t => t[1].total));
    $("topHint").textContent = top.length ? perName(S.rk) : "";
    $("topItems").innerHTML = top.length ? top.map(([n,a]) => `<div class="top-row-i"><b>${esc(n)}</b><span class="num">${rpShort(a.total)} · ${esc(fmtQty(Math.round(a.qty*100)/100))}×</span><div class="bar"><i style="width:${(a.total/mx*100).toFixed(1)}%"></i></div></div>`).join("")
      : `<div class="empty">Belum ada laporan Zenwel di ${perName(S.rk)}.</div>`;
    // jurnal masuk
    const fv = $("jmFilter").value; $("jmTitle").textContent = (fv || "Semua cabang") + " · " + perName(S.rk);
    const list = [...ms, ...(S.salesPst || []).filter(s => inPer(s.tanggal, S.rk))].filter(s => !fv || s.cabang === fv).sort((a,b) => (a.tanggal||"").localeCompare(b.tanggal||"") || (a.cabang||"").localeCompare(b.cabang||""));
    const pre = "JM-" + S.rk.slice(2).replace("-", "") + "-";
    if (S.db && !S.salesLoaded) { $("jmTable").innerHTML = `<tr><td class="empty">Memuat…</td></tr>`; return; }
    $("jmTable").innerHTML = list.length ? `<thead><tr><th>No. jurnal</th><th>Tanggal</th><th>Akun</th><th>Keterangan</th><th class="r">Jumlah (Rp)</th>${S.admin ? "<th></th>" : ""}</tr></thead><tbody>` +
      list.map((s,i) => `<tr><td class="no num">${pre}${String(i+1).padStart(3,"0")}</td><td class="num">${esc(fmtDate(s.tanggal))}</td><td class="akun">Pendapatan<small>${esc(shortCab(s.cabang))}</small></td>
        <td class="k">${s.sumber === "Manual" ? `Manual · ${esc(s.kategori || "")}: ${esc(s.keterangan || "")}${s.pengisi ? `<small>Diisi oleh ${esc(s.pengisi)}</small>` : ""}` : `Penjualan Zenwel · ${(s.items||[]).length} item, ${esc(fmtQty(s.qty || 0))} terjual`} ${s.contoh ? `<span class="tag contoh">contoh</span>` : ""}</td><td class="r num">${fmt(s.total)}</td>
        ${S.admin ? `<td class="r"><button class="btn ghost danger" data-delsale="${esc(s.id)}">Hapus</button></td>` : ""}</tr>`).join("") +
      `<tr class="total"><td colspan="4">Total ${esc(fv ? shortCab(fv) : "semua cabang")} · ${list.length} laporan</td><td class="r num">${fmt(list.reduce((s,x) => s + (x.total || 0), 0))}</td>${S.admin ? "<td></td>" : ""}</tr></tbody>`
      : `<tr><td class="empty">Belum ada omzet di ${perName(S.rk)}${fv ? " untuk " + esc(fv) : ""}. Upload file export Zenwel atau input omzet manual di atas.</td></tr>`;
  }
  $("jmFilter").addEventListener("change", renderOmzet);
  document.addEventListener("click", async e => {
    const b = e.target.closest("[data-delsale]"); if (!b) return;
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Yakin?"; setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.textContent = "Hapus"; } }, 3000); return; }
    b.disabled = true;
    try { await S.db.doc("sales/" + b.dataset.delsale).delete(); toast("Laporan dihapus dari jurnal masuk"); } catch { toast("Gagal menghapus"); b.disabled = false; }
  });
  $("jmCsv").addEventListener("click", async () => {
    const fv = $("jmFilter").value; const list = S.sales.filter(s => inPer(s.tanggal, S.rk) && (!fv || s.cabang === fv)).sort((a,b) => (a.tanggal||"").localeCompare(b.tanggal||""));
    if (!list.length) { toast("Belum ada data bulan ini"); return; }
    const q = v => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [["Tanggal","Cabang","Item","Qty","Gross Sales","Diskon","Refund","Net Sales","Total Sales"].join(",")];
    list.forEach(s => (s.items || []).forEach(it => lines.push([s.tanggal, s.cabang, it.item, it.qty, it.gross, it.disc, it.refund, it.net, it.total].map(q).join(","))));
    lines.push(["","","TOTAL","","","","","", list.reduce((t,s) => t + (s.total || 0), 0)].map(q).join(","));
    try { await S.dl.save({ filename:`Jurnal Masuk ${fv ? shortCab(fv) + " " : ""}${perName(S.rk)}.csv`, data:"﻿" + lines.join("\n") }); toast("File disimpan"); }
    catch (err) { if (err?.code === "declined") return; toast("Download gagal, coba lagi"); }
  });

  /* ---------- pusat: pengeluaran pusat ---------- */
  S.ps = []; S.psLoaded = false; S.unsubPs = null; S.prDoc = null; S.prLoaded = false; S.unsubPr = null; S.pr = null; S.prDirty = false;
  S.kpiDocs = {}; S.kpiAll = {}; S.prDocs = {}; S.kpiLoaded = false; S.unsubKpi = null;
  function syncKpiDocs(){ S.kpiDocs = {}; Object.values(S.kpiAll).forEach(x => { if (x.periode === S.month) S.kpiDocs[x.empId] = x; }); }
  $("pcTgl").value = todayISO();
  ["pcJml"].forEach(id => $(id).addEventListener("input", e => { const n = parseRp(e.target.value); e.target.value = n ? fmt(n) : ""; }));
  function subscribePusat(){
    if (!S.db || !(S.admin || isTrainer() || ["trainer"].includes(SA.user?.role))) return;
    [S.unsubPs, S.unsubPr, S.unsubKpi].forEach(u => u && u());
    S.psLoaded = false; S.prLoaded = false; S.kpiLoaded = false; S.prDirty = false; S.pr = null; prSig = ""; S.kpiEdit = null;
    S.unsubPs = subMany("pusat", "bulan", perBulans(S.rk), docs => { S.ps = docs; S.psLoaded = true; renderAll(); }, () => { S.psLoaded = true; renderAll(); });
    const pk = [...new Set([...tokKeys(S.rk), ...tokKeys(prevKey(S.rk)), S.month])];
    S.unsubPr = S.db.collection("payroll").where("bulan","in",pk).limit(50).onSnapshot(sn => {
      S.prDocs = {}; sn.docs.forEach(d => { S.prDocs[d.id] = d.data(); }); S.prDoc = S.prDocs[S.month] || null; S.prLoaded = true; if (!S.prDirty) S.pr = null; renderAll(); }, () => { S.prLoaded = true; renderAll(); });
    S.unsubKpi = S.db.collection("kpi").where("periode","in",pk).limit(1000).onSnapshot(sn => {
      S.kpiAll = {}; sn.docs.forEach(d => { const x = d.data(); if (x.empId) S.kpiAll[x.periode + "|" + x.empId] = { id:d.id, ...x }; }); syncKpiDocs(); S.kpiLoaded = true; renderAll(); }, () => { S.kpiLoaded = true; renderAll(); });
  }
  $("pcForm").addEventListener("submit", async e => { e.preventDefault();
    const doc = { unit:"Pusat", kategori:$("pcKat").value, tanggal:$("pcTgl").value, jumlah:parseRp($("pcJml").value), keterangan:$("pcKet").value.trim(), nota:$("pcNota").value.trim(), dana:$("pcDana").value.trim(), pengisi:$("pcPengisi").value.trim() };
    $("pcWa").hidden = true; const id = await addBiaya(doc, $("pcMsg")); if (id) { setWa($("pcWa"), doc, "pusat", typeof id === "string" ? id : null); $("pcJml").value = ""; $("pcKet").value = ""; $("pcNota").value = ""; jumpTo(doc.tanggal); } });
  const adminGate = (bodyId, roId) => { if (S.booted && !S.admin) { $(roId).hidden = false; $(bodyId).hidden = true; return false; } $(roId).hidden = true; $(bodyId).hidden = false; return true; };
  function renderPusat(){
    if (!adminGate("pusatBody", "pusatRO")) return;
    const k = S.rk, B = biayaPer(k).filter(p => p.unit === "Pusat"), payP = sumOf(tokKeys(k), mk => payrollByCab(mk)["Pusat"] || 0);
    const byKat = {}; PST_KAT.forEach(x => byKat[x] = 0); B.forEach(p => byKat[p.kategori] = (byKat[p.kategori] || 0) + (p.jumlah || 0));
    const tot = sumOf(B, p => p.jumlah) + payP;
    $("psKpis").innerHTML = [
      ["Total pengeluaran pusat", `<span class="num">${rpShort(tot)}</span>`, perRange(k)],
      ["Petty cash pusat", `<span class="num">${rpShort(byKat["Petty cash pusat"] || 0)}</span>`, B.filter(p => p.kategori === "Petty cash pusat").length + " catatan"],
      ["Di luar petty cash", `<span class="num">${rpShort(tot - payP - (byKat["Petty cash pusat"] || 0))}</span>`, "sewa, listrik, leasing, dll"],
      ["Payroll pusat", `<span class="num">${rpShort(payP)}</span>`, "karyawan penempatan pusat"]
    ].map(([l,v,s]) => `<div class="kpi"><span class="l">${l}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join("");
    $("psSumHint").textContent = perRange(k);
    $("psSum").innerHTML = `<thead><tr><th>Kategori</th><th class="r">Jumlah</th><th class="r">Porsi</th></tr></thead><tbody>` +
      [...Object.keys(byKat), "Payroll pusat"].map(x => { const v = x === "Payroll pusat" ? payP : byKat[x]; return `<tr><td>${esc(x)}</td><td class="r num">${fmtOrDash(v)}</td><td class="r num">${tot && v ? pct(v / tot) : "–"}</td></tr>`; }).join("") +
      `<tr class="total"><td>Total</td><td class="r num">${fmt(tot)}</td><td></td></tr></tbody>`;
    const pre = "PS-" + k.slice(2).replace("-", "") + "-";
    const lines = B.map(p => ({ id:p.id, tanggal:p.tanggal, kat:p.kategori, ket:(p.keterangan || "") + (p.pengisi ? " · oleh " + p.pengisi : ""), nota:p.nota || "", jumlah:p.jumlah || 0, contoh:p.contoh }));
    tokKeys(k).forEach(mk => { const P = S.prDocs[mk], v = payrollByCab(mk)["Pusat"] || 0; if (P && v) lines.push({ id:null, tanggal:P.tglBayar || perEnd(mk), kat:"Payroll", ket:"Payroll pusat " + perName(mk) + (P.status === "final" ? "" : " (draft)"), nota:"", jumlah:v, contoh:P.contoh }); });
    lines.sort((a,b) => (a.tanggal||"").localeCompare(b.tanggal||""));
    $("jpTitle").textContent = "Pusat · " + perName(k);
    $("jpTable").innerHTML = (S.db && !S.psLoaded) ? `<tr><td class="empty">Memuat…</td></tr>` : lines.length ? `<thead><tr><th>No. jurnal</th><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th>No. bukti</th><th class="r">Jumlah (Rp)</th><th></th></tr></thead><tbody>` +
      lines.map((l, i) => `<tr><td class="no num">${pre}${String(i + 1).padStart(3, "0")}</td><td class="num">${esc(fmtDate(l.tanggal))}</td><td><span class="kat">${esc(l.kat)}</span></td><td class="k">${esc(l.ket)} ${l.contoh ? `<span class="tag contoh">contoh</span>` : ""}</td><td class="num">${esc(l.nota || "–")}</td><td class="r num">${fmt(l.jumlah)}</td><td class="r">${l.id ? `<button class="btn ghost danger" data-delps="${esc(l.id)}">Hapus</button>` : ""}</td></tr>`).join("") +
      `<tr class="total"><td colspan="5">Total pengeluaran pusat · ${lines.length} catatan</td><td class="r num">${fmt(sumOf(lines, l => l.jumlah))}</td><td></td></tr></tbody>`
      : `<tr><td class="empty">Belum ada pengeluaran pusat di ${perName(k)}.</td></tr>`;
  }
  document.addEventListener("click", async e => {
    const b = e.target.closest("[data-delps]"); if (!b) return;
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Yakin?"; setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.textContent = "Hapus"; } }, 3000); return; }
    b.disabled = true;
    try { await S.db.doc("pusat/" + b.dataset.delps).delete(); toast("Dihapus"); } catch { toast("Gagal menghapus"); b.disabled = false; }
  });

  /* ---------- KPI ---------- */
  const KPI_CFG = { nilaiPoin:36000, minPoin:13, review:30000, komplain:{ Low:50000, Medium:75000, High:100000 } };
  const KPI_T = [
    ["f1","Penampilan & Disiplin",[["makeup","Make up",1],["penampilan","Penampilan",1],["harum","Harum",1],["waktu","Tepat waktu",1],["aturan","Taat peraturan kerja",1],["bersih","Kebersihan cabang & lokasi kerja",1]]],
    ["f2","Kualitas pengerjaan",[["sop","Pelaksanaan SOP berjalan semua dan sesuai standar",2],["hasil","Pekerjaan luar biasa bagus",1],["rajin","Kerajinan luar biasa bagus",1],["cust","Jumlah customer pengerjaan (≥120 = 2 poin, ≥85 = 1 poin)",2,"jumlah"]]],
    ["f3","Komunikasi",[["kcust","Komunikasi kepada customer",2],["ktim","Komunikasi antar tim",1],["katasan","Komunikasi ke atasan",1]]],
    ["f4","Absensi",[["absen","Tidak bolos / izin / cuti",4]]],
    ["f5","Semangat & antusias kerja",[["sem","Semangat dalam menjalani pekerjaan",1],["train","Semangat dalam training",1],["tanggap","Cepat tanggap dan responsif",1],["sosmed","Berkontribusi dalam postingan sosial media LB & YD",1],["review","Memperbaiki diri, review dan mengajak review",1]]]
  ];
  const KPI_ITEMS = KPI_T.flatMap(([fid, fn, its]) => its.map(([id, label, poin, type]) => ({ fid, fn, id, label, poin, type: type || "cek" })));
  const KPI_MAX = sumOf(KPI_ITEMS, i => i.poin);
  const ROLES = [["mod","MOD"],["trainer","Trainer"],["owner","Owner"]];
  function kpiCalc(sh){
    sh = sh || {}; let poin = 0;
    KPI_ITEMS.forEach(it => { if (it.type === "jumlah") { const n = Number(sh.nilai?.[it.id]) || 0; poin += n >= 120 ? 2 : n >= 85 ? 1 : 0; }
      else { const c = sh.cek?.[it.id] || {}; if (c.mod && c.trainer && c.owner) poin += it.poin; } });
    const lolos = poin >= KPI_CFG.minPoin, nilai = lolos ? poin * KPI_CFG.nilaiPoin : 0;
    const komplain = sumOf(sh.komplain || [], x => KPI_CFG.komplain[x.tingkat] || 0), review = sh.review ? KPI_CFG.review : 0;
    const filled = r => KPI_ITEMS.some(it => it.type === "cek" && sh.cek?.[it.id]?.[r]) || !!(sh.komentar?.[r] || "").trim();
    return { poin, lolos, nilai, komplain, review, net: nilai - komplain + review, isi: { mod:filled("mod"), trainer:filled("trainer"), owner:filled("owner") } };
  }
  const kpiNetOf = (id, k = S.month) => { const d = S.kpiAll[k + "|" + id]; return d ? kpiCalc(d).net : 0; };

  /* ---------- payroll ---------- */
  const PR_ABS = [["hk","HK"],["hadir","Hadir"],["izin","Izin"],["sakit","Sakit"],["alpha","Alpha"]];
  const PR_RP = [["pokok","Gaji pokok"],["tunjangan","Tunjangan"],["bonus","Bonus"],["komisi","Komisi"]];
  const prNorm = r => ({ ...r, bonus: r.bonus ?? ((r.insentif || 0) + (r.lembur || 0)), komisi: r.komisi ?? 0, potLain: r.potLain ?? (r.potongan || 0) });
  function thp(r, k = S.month){ r = prNorm(r); return (r.pokok||0) + (r.tunjangan||0) + (r.bonus||0) + (r.komisi||0) + kpiNetOf(r.id, k) - (r.potLain||0); }
  const prTotal = (rows, k = S.month) => sumOf(rows || [], r => thp(r, k));
  function prWork(){ if (!S.pr || !S.prDirty) S.pr = { rows:(S.prDoc?.rows || []).map(r => prNorm({ ...r })), status:S.prDoc?.status || "draft", tglBayar:S.prDoc?.tglBayar || "" }; return S.pr; }
  let prSig = "";
  function renderPayroll(){
    if (!adminGate("prBody", "prRO")) return;
    const W = prWork(), fin = W.status === "final", opts = ["Pusat", ...cabList()];
    $("prTitle").textContent = "Payroll " + perName(S.month) + " · " + perRange(S.month);
    $("prStatus").className = "pill " + (fin ? "ok" : S.prDoc ? "warn" : "no");
    $("prStatus").textContent = fin ? "Sudah dibayar " + fmtDate(W.tglBayar) : S.prDoc ? "Draft" : "Belum dibuat";
    $("prFinal").textContent = fin ? "Buka lagi untuk diedit" : "Tandai sudah dibayar";
    const lockd = isClosed(S.month); $("prFinal").disabled = !S.prDoc || lockd; ["prAdd","prSave","prCopy","prFromKy","prAbs"].forEach(id => $(id).disabled = fin || lockd);
    const totKpi = sumOf(W.rows, r => kpiNetOf(r.id));
    $("prKpis").innerHTML = [
      ["Total ditransfer", `<span class="num">${rpShort(prTotal(W.rows) - sumOf(W.rows, r => r.potKasbon))}</span>`, sumOf(W.rows, r => r.potKasbon) ? "setelah potong kasbon " + rpShort(sumOf(W.rows, r => r.potKasbon)) : perRange(S.month)],
      ["Karyawan", `<span class="num">${W.rows.length}</span>`, W.rows.length ? Object.entries(W.rows.reduce((o, r) => (o[shortCab(r.cabang || "Pusat")] = (o[shortCab(r.cabang || "Pusat")] || 0) + 1, o), {})).map(([c, n]) => c + " " + n).join(" · ") : "belum ada"],
      ["Total KPI", `<span class="num">${rpShort(totKpi)}</span>`, Object.keys(S.kpiDocs).length + " sudah dinilai"],
      ["Status", `<span class="num" style="font-size:18px">${fin ? "Dibayar" : S.prDoc ? "Draft" : "–"}</span>`, fin ? fmtDate(W.tglBayar) : "belum ditransfer"]
    ].map(([l,v,s]) => `<div class="kpi"><span class="l">${l}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join("");
    const sig = S.month + "|" + JSON.stringify(S.prDoc || {}).length + "|" + W.rows.length + "|" + W.status + "|" + opts.join(",") + "|" + JSON.stringify(Object.keys(S.kpiDocs).map(id => kpiNetOf(id)));
    if (sig === prSig) { updatePrTotals(); return; }
    prSig = sig;
    if (S.db && !S.prLoaded) { $("prTable").innerHTML = `<tr><td class="empty">Memuat…</td></tr>`; return; }
    if (!W.rows.length) { $("prTable").innerHTML = `<tr><td class="empty">Lembar payroll ${perName(S.month)} masih kosong. Klik "Tambah karyawan" atau "Salin dari periode lalu".</td></tr>`; updatePrTotals(); return; }
    const dis = fin ? "disabled" : "";
    $("prTable").innerHTML = `<thead><tr><th>No</th><th>Nama</th><th>Jabatan</th><th>Penempatan</th>${PR_ABS.map(([,l]) => `<th class="r">${l}</th>`).join("")}${PR_RP.map(([,l]) => `<th class="r">${l}</th>`).join("")}<th class="r">KPI</th><th class="r">Potongan lain</th><th>Ket. potongan</th><th class="r" title="Cicilan kasbon dipotong dari gaji">Pot. kasbon</th><th class="r">Ditransfer</th><th>No. WA</th><th></th></tr></thead><tbody>` +
      W.rows.map((r, i) => { const kd = S.kpiDocs[r.id], kc = kd ? kpiCalc(kd) : null;
        return `<tr><td class="num">${i + 1}</td>
        <td><input type="text" class="t" data-r="${i}" data-f="nama" value="${esc(r.nama || "")}" placeholder="Nama" aria-label="Nama karyawan" ${dis}></td>
        <td><input type="text" class="t s" data-r="${i}" data-f="jabatan" value="${esc(r.jabatan || "")}" placeholder="Jabatan" aria-label="Jabatan" ${dis}></td>
        <td><select data-r="${i}" data-f="cabang" aria-label="Penempatan" ${dis}>${optList((opts.includes(r.cabang) ? opts : [r.cabang, ...opts]).filter(Boolean), r.cabang)}</select></td>
        ${PR_ABS.map(([f]) => `<td><input type="text" class="d" inputmode="numeric" data-r="${i}" data-f="${f}" data-k="d" value="${r[f] ?? ""}" placeholder="0" aria-label="${f}" ${dis}></td>`).join("")}
        ${PR_RP.map(([f, l]) => `<td><input type="text" class="n" inputmode="numeric" data-r="${i}" data-f="${f}" value="${r[f] ? fmt(r[f]) : ""}" placeholder="0" aria-label="${l}" ${dis}></td>`).join("")}
        <td class="r num" title="${kc ? kc.poin + "/" + KPI_MAX + " poin" : "belum dinilai"}">${kc ? fmt(kc.net) : `<span class="note">–</span>`}</td>
        <td><input type="text" class="n" inputmode="numeric" data-r="${i}" data-f="potLain" value="${r.potLain ? fmt(r.potLain) : ""}" placeholder="0" aria-label="Potongan lain" ${dis}></td>
        <td><input type="text" class="t s" data-r="${i}" data-f="ketPot" value="${esc(r.ketPot || "")}" placeholder="Kasbon, BPJS…" aria-label="Keterangan potongan" ${dis}></td>
        <td><input type="text" class="n" inputmode="numeric" data-r="${i}" data-f="potKasbon" value="${r.potKasbon ? fmt(r.potKasbon) : ""}" placeholder="${kbSaldo(r.id).saldo > 0 ? fmt(kasbonCicilan(r.id)) : "0"}" title="${kbSaldo(r.id).saldo > 0 ? "Sisa kasbon " + rp(kbSaldo(r.id).saldo) : "Tidak ada kasbon"}" aria-label="Potongan kasbon" ${dis}></td>
        <td class="thp" id="thp${i}">${fmt(thp(r) - (r.potKasbon || 0))}</td>
        <td><input type="text" class="t s" data-r="${i}" data-f="wa" value="${esc(r.wa || "")}" placeholder="08xx" inputmode="tel" aria-label="No. WA" ${dis}></td>
        <td style="white-space:nowrap"><button class="btn ghost" data-slip="${i}" type="button">Slip</button>${fin ? "" : `<button class="btn ghost danger" data-prdel="${i}" type="button" aria-label="Hapus baris">✕</button>`}</td></tr>`; }).join("") +
      `</tbody><tfoot><tr class="total"><td></td><td colspan="8">Total · ${W.rows.length} karyawan</td>${PR_RP.map(([f]) => `<td class="r num" id="prt-${f}"></td>`).join("")}<td class="r num" id="prt-kpi"></td><td class="r num" id="prt-potLain"></td><td></td><td class="r num" id="prt-potKasbon"></td><td class="thp" id="prt-thp"></td><td></td><td></td></tr></tfoot>`;
    updatePrTotals();
  }
  function updatePrTotals(){
    const W = prWork();
    W.rows.forEach((r, i) => { const el = $("thp" + i); if (el) el.textContent = fmt(thp(r) - (r.potKasbon || 0)); });
    [...PR_RP.map(([f]) => f), "potLain", "potKasbon"].forEach(f => { const el = $("prt-" + f); if (el) el.textContent = fmt(sumOf(W.rows, r => r[f])); });
    const ek = $("prt-kpi"); if (ek) ek.textContent = fmt(sumOf(W.rows, r => kpiNetOf(r.id)));
    const t = $("prt-thp"); if (t) t.textContent = fmt(prTotal(W.rows) - sumOf(W.rows, r => r.potKasbon));
    const al = {}; W.rows.forEach(r => { const c = r.cabang || "Pusat"; al[c] = (al[c] || 0) + thp(r); });
    $("prAlloc").textContent = W.rows.length ? "Per penempatan: " + Object.entries(al).map(([c, v]) => shortCab(c) + " " + rp(v)).join(" · ") : "";
    if (S.prDirty) $("prMsg").textContent = "Ada perubahan yang belum disimpan.";
  }
  $("prTable").addEventListener("input", e => { const t = e.target; if (t.dataset.r === undefined) return; const r = prWork().rows[+t.dataset.r]; if (!r) return; S.prDirty = true;
    if (t.dataset.k === "d") { const n = parseQty(t.value); r[t.dataset.f] = Number.isFinite(n) ? n : 0; }
    else if (["pokok","tunjangan","bonus","komisi","potLain","potKasbon"].includes(t.dataset.f)) { let n = parseRp(t.value); if (t.dataset.f === "potKasbon") { const sisa = Math.max(0, kbSaldo(r.id).saldo); if (n > sisa) { n = sisa; toast("Potongan kasbon maksimal sisa kasbon " + rp(sisa)); } } t.value = n ? fmt(n) : ""; r[t.dataset.f] = n; }
    else r[t.dataset.f] = t.value;
    updatePrTotals(); });
  $("prTable").addEventListener("click", e => {
    const d = e.target.closest("[data-prdel]"); if (d) { const W = prWork(); W.rows.splice(+d.dataset.prdel, 1); S.prDirty = true; prSig = ""; renderPayroll(); return; }
    const s = e.target.closest("[data-slip]"); if (s) showSlip(prWork().rows[+s.dataset.slip]);
  });
  const newId = () => Math.random().toString(36).slice(2, 10);
  $("prAdd").addEventListener("click", () => { const W = prWork(); S.prDirty = true;
    W.rows.push({ id:newId(), nama:"", jabatan:"", cabang: cabList()[0] || "Pusat", hk:26, hadir:0, izin:0, sakit:0, alpha:0, pokok:0, tunjangan:0, bonus:0, komisi:0, potLain:0, ketPot:"" });
    prSig = ""; renderPayroll(); const ins = $("prTable").querySelectorAll('input[data-f="nama"]'); ins[ins.length - 1]?.focus(); });
  $("prCopy").addEventListener("click", async e => {
    const b = e.currentTarget, W = prWork();
    if (W.rows.length && b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Ganti isi lembar ini?"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Salin dari periode lalu"; }, 4000); return; }
    b.dataset.armed = ""; b.textContent = "Salin dari periode lalu";
    try { const s = await S.db.doc("payroll/" + prevKey(S.month)).get();
      if (!s.exists || !(s.data().rows || []).length) { $("prMsg").textContent = "Payroll " + perName(prevKey(S.month)) + " belum ada."; return; }
      W.rows = s.data().rows.map(r => ({ ...prNorm(r), hadir:0, izin:0, sakit:0, alpha:0, bonus:0, komisi:0, potLain:0, ketPot:"", potKasbon: kasbonCicilan(r.id) })); W.status = "draft"; W.tglBayar = ""; S.prDirty = true; prSig = ""; renderPayroll();
      $("prMsg").textContent = "Disalin dari " + perName(prevKey(S.month)) + ". Absensi, bonus, dan potongan dikosongkan. Jangan lupa simpan."; }
    catch { $("prMsg").textContent = "Gagal mengambil payroll periode lalu."; }
  });
  async function savePayroll(status, tglBayar){
    if (isClosed(S.month)) { $("prMsg").textContent = lockOf(perEnd(S.month)); return false; }
    const W = prWork(); const rows = W.rows.map(r => { const x = { ...r, nama:String(r.nama || "").trim(), jabatan:String(r.jabatan || "").trim() }; delete x.insentif; delete x.lembur; delete x.potongan; return x; });
    if (rows.some(r => !r.nama)) { $("prMsg").textContent = "Ada baris tanpa nama. Isi namanya atau hapus barisnya."; return false; }
    $("prMsg").textContent = "Menyimpan…";
    try { await S.db.doc("payroll/" + S.month).set({ bulan:S.month, periode:S.month, rows, status, tglBayar:tglBayar || "", total:prTotal(rows), by:S.uid || null, at:new Date().toISOString(), contoh:false });
      S.prDirty = false; S.pr = null; prSig = ""; $("prMsg").textContent = ""; return true; }
    catch (err) { $("prMsg").textContent = err?.code === "invalid_argument" ? "Hanya admin yang bisa menyimpan payroll." : "Gagal menyimpan, coba lagi."; return false; }
  }
  $("prSave").addEventListener("click", async () => { if (await savePayroll(prWork().status === "final" ? "final" : "draft", prWork().tglBayar)) toast("Payroll " + perName(S.month) + " tersimpan"); });
  $("prFinal").addEventListener("click", async () => { const W = prWork();
    if (W.status === "final") { if (await savePayroll("draft", "")) toast("Payroll dibuka lagi untuk diedit"); }
    else if (await savePayroll("final", todayISO())) toast("Payroll ditandai sudah dibayar"); });
  $("prCsv").addEventListener("click", async () => { const rows = (S.prDoc?.rows || []).map(prNorm); if (!rows.length) { toast("Payroll periode ini belum disimpan"); return; }
    const q = v => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [["No","Nama","Jabatan","Penempatan","HK","Hadir","Izin","Sakit","Alpha","Gaji pokok","Tunjangan","Bonus","Komisi","KPI","Potongan lain","Ket potongan","Potongan kasbon","Ditransfer"].map(q).join(",")];
    rows.forEach((r, i) => lines.push([i + 1, r.nama, r.jabatan, r.cabang, r.hk, r.hadir, r.izin, r.sakit, r.alpha, r.pokok || 0, r.tunjangan || 0, r.bonus || 0, r.komisi || 0, kpiNetOf(r.id), r.potLain || 0, r.ketPot || "", r.potKasbon || 0, thp(r) - (r.potKasbon || 0)].map(q).join(",")));
    lines.push(["","TOTAL","","","","","","","", sumOf(rows, r => r.pokok), sumOf(rows, r => r.tunjangan), sumOf(rows, r => r.bonus), sumOf(rows, r => r.komisi), sumOf(rows, r => kpiNetOf(r.id)), sumOf(rows, r => r.potLain), "", sumOf(rows, r => r.potKasbon), prTotal(rows) - sumOf(rows, r => r.potKasbon)].map(q).join(","));
    try { await S.dl.save({ filename:`Payroll ${perName(S.month)}.csv`, data:"﻿" + lines.join("\n") }); toast("File disimpan"); }
    catch (err) { if (err?.code === "declined") return; toast("Download gagal, coba lagi"); } });

  // slip gaji (dipakai Payroll & Cek slip). C = { r, k, prDoc, kpi }
  S.slip = null;
  function slipData(C){
    const r = prNorm(C.r), kd = C.kpi || null, kc = kd ? kpiCalc(kd) : null;
    const pend = [["Gaji pokok", r.pokok || 0], ...(r.tunjangan ? [["Tunjangan", r.tunjangan]] : []), ...(r.bonus ? [["Bonus", r.bonus]] : []), ...(r.komisi ? [["Komisi", r.komisi]] : [])];
    if (kc) { pend.push([`Insentif KPI (${kc.poin}/${KPI_MAX} poin${kc.lolos ? "" : ", belum capai " + KPI_CFG.minPoin})`, kc.nilai]); if (kc.review) pend.push(["Bonus Google review", kc.review]); }
    const pot = []; if (kc?.komplain) pot.push(["Potongan komplain (" + (kd.komplain || []).length + ")", kc.komplain]); if (r.potLain) pot.push(["Potongan lain" + (r.ketPot ? " · " + r.ketPot : ""), r.potLain]); if (r.potKasbon) pot.push(["Potongan kasbon", r.potKasbon]);
    const kom = ROLES.map(([k, l]) => [l, (kd?.penilai?.[k] || "").trim(), (kd?.komentar?.[k] || "").trim()]).filter(x => x[2]);
    const total = (r.pokok || 0) + (r.tunjangan || 0) + (r.bonus || 0) + (r.komisi || 0) + (kc ? kc.net : 0) - (r.potLain || 0) - (r.potKasbon || 0);
    return { r, kc, pend, pot, kom, total };
  }
  function showSlip(r, k = S.month, prDoc = S.prDoc, kpi = S.kpiAll[k + "|" + r?.id] || null){
    if (!r) return; S.slip = { r, k, prDoc, kpi }; const D = slipData(S.slip);
    const line = ([l, v]) => `<div class="sl-row"><span>${esc(l)}</span><span class="num">${rp(v)}</span></div>`;
    $("slipTitle").textContent = "Slip gaji · " + (r.nama || "karyawan") + " · " + perName(k);
    $("slip").innerHTML = `<div class="sl-head"><div><b>Lash Bounty</b><span>Slip gaji · ${esc(perName(k))}</span></div><span class="sl-per">${esc(perRange(k))}</span></div>
      <div class="sl-id"><div><span>Nama</span><b>${esc(D.r.nama || "–")}</b></div><div><span>Jabatan</span><b>${esc(D.r.jabatan || "–")}</b></div><div><span>Penempatan</span><b>${esc(D.r.cabang || "–")}</b></div></div>
      <div class="sl-abs">${PR_ABS.map(([f, l]) => `<div><span>${l === "HK" ? "Hari kerja" : l}</span><b>${D.r[f] ?? 0}</b></div>`).join("")}</div>
      <div class="sl-sec"><h4>Pendapatan</h4>${D.pend.map(line).join("")}</div>
      ${D.pot.length ? `<div class="sl-sec"><h4>Potongan</h4>${D.pot.map(line).join("")}</div>` : ""}
      <div class="sl-total"><span>Total ditransfer</span><b class="num">${rp(D.total)}</b></div>
      ${D.kom.length ? `<div class="sl-sec"><h4>Pesan dari atasan</h4>${D.kom.map(([l, n, c]) => `<div class="sl-com"><b>${esc(l)}${n ? " · " + esc(n) : ""}</b><p>${esc(c)}</p></div>`).join("")}</div>` : ""}
      <div class="sl-foot">${prDoc?.status === "final" ? "Dibayar " + esc(fmtDate(prDoc.tglBayar)) : "Draft, belum dibayar"} · dibuat dari Lash Bounty ERP</div>`;
    $("slipSend").hidden = false;
    const num = waNum(r.wa); $("slipWa").hidden = !num; if (num) $("slipWa").href = waLink(num, slipText());
    $("slipPanel").hidden = false; $("slipMsg").textContent = (k === S.month && S.prDirty) ? "Ada perubahan payroll yang belum disimpan. Simpan dulu sebelum kirim slip." : (num ? "" : "No. WA karyawan belum diisi di lembar payroll, jadi tombol Kirim via WA tidak muncul.");
    $("slipPanel").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block:"start" });
  }
  $("slipClose").addEventListener("click", () => { $("slipPanel").hidden = true; });
  function slipText(){ const C = S.slip, D = slipData(C);
    return [`*Slip Gaji Lash Bounty*`, `${perName(C.k)} (${perRange(C.k)})`, ``, `Nama: ${D.r.nama}`, `Jabatan: ${D.r.jabatan || "-"}`, `Penempatan: ${D.r.cabang || "-"}`,
      `Absensi: hari kerja ${D.r.hk ?? 0}, hadir ${D.r.hadir ?? 0}, izin ${D.r.izin ?? 0}, sakit ${D.r.sakit ?? 0}, alpha ${D.r.alpha ?? 0}`, ``, `*Pendapatan*`, ...D.pend.map(([l, v]) => `- ${l}: ${rp(v)}`),
      ...(D.pot.length ? [``, `*Potongan*`, ...D.pot.map(([l, v]) => `- ${l}: ${rp(v)}`)] : []), ``, `*Total ditransfer: ${rp(D.total)}*`,
      ...(D.kom.length ? [``, `*Pesan dari atasan*`, ...D.kom.map(([l, n, c]) => `${l}${n ? " (" + n + ")" : ""}: ${c}`)] : [])].join("\n"); }
  $("slipTxt").addEventListener("click", async () => { if (!S.slip) return; const t = slipText();
    try { await navigator.clipboard.writeText(t); toast("Teks slip disalin, tinggal tempel di WhatsApp"); }
    catch { $("slipMsg").textContent = "Browser menolak salin otomatis. Teks slip:\n" + t; } });
  let h2cP = null;
  const loadH2C = () => h2cP ||= new Promise((res, rej) => { if (window.html2canvas) return res(window.html2canvas); const sc = document.createElement("script");
    sc.charset = "utf-8"; sc.src = "vendor/html2canvas-1.4.1.min.js"; sc.onload = () => res(window.html2canvas); sc.onerror = () => { h2cP = null; rej(new Error("load")); }; document.head.appendChild(sc); });
  $("slipPng").addEventListener("click", async () => {
    if (!S.slip) return; if (!S.dl) { $("slipMsg").textContent = "Download tidak tersedia di tampilan ini. Pakai 'Salin teks WA'."; return; }
    const btn = $("slipPng"); btn.disabled = true; btn.textContent = "Membuat gambar…";
    try { const h2c = await loadH2C(); const el = $("slip");
      const canvas = await h2c(el, { scale: 2, backgroundColor: getComputedStyle(el).backgroundColor || "#ffffff", useCORS: true, logging: false });
      const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
      await S.dl.save({ filename:`Slip Gaji ${S.slip.r.nama || "karyawan"} ${perName(S.slip.k)}.png`, data: blob }); toast("Slip disimpan"); }
    catch (err) { if (err?.code !== "declined") $("slipMsg").textContent = "Gagal membuat gambar slip. Pakai 'Salin teks WA' dulu."; }
    finally { btn.disabled = false; btn.textContent = "Download gambar"; }
  });

  /* ---------- halaman KPI ---------- */
  S.kpiEdit = null;
  const kpiEmps = () => { const rows = S.prDoc?.rows || S.pr?.rows || []; return (rows.length ? rows : kyActive().map(x => ({ id: x.id, nama: x.nama, jabatan: x.jabatan || "", cabang: x.cabang || "Pusat" }))).map(prNorm); };
  function renderKpi(){
    if (canKpi()) { $("kpiRO").hidden = true; $("kpiBody").hidden = false; } else if (!adminGate("kpiBody", "kpiRO")) return;
    const emps = kpiEmps();
    $("kpiListTitle").textContent = "Penilaian KPI · " + perName(S.month);
    $("kpiRule").textContent = `1 poin = ${rp(KPI_CFG.nilaiPoin)} · minimal ${KPI_CFG.minPoin} dari ${KPI_MAX} poin · review +${rp(KPI_CFG.review)}`;
    if (S.db && !((S.prLoaded || !S.admin) && S.kpiLoaded)) $("kpiList").innerHTML = `<tr><td class="empty">Memuat…</td></tr>`;
    else if (!emps.length) $("kpiList").innerHTML = `<tr><td class="empty">Daftar karyawan diambil dari lembar payroll ${perName(S.month)}. Buat atau salin payroll dulu di tab Payroll.</td></tr>`;
    else $("kpiList").innerHTML = `<thead><tr><th>Nama</th><th>Penempatan</th><th>Jabatan</th><th class="r">Poin</th><th class="r">Nilai KPI</th><th>Sudah menilai</th><th></th></tr></thead><tbody>` +
      emps.map(r => { const kd = S.kpiDocs[r.id], c = kpiCalc(kd);
        return `<tr><td><b>${esc(r.nama || "–")}</b></td><td>${esc(shortCab(r.cabang || "Pusat"))}</td><td>${esc(r.jabatan || "–")}</td>
          <td class="r num">${kd ? c.poin + " / " + KPI_MAX : "–"}</td><td class="r num">${kd ? `<span class="${c.lolos ? "" : "up"}">${fmt(c.net)}</span>` : "–"}</td>
          <td>${ROLES.map(([k, l]) => `<span class="pill ${kd && c.isi[k] ? "ok" : "no"}" style="font-size:11.5px;margin-right:4px">${l}</span>`).join("")}</td>
          <td class="r"><button class="btn ${S.kpiEdit?.id === r.id ? "primary" : ""}" type="button" data-kpi="${esc(r.id)}">${kd ? "Buka" : "Nilai"}</button></td></tr>`; }).join("") + `</tbody>`;
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-kpi]"); if (!b) return; openKpi(b.dataset.kpi); });
  function openKpi(id){
    const r = kpiEmps().find(x => x.id === id); if (!r) return;
    const kd = S.kpiDocs[id] || {};
    S.kpiEdit = { id, r, sheet: JSON.parse(JSON.stringify({ cek: kd.cek || {}, nilai: kd.nilai || {}, catatan: kd.catatan || {}, komentar: kd.komentar || {}, penilai: kd.penilai || {}, komplain: kd.komplain || [], review: !!kd.review })) };
    $("kpiSheetPanel").hidden = false; $("kpiMsg").textContent = "";
    $("kpiSheetEyebrow").textContent = "Penilaian KPI · " + perName(S.month);
    $("kpiSheetTitle").textContent = (r.nama || "–") + " · " + (r.jabatan || "–") + " · " + shortCab(r.cabang || "Pusat");
    renderKpiSheet(); renderKpi();
    $("kpiSheetPanel").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block:"start" });
  }
  function renderKpiSheet(){
    const E = S.kpiEdit; if (!E) return; const sh = E.sheet, r = E.r;
    const absHint = (r.izin || 0) + (r.sakit || 0) + (r.alpha || 0);
    let h = `<thead><tr><th>Faktor</th><th>Rincian penilaian</th><th class="r">Poin</th>${ROLES.map(([, l]) => `<th class="c">${l}</th>`).join("")}<th class="r">Dapat</th><th>Catatan</th></tr></thead><tbody>`;
    KPI_T.forEach(([fid, fn, its]) => its.forEach(([id, label, poin, type], j) => {
      h += `<tr>${j === 0 ? `<td rowspan="${its.length}" class="kf"><b>${esc(fn)}</b></td>` : ""}<td>${esc(label)}${id === "absen" && absHint ? `<small class="warn-t">Payroll: izin/sakit/alpha ${absHint} hari</small>` : ""}</td><td class="r num">${poin}</td>` +
        (type === "jumlah" ? `<td colspan="3"><input type="text" inputmode="numeric" class="kn" data-kn="${id}" value="${esc(sh.nilai[id] ?? "")}" placeholder="Jumlah customer" aria-label="Jumlah customer"></td>`
          : ROLES.map(([rk, rl]) => `<td class="c"><input type="checkbox" data-kc="${id}" data-role="${rk}" ${sh.cek[id]?.[rk] ? "checked" : ""} aria-label="${rl}: ${esc(label)}"></td>`).join("")) +
        `<td class="r num" id="kd-${id}"></td><td><input type="text" class="kt" data-kt="${id}" value="${esc(sh.catatan[id] || "")}" placeholder="Catatan" maxlength="200" aria-label="Catatan ${esc(label)}"></td></tr>`; }));
    $("kpiTable").innerHTML = h + `</tbody>`;
    $("kpiKomplain").innerHTML = sh.komplain.length ? sh.komplain.map((k, i) => `<div class="kk-row"><select data-kk="${i}" data-f="tingkat" aria-label="Tingkat komplain">${optList(Object.keys(KPI_CFG.komplain), k.tingkat)}</select><input type="text" data-kk="${i}" data-f="ket" value="${esc(k.ket || "")}" placeholder="Keterangan komplain" maxlength="200" aria-label="Keterangan komplain"><button class="btn ghost danger" type="button" data-kkdel="${i}" aria-label="Hapus komplain">✕</button></div>`).join("") : `<p class="note" style="margin:0">Tidak ada komplain.</p>`;
    $("kpiReview").checked = !!sh.review;
    ROLES.forEach(([k]) => { const K = k[0].toUpperCase() + k.slice(1); $("kc" + K).value = sh.komentar[k] || ""; $("kn" + K).value = sh.penilai[k] || ""; });
    updateKpiSum();
  }
  function updateKpiSum(){
    const E = S.kpiEdit; if (!E) return; const sh = E.sheet, c = kpiCalc(sh);
    KPI_ITEMS.forEach(it => { const el = $("kd-" + it.id); if (!el) return; let got;
      if (it.type === "jumlah") { const n = Number(sh.nilai[it.id]) || 0; got = n >= 120 ? 2 : n >= 85 ? 1 : 0; } else { const x = sh.cek[it.id] || {}; got = x.mod && x.trainer && x.owner ? it.poin : 0; }
      el.innerHTML = got ? `<b style="color:var(--good)">${got}</b>` : `<span class="note">0</span>`; });
    $("kpiSum").innerHTML = `<div class="ks-row"><span>Total poin</span><b class="num">${c.poin} / ${KPI_MAX}</b></div>
      <div class="ks-row"><span>Status</span><b class="${c.lolos ? "down" : "up"}">${c.lolos ? "Capai minimal " + KPI_CFG.minPoin + " poin" : "Belum capai " + KPI_CFG.minPoin + " poin"}</b></div>
      <div class="ks-row"><span>Nilai poin (${c.poin} × ${rp(KPI_CFG.nilaiPoin)})</span><span class="num">${rp(c.nilai)}</span></div>
      <div class="ks-row"><span>Potongan komplain</span><span class="num">− ${rp(c.komplain)}</span></div>
      <div class="ks-row"><span>Bonus Google review</span><span class="num">+ ${rp(c.review)}</span></div>
      <div class="ks-row total"><span>Total KPI ke payroll</span><b class="num">${rp(c.net)}</b></div>`;
  }
  $("kpiTable").addEventListener("change", e => { const t = e.target, E = S.kpiEdit; if (!E) return;
    if (t.dataset.kc) { (E.sheet.cek[t.dataset.kc] ||= {})[t.dataset.role] = t.checked; updateKpiSum(); } });
  $("kpiTable").addEventListener("input", e => { const t = e.target, E = S.kpiEdit; if (!E) return;
    if (t.dataset.kn) { E.sheet.nilai[t.dataset.kn] = t.value.replace(/[^\d]/g, ""); t.value = E.sheet.nilai[t.dataset.kn]; updateKpiSum(); }
    if (t.dataset.kt) E.sheet.catatan[t.dataset.kt] = t.value; });
  $("kpiKomplain").addEventListener("input", e => { const t = e.target, E = S.kpiEdit; if (!E || t.dataset.kk === undefined) return; E.sheet.komplain[+t.dataset.kk][t.dataset.f] = t.value; updateKpiSum(); });
  $("kpiKomplain").addEventListener("change", e => { const t = e.target, E = S.kpiEdit; if (!E || t.dataset.kk === undefined) return; E.sheet.komplain[+t.dataset.kk][t.dataset.f] = t.value; updateKpiSum(); });
  $("kpiKomplain").addEventListener("click", e => { const b = e.target.closest("[data-kkdel]"); if (!b || !S.kpiEdit) return; S.kpiEdit.sheet.komplain.splice(+b.dataset.kkdel, 1); renderKpiSheet(); });
  $("kpiAddKomplain").addEventListener("click", () => { if (!S.kpiEdit) return; S.kpiEdit.sheet.komplain.push({ tingkat:"Low", ket:"" }); renderKpiSheet(); });
  $("kpiReview").addEventListener("change", e => { if (S.kpiEdit) { S.kpiEdit.sheet.review = e.target.checked; updateKpiSum(); } });
  ROLES.forEach(([k]) => { const K = k[0].toUpperCase() + k.slice(1);
    $("kc" + K).addEventListener("input", e => { if (S.kpiEdit) S.kpiEdit.sheet.komentar[k] = e.target.value; });
    $("kn" + K).addEventListener("input", e => { if (S.kpiEdit) S.kpiEdit.sheet.penilai[k] = e.target.value; }); });
  $("kpiClose").addEventListener("click", () => { S.kpiEdit = null; $("kpiSheetPanel").hidden = true; renderKpi(); });
  $("kpiSave").addEventListener("click", async () => {
    const E = S.kpiEdit; if (!E || !S.db) return; if (isClosed(S.month)) { $("kpiMsg").textContent = lockOf(perEnd(S.month)); return; } const btn = $("kpiSave"); btn.disabled = true; $("kpiMsg").textContent = "Menyimpan…";
    const c = kpiCalc(E.sheet);
    try { await S.db.doc("kpi/" + S.month + "_" + E.id).set({ periode:S.month, empId:E.id, nama:E.r.nama || "", cabang:E.r.cabang || "", jabatan:E.r.jabatan || "", ...E.sheet,
        poin:c.poin, net:c.net, by:S.uid || null, at:new Date().toISOString(), contoh:false });
      $("kpiMsg").textContent = ""; toast("KPI " + (E.r.nama || "") + " tersimpan · " + c.poin + "/" + KPI_MAX + " poin · " + rp(c.net)); }
    catch (err) { $("kpiMsg").textContent = err?.code === "invalid_argument" ? "Hanya admin yang bisa menyimpan KPI." : "Gagal menyimpan, coba lagi."; }
    finally { btn.disabled = false; }
  });

  /* ---------- stok: opening, jurnal masuk/keluar, stock opname ---------- */
  S.stok = null; S.stokLoaded = false; S.opn = []; S.opnLoaded = false; S.drafts = {};
  const JENIS = {
    opening: { title:"Opening stock", label:"Tanggal opening", btn:"Kirim opening stock", help:"Isi stok awal periode untuk semua barang (biasanya tanggal 1). Isi 0 kalau tidak ada.", ok:"Opening stock terkirim", all:true },
    jurnal:  { title:"Jurnal masuk / keluar", label:"Tanggal", btn:"Kirim jurnal masuk / keluar", help:"Isi barang yang masuk (kiriman, beli) dan yang keluar (dipakai, rusak, dikirim). Barang lain biarkan kosong. Setengah boleh ditulis 0,5.", ok:"Jurnal masuk / keluar tercatat", all:false },
    opname:  { title:"Laporan stock opname", label:"Tanggal opname", btn:"Kirim laporan stock opname", help:"Hitung fisik barang di cabang, lalu isi jumlahnya. Isi 0 kalau habis. Setengah boleh ditulis 0,5.", ok:"Laporan stock opname terkirim", all:true }
  };
  const jenisOf = o => o.jenis === "masuk" ? "jurnal" : (o.jenis || "opname");
  S.jenis = JENIS[ls.get("rpc-jenis")] ? ls.get("rpc-jenis") : "opname";
  const itemList = () => (S.stok?.items || []).filter(it => it && it.nama);
  const opCab = () => S.staff || $("oCabang").value;
  $("oTanggal").value = todayISO();
  const parseQty = v => { let s = String(v ?? "").trim().toLowerCase(); if (s === "" || s === "-" || s === "–") return null;
    if (/^(setengah|½|1\/2)$/.test(s)) return 0.5; s = s.replace(",", "."); const n = Number(s); return Number.isFinite(n) && n >= 0 ? n : NaN; };
  const fmtQty = n => n == null ? "–" : String(Math.round(n * 100) / 100).replace(".", ",");
  const draftKey = (c, j) => "rpc-opdraft-" + j + "-" + slug(c);
  function getDraft(c){ const k = draftKey(c, S.jenis); if (!S.drafts[k]) { try { S.drafts[k] = JSON.parse(ls.get(k) || "{}"); } catch { S.drafts[k] = {}; } } return S.drafts[k]; }
  function setDraft(c, d){ const k = draftKey(c, S.jenis); S.drafts[k] = d; ls.set(k, JSON.stringify(d)); }
  const opOrder = (a,b) => (b.tanggal||"").localeCompare(a.tanggal||"") || (b.at||"").localeCompare(a.at||"");
  const lastOpname = (c, endISO) => S.opn.filter(o => o.cabang===c && jenisOf(o)==="opname" && (!endISO || (o.tanggal||"") <= endISO)).sort(opOrder)[0] || null;
  const itemOf = (op, nama) => (op?.items || []).find(x => x.nama === nama) || null;
  const qtyOf = (op, nama) => { const it = itemOf(op, nama); return it && it.qty != null ? it.qty : null; };
  const inOf = it => it ? (it.masuk != null ? it.masuk : (it.qty || 0)) : 0;
  const outOf = it => it ? (it.keluar || 0) : 0;
  function monthEnd(k){ const [y,m] = k.split("-").map(Number); return k + "-" + String(new Date(y, m, 0).getDate()).padStart(2, "0"); }
  const r2 = n => Math.round(n * 100) / 100;

  // kartu stok: opening + masuk - keluar = saldo; opname - saldo = selisih
  function kartu(c, k){
    const inMonth = S.opn.filter(o => o.cabang === c && inPer(o.tanggal, k));
    const openDoc = inMonth.filter(o => jenisOf(o) === "opening").sort(opOrder)[0] || null;
    const prevClose = openDoc ? null : lastOpname(c, perEnd(prevKey(k)));
    const opening = openDoc || prevClose;
    const closeDoc = inMonth.filter(o => jenisOf(o) === "opname").sort(opOrder)[0] || null;
    const jDocs = inMonth.filter(o => jenisOf(o) === "jurnal" && (!closeDoc || (o.tanggal||"") <= closeDoc.tanggal));
    const rows = itemList().map(it => {
      const op = qtyOf(opening, it.nama);
      const ms = r2(jDocs.reduce((s, d) => s + inOf(itemOf(d, it.nama)), 0));
      const kl = r2(jDocs.reduce((s, d) => s + outOf(itemOf(d, it.nama)), 0));
      const saldo = op != null ? r2(op + ms - kl) : null;
      const cl = qtyOf(closeDoc, it.nama);
      const sel = (saldo != null && cl != null) ? r2(cl - saldo) : null;
      return { it, op, ms, kl, saldo, cl, sel };
    });
    return { openDoc, prevClose, closeDoc, jDocs, rows };
  }

  function setJenis(j){
    S.jenis = j; ls.set("rpc-jenis", j); const J = JENIS[j];
    document.querySelectorAll(".seg-j button").forEach(b => b.setAttribute("aria-pressed", b.dataset.j === j));
    $("opTitle").textContent = J.title; $("oTglLabel").textContent = J.label; $("opSave").textContent = J.btn; $("opHelp").textContent = J.help;
    $("opMsg").textContent = ""; opSig = ""; renderOpForm();
  }
  document.querySelectorAll(".seg-j button").forEach(b => b.addEventListener("click", () => setJenis(b.dataset.j)));

  let opSig = "";
  const filled = v => String(v ?? "").trim() !== "";
  function updateOpProg(){
    const items = itemList(), c = opCab();
    if (!items.length || !c) { $("opProg").textContent = ""; return; }
    const d = getDraft(c);
    if (S.jenis === "jurnal") { const n = items.filter(it => filled(d[it.nama + "|m"]) || filled(d[it.nama + "|k"])).length; $("opProg").textContent = n ? n + " barang diisi" : ""; return; }
    const n = items.filter(it => filled(d[it.nama])).length; $("opProg").textContent = n + " / " + items.length + " terisi";
  }
  function renderOpForm(){
    const c = opCab(), items = itemList(), list = $("opList");
    if (!S.db && S.booted) { list.innerHTML = `<div class="empty">Server belum tersambung. Cek koneksi lalu muat ulang halaman.</div>`; opSig = ""; return; }
    if (!S.stokLoaded || !S.opnLoaded) return;
    if (!items.length) { list.innerHTML = `<div class="empty">Belum ada daftar barang. Admin perlu mengisinya di Pengaturan.</div>`; opSig = ""; updateOpProg(); return; }
    if (!c) { list.innerHTML = `<div class="empty">Pilih cabang dulu.</div>`; opSig = ""; return; }
    const last = lastOpname(c);
    const sig = S.jenis + "|" + c + "|" + items.map(i => i.nama + "/" + (i.satuan||"")).join(",") + "|" + (last?.id || "");
    if (sig === opSig) { updateOpProg(); return; }
    opSig = sig;
    const d = getDraft(c), two = S.jenis === "jurnal";
    const hintOf = it => { const lq = qtyOf(last, it.nama); return last && lq != null ? "Opname terakhir: " + esc(fmtQty(lq)) + (it.satuan ? " " + esc(it.satuan) : "") + " (" + esc(fmtDate(last.tanggal)) + ")" : (it.satuan ? esc(it.satuan) : "Belum pernah dihitung"); };
    list.innerHTML = (two ? `<div class="op-head"><span></span><span>Masuk</span><span>Keluar</span></div>` : "") + items.map((it, i) => two
      ? `<div class="op-row two" id="opr${i}"><div><b>${esc(it.nama)}</b><small>${hintOf(it)}</small></div>
          <div class="qty"><input type="text" inputmode="decimal" data-nama="${esc(it.nama)}" data-k="m" value="${esc(d[it.nama + "|m"] ?? "")}" aria-label="Masuk ${esc(it.nama)}" placeholder="–"></div>
          <div class="qty"><input type="text" inputmode="decimal" data-nama="${esc(it.nama)}" data-k="k" value="${esc(d[it.nama + "|k"] ?? "")}" aria-label="Keluar ${esc(it.nama)}" placeholder="–"></div></div>`
      : `<div class="op-row" id="opr${i}"><div><b>${esc(it.nama)}</b><small>${hintOf(it)}</small></div>
          <div class="qty"><input type="text" inputmode="decimal" data-nama="${esc(it.nama)}" value="${esc(d[it.nama] ?? "")}" aria-label="Jumlah ${esc(it.nama)}" placeholder="0"><span>${esc(it.satuan||"")}</span></div></div>`).join("");
    $("oCatatan").value = d.__catatan ?? "";
    updateOpProg();
  }
  $("opList").addEventListener("input", e => { const t = e.target; if (!t.dataset.nama) return; const c = opCab(); if (!c) return; const d = getDraft(c);
    d[t.dataset.k ? t.dataset.nama + "|" + t.dataset.k : t.dataset.nama] = t.value; setDraft(c, d); t.closest(".op-row")?.classList.remove("miss"); updateOpProg(); });
  $("oCatatan").addEventListener("input", () => { const c = opCab(); if (!c) return; const d = getDraft(c); d.__catatan = $("oCatatan").value; setDraft(c, d); });
  $("oCabang").addEventListener("change", e => { ls.set("rpc-cabang", e.target.value); opSig = ""; renderOpForm(); });

  // isi dari foto (AI)
  $("opPhoto").addEventListener("change", async e => {
    const file = e.target.files?.[0]; e.target.value = ""; const c = opCab(), items = itemList(), msg = $("opMsg");
    if (!file || !S.sample) return;
    if (!c) { msg.textContent = "Pilih cabang dulu."; return; }
    if (!items.length) { msg.textContent = "Belum ada daftar barang."; return; }
    const btn = $("opPhotoBtn"); btn.textContent = "Membaca foto…"; msg.textContent = "";
    const two = S.jenis === "jurnal";
    const shape = two ? `{"tanggal":"YYYY-MM-DD atau null","items":[{"nama":"nama persis dari daftar","masuk":angka atau null,"keluar":angka atau null}],"tidak_cocok":["teks nama barang di foto yang tidak ada di daftar"]}`
                      : `{"tanggal":"YYYY-MM-DD atau null","items":[{"nama":"nama persis dari daftar","qty":angka atau null}],"tidak_cocok":["teks nama barang di foto yang tidak ada di daftar"]}`;
    try {
      const out = await S.sample.json(
        "Gambar ini adalah foto lembar stok salon kecantikan di Indonesia (biasanya berjudul \"Jurnal Stock\", kolom: TGL, NAMA BARANG, MASUK, KELUAR, KETERANGAN, PENERIMA/PENGIRIM, APPROVAL). Isinya tulisan tangan.\n" +
        "Jenis laporan yang sedang diisi: " + JENIS[S.jenis].title + ".\n" +
        (two ? "Ambil angka kolom MASUK dan kolom KELUAR untuk setiap barang.\n"
             : "Ambil jumlah stok setiap barang. Kalau lembar punya kolom MASUK dan KELUAR, pakai angka yang tertulis di kolom MASUK sebagai jumlah stok.\n") +
        "Aturan membaca: \"setengah\" atau \"½\" = 0.5; tanda \"-\" atau kosong = null; kalau ada koreksi/tip-ex, baca angka akhir yang terlihat; jangan menebak angka yang tidak terbaca (isi null).\n" +
        "Daftar barang yang valid (pakai nama persis dari daftar ini): " + JSON.stringify(items.map(i => i.nama)) + ".\n" +
        "Cocokkan setiap baris di foto ke nama di daftar (ejaan tulisan tangan bisa beda, misalnya \"lem eyelash\" = \"Lem eyelash\"). Kalau bulan tertulis tanpa tanggal, isi tanggal null.\n" +
        "Balas hanya JSON: " + shape,
        { images:[file], modelTier:"default" });
      const byName = {}; items.forEach(it => byName[it.nama.toLowerCase()] = it.nama);
      const d = getDraft(c); let n = 0;
      const put = (k, v) => { const q = Number(v); if (v != null && Number.isFinite(q) && q >= 0) { d[k] = String(q).replace(".", ","); return true; } return false; };
      (Array.isArray(out?.items) ? out.items : []).forEach(x => { const nm = byName[String(x?.nama || "").toLowerCase().trim()]; if (!nm) return;
        const got = two ? [put(nm + "|m", x.masuk), put(nm + "|k", x.keluar)].some(Boolean) : put(nm, x.qty); if (got) n++; });
      if (out?.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(out.tanggal)) $("oTanggal").value = out.tanggal;
      setDraft(c, d); opSig = ""; renderOpForm();
      const tc = Array.isArray(out?.tidak_cocok) ? out.tidak_cocok.filter(Boolean) : [];
      msg.textContent = n ? `${n} barang terisi dari foto. Cek angkanya, lalu kirim.` + (tc.length ? ` Tidak ada di daftar barang: ${tc.slice(0,4).join(", ")}${tc.length > 4 ? "…" : ""}.` : "") : "Foto tidak terbaca jelas. Coba foto lebih terang dan lurus, atau isi manual.";
    } catch (err) {
      if (["not_granted","sampling_disabled","not_declared","capability_disabled","capability_removed","images_unavailable"].includes(err?.code)) { $("opScan").hidden = true; msg.textContent = "Isi dari foto tidak tersedia di tampilan ini."; }
      else if (err?.code === "rate_limited") msg.textContent = "Terlalu banyak permintaan. Coba lagi beberapa menit lagi.";
      else if (err?.code === "image_rejected") msg.textContent = "Foto tidak bisa dibaca. Coba foto lain (JPG/PNG).";
      else if (err?.code !== "cancelled") msg.textContent = "Gagal membaca foto. Coba lagi atau isi manual.";
    } finally { btn.textContent = "Pilih foto"; }
  });

  $("opSave").addEventListener("click", async () => {
    const msg = $("opMsg"), c = opCab(), items = itemList(), J = JENIS[S.jenis];
    if (!S.db) { msg.textContent = "Server belum tersambung. Cek koneksi lalu muat ulang halaman."; return; }
    if (!c) { msg.textContent = "Pilih cabang dulu."; return; }
    if (!items.length) { msg.textContent = "Belum ada daftar barang."; return; }
    const tgl = $("oTanggal").value; if (!tgl) { msg.textContent = "Isi tanggalnya dulu."; return; }
    { const lk = lockOf(tgl); if (lk) { msg.textContent = lk; return; } }
    const pengisi = $("oPengisi").value.trim(); if (!pengisi) { msg.textContent = "Isi nama pengisi."; $("oPengisi").focus(); return; }
    const d = getDraft(c); const out = []; let miss = 0, bad = 0;
    items.forEach((it, i) => { const row = $("opr" + i);
      if (S.jenis === "jurnal") {
        const m = parseQty(d[it.nama + "|m"]), k = parseQty(d[it.nama + "|k"]);
        if (Number.isNaN(m) || Number.isNaN(k)) { bad++; row?.classList.add("miss"); return; }
        row?.classList.remove("miss");
        if ((m || 0) > 0 || (k || 0) > 0) out.push({ nama: it.nama, satuan: it.satuan || "", masuk: m || 0, keluar: k || 0 });
        return; }
      const q = parseQty(d[it.nama]);
      if (q === null) { miss++; row?.classList.add("miss"); }
      else if (Number.isNaN(q)) { bad++; row?.classList.add("miss"); }
      else { row?.classList.remove("miss"); out.push({ nama: it.nama, satuan: it.satuan || "", qty: q }); } });
    if (miss) { msg.textContent = `Masih ada ${miss} barang yang kosong. Isi 0 kalau habis.`; document.querySelector(".op-row.miss input")?.focus(); return; }
    if (bad) { msg.textContent = "Ada jumlah yang tidak valid. Isi angka saja, misalnya 12, 2,5, atau tulis setengah."; document.querySelector(".op-row.miss input")?.focus(); return; }
    if (!out.length) { msg.textContent = "Isi minimal 1 barang yang masuk atau keluar."; return; }
    const doc = { jenis: S.jenis, cabang: c, tanggal: tgl, bulan: tgl.slice(0, 7), items: out, catatan: $("oCatatan").value.trim(), pengisi, by: S.uid || null, at: new Date().toISOString(), contoh: false };
    const btn = $("opSave"); btn.disabled = true; msg.textContent = "Mengirim…";
    try {
      await S.db.collection("opname").add(doc);
      setDraft(c, {}); opSig = ""; $("oCatatan").value = ""; msg.textContent = "";
      $("opOkTitle").textContent = J.ok;
      $("opOkSub").textContent = (S.staff ? "" : shortCab(c) + " · ") + out.length + " barang · " + fmtDate(tgl) + ".";
      $("opOk").hidden = false; window.scrollTo({ top: 0 });
      clearTimeout(S.opT); S.opT = setTimeout(() => { $("opOk").hidden = true; }, 10000);
      renderOpForm();
    } catch (err) {
      msg.textContent = err?.code === "invalid_argument" ? "Akun kamu belum punya akses untuk menyimpan ini. Hubungi admin." :
        err?.code === "quota_exceeded" ? "Penyimpanan penuh. Minta admin hapus data lama." : "Gagal mengirim, coba lagi sebentar.";
    } finally { btn.disabled = false; }
  });

  function renderStok(){
    renderOpForm();
    if (document.body.classList.contains("staff")) { $("pStok").hidden = false; $("pAset").hidden = true; }
    if (document.body.classList.contains("staff")) return;
    const cabs = cabList(), items = itemList(), end = perEnd(S.month);
    { const keep = $("ksCabang").value; $("ksCabang").innerHTML = cabs.map(c => `<option>${esc(c)}</option>`).join(""); if (cabs.includes(keep)) $("ksCabang").value = keep; }
    const inM = S.opn.filter(o => inPer(o.tanggal, S.month));
    const hasOpen = cabs.filter(c => inM.some(o => o.cabang === c && jenisOf(o) === "opening"));
    const hasClose = cabs.filter(c => inM.some(o => o.cabang === c && jenisOf(o) === "opname"));
    const latest = {}; cabs.forEach(c => latest[c] = lastOpname(c, end));
    let low = 0; items.forEach(it => { if (!(it.min > 0)) return; cabs.forEach(c => { const q = qtyOf(latest[c], it.nama); if (q != null && q < it.min) low++; }); });
    let selisihN = 0; cabs.forEach(c => kartu(c, S.month).rows.forEach(r => { if (r.sel != null && r.sel !== 0) selisihN++; }));
    const notYet = (arr) => cabs.filter(c => !arr.includes(c)).map(shortCab).join(", ");
    $("stKpis").innerHTML = [
      ["Opening stock", `<span class="num">${hasOpen.length} / ${cabs.length}</span>`, hasOpen.length < cabs.length ? "Belum: " + esc(notYet(hasOpen)) : (cabs.length ? "Semua cabang sudah" : "–")],
      ["Stock opname", `<span class="num">${hasClose.length} / ${cabs.length}</span>`, hasClose.length < cabs.length ? "Belum: " + esc(notYet(hasClose)) : (cabs.length ? "Semua cabang sudah" : "–")],
      ["Selisih stok", `<span class="num ${selisihN ? "up" : ""}">${selisihN}</span>`, selisihN ? "barang × cabang beda dengan catatan" : "opname cocok dengan catatan"],
      ["Di bawah minimum", `<span class="num ${low ? "up" : ""}">${low}</span>`, low ? "barang × cabang" : "semua aman"]
    ].map(([l,v,s]) => `<div class="kpi"><span class="l">${l}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join("");

    const kc = $("ksCabang").value || cabs[0];
    $("ksTitle").textContent = (kc ? shortCab(kc) : "–") + " · " + mName(S.month);
    if (S.db && !S.opnLoaded) $("ksTable").innerHTML = `<tr><td class="empty">Memuat…</td></tr>`;
    else if (!items.length || !kc) $("ksTable").innerHTML = `<tr><td class="empty">Isi daftar cabang dan daftar barang di Pengaturan dulu.</td></tr>`;
    else {
      const K = kartu(kc, S.month);
      const opLabel = K.openDoc ? fmtDate(K.openDoc.tanggal) : K.prevClose ? "opname " + fmtDate(K.prevClose.tanggal) : "belum ada";
      const clLabel = K.closeDoc ? fmtDate(K.closeDoc.tanggal) : "belum ada";
      const cell = (v, cls = "", pre = "") => v == null || v === 0 && pre ? `<td class="q na">–</td>` : `<td class="q ${cls}"><b>${pre}${esc(fmtQty(v))}</b></td>`;
      let h = `<thead><tr><th>Barang</th><th class="c">Opening<small>${esc(opLabel)}</small></th><th class="c">Masuk<small>${K.jDocs.length} jurnal</small></th><th class="c">Keluar<small>dicatat</small></th><th class="c">Saldo<small>hitungan</small></th><th class="c">Opname<small>${esc(clLabel)}</small></th><th class="c">Selisih<small>opname − saldo</small></th></tr></thead><tbody>`;
      K.rows.forEach(r => { const isLow = r.it.min > 0 && r.cl != null && r.cl < r.it.min;
        h += `<tr><td><b>${esc(r.it.nama)}</b>${r.it.satuan ? ` <span class="note">${esc(r.it.satuan)}</span>` : ""}</td>` +
          cell(r.op) + cell(r.ms, "", "+") + cell(r.kl, "", "−") + cell(r.saldo) + cell(r.cl, isLow ? "low" : "") +
          (r.sel == null ? `<td class="q na">–</td>` : r.sel === 0 ? `<td class="q" style="color:var(--good)"><b>0</b></td>` : `<td class="q low"><b>${r.sel > 0 ? "+" : ""}${esc(fmtQty(r.sel))}</b><small>${r.sel < 0 ? "kurang dari catatan" : "lebih dari catatan"}</small></td>`) + `</tr>`; });
      $("ksTable").innerHTML = h + `</tbody>`;
    }

    $("stTitle").textContent = "Posisi stok · akhir " + mName(S.month);
    if (S.db && !S.opnLoaded) $("stTable").innerHTML = `<tr><td class="empty">Memuat…</td></tr>`;
    else if (!items.length || !cabs.length) $("stTable").innerHTML = `<tr><td class="empty">Isi daftar cabang dan daftar barang di Pengaturan dulu.</td></tr>`;
    else {
      let h = `<thead><tr><th>Barang</th><th class="r">Min</th>${cabs.map(c => `<th class="c">${esc(shortCab(c))}<small>${latest[c] ? esc(fmtDate(latest[c].tanggal)) : "belum opname"}</small></th>`).join("")}</tr></thead><tbody>`;
      items.forEach(it => {
        h += `<tr><td><b>${esc(it.nama)}</b>${it.satuan ? ` <span class="note">${esc(it.satuan)}</span>` : ""}</td><td class="r num">${it.min > 0 ? esc(fmtQty(it.min)) : "–"}</td>` +
          cabs.map(c => { const q = qtyOf(latest[c], it.nama); if (q == null) return `<td class="q na">–</td>`; const isLow = it.min > 0 && q < it.min;
            return `<td class="q ${isLow ? "low" : ""}"><b>${esc(fmtQty(q))}</b></td>`; }).join("") + `</tr>`;
      });
      $("stTable").innerHTML = h + `</tbody>`;
    }

    const JL = { opening:"Opening", jurnal:"Masuk/keluar", opname:"Opname" };
    const hist = inM.slice().sort(opOrder);
    $("stHistHint").textContent = hist.length ? hist.length + " laporan di " + mName(S.month) : "";
    $("stHist").innerHTML = hist.length ? `<thead><tr><th>Tanggal</th><th>Jenis</th><th>Cabang</th><th class="r">Barang</th><th>Oleh</th><th>Catatan</th>${S.admin ? "<th></th>" : ""}</tr></thead><tbody>` +
      hist.map(o => { const j = jenisOf(o); return `<tr><td class="num">${esc(fmtDate(o.tanggal))}</td><td><span class="pill ${j === "opname" ? "ok" : j === "jurnal" ? "warn" : ""}" style="${j === "opening" ? "background:var(--accent-soft);color:var(--accent)" : ""}">${JL[j]}</span></td><td>${esc(o.cabang)}</td><td class="r num">${(o.items || []).length}</td><td>${esc(o.pengisi || "–")}</td><td class="k">${esc(o.catatan || "–")} ${o.contoh ? `<span class="tag contoh">contoh</span>` : ""}</td>${S.admin ? `<td class="r"><button class="btn ghost danger" data-delop="${esc(o.id)}">Hapus</button></td>` : ""}</tr>`; }).join("") + `</tbody>`
      : `<tr><td class="empty">Belum ada laporan stok di ${mName(S.month)}.</td></tr>`;
  }
  $("ksCabang").addEventListener("change", renderStok);
  document.addEventListener("click", async e => {
    const b = e.target.closest("[data-delop]"); if (!b) return;
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Yakin?"; setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.textContent = "Hapus"; } }, 3000); return; }
    b.disabled = true;
    try { await S.db.doc("opname/" + b.dataset.delop).delete(); toast("Laporan dihapus"); } catch { toast("Gagal menghapus"); b.disabled = false; }
  });
  $("stCsvBtn").addEventListener("click", async () => {
    const kc = $("ksCabang").value, items = itemList(); if (!items.length || !kc) { toast("Belum ada data"); return; }
    const K = kartu(kc, S.month);
    const q = v => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [["Cabang","Bulan","Barang","Satuan","Opening","Masuk","Keluar","Saldo","Opname","Selisih"].map(q).join(",")];
    K.rows.forEach(r => lines.push([kc, mName(S.month), r.it.nama, r.it.satuan || "", r.op ?? "", r.ms || 0, r.kl || 0, r.saldo ?? "", r.cl ?? "", r.sel ?? ""].map(q).join(",")));
    try { await S.dl.save({ filename: `Kartu Stok ${shortCab(kc)} ${mName(S.month)}.csv`, data: "﻿" + lines.join("\n") }); toast("File disimpan"); }
    catch (err) { if (err?.code === "declined") return; toast("Download gagal, coba lagi"); }
  });
  setJenis(S.jenis);
  // showHrd & showPsub dipanggil setelah semua modul siap (lihat akhir)

  /* ---------- dashboard owner ---------- */
  S.dDesc = false;
  const isPromoName = n => /promo|paket|bundl|disc|diskon|voucher|gratis|free/i.test(n || "");
  function dashData(){
    const k = S.rk, cabs = [...cabList()], G = grups();
    const ms = S.sales.filter(s => inPer(s.tanggal, k)), pms = S.sales.filter(s => inPer(s.tanggal, prevKey(k)));
    ms.forEach(s => { if (s.cabang && !cabs.includes(s.cabang)) cabs.push(s.cabang); });
    const omzet = sumOf(ms, s => s.total);
    const days = perDays(k), pdays = perDays(prevKey(k));
    const lastIdx = ms.reduce((m, s) => Math.max(m, days.indexOf(s.tanggal)), -1);
    const prevSame = sumOf(pms.filter(s => { const i = pdays.indexOf(s.tanggal); return i >= 0 && i <= lastIdx; }), s => s.total);
    const omCab = c => sumOf(ms.filter(s => s.cabang === c), s => s.total);
    const omGrup = g => sumOf(cabsOfGrup(g), omCab);
    const t = todayISO(); const ex = jurnalLines(k).filter(l => l.src !== "pr" && l.tanggal <= t);
    return { k, cabs, G, ms, pms, omzet, prevSame, days, lastIdx, omCab, omGrup, ex };
  }
  const grupCol = g => `var(--s${(grups().indexOf(g) % 8) + 1})`;
  function renderDash(){
    if (!adminGate("dashBody", "dashRO")) return;
    const D = dashData(), k = D.k, G = D.G;
    const chg = D.prevSame ? D.omzet / D.prevSame - 1 : null, nLap = D.lastIdx + 1;
    const exTot = sumOf(D.ex, l => l.jumlah);
    $("dKpis").innerHTML = [
      ["Omzet periode", `<span class="num">${rpShort(D.omzet)}</span>`, chg == null ? perRange(k) : `<span class="${chg >= 0 ? "down" : "up"}">${chg >= 0 ? "▲" : "▼"} ${pct(Math.abs(chg))}</span> vs ${nLap} hari pertama periode lalu`],
      ...G.slice(0, 2).map(g => ["Omzet " + g, `<span class="num">${rpShort(D.omGrup(g))}</span>`, esc(cabsOfGrup(g).map(shortCab).join(" + ")) + (D.omzet ? " · " + pct(D.omGrup(g) / D.omzet) : "")]),
      ["Pengeluaran cabang", `<span class="num">${rpShort(exTot)}</span>`, "s/d " + fmtDate(todayISO() < perEnd(k) ? todayISO() : perEnd(k)) + " · tanpa payroll"]
    ].map(([l,v,s]) => `<div class="kpi"><span class="l">${l}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join("");

    // omzet per hari (bulanan) atau per bulan (3/6/12 bulan), ditumpuk per grup
    const byMonth = isTok(k), t = todayISO();
    const BK = byMonth ? tokKeys(k).map(mk => ({ key: mk, label: mName(mk), sub: perRange(mk), m: iso => inPer(iso, mk), show: perStart(mk) <= t }))
      : D.days.map(d => ({ key: d, label: fmtDate(d), sub: HARI[new Date(d + "T00:00").getDay()], m: iso => iso === d, show: d <= t }));
    BK.forEach(b => { b.ms = D.ms.filter(s => b.m(s.tanggal)); if (b.ms.length) b.show = true; });
    const byB = BK.map(b => { const o = {}; G.forEach(g => o[g] = 0); b.ms.forEach(s => { const g = grupOf(s.cabang); o[g] = (o[g] || 0) + (s.total || 0); }); return o; });
    const maxV = Math.max(1, ...byB.map(o => Object.values(o).reduce((a, b) => a + b, 0)));
    const step = [1e6, 2e6, 5e6, 1e7, 2e7, 5e7, 1e8, 2e8, 5e8, 1e9].find(s => maxV / s <= 4) || 1e9, top = Math.ceil(maxV / step) * step, nD = BK.length;
    const W = 760, H = 230, L = 44, R = 8, T = 10, B = 26, pw = W - L - R, ph = H - T - B, bw = pw / nD, gap = byMonth ? Math.min(24, bw * 0.3) : 3;
    let svg = `<svg class="daily" viewBox="0 0 ${W} ${H}" role="img" aria-label="Omzet per grup cabang ${perName(k)}">`;
    for (let v = 0; v <= top; v += step) { const y = T + ph - v / top * ph; svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 6}" y="${y + 3}" text-anchor="end">${v ? (v / 1e6).toLocaleString("id-ID") + " jt" : "0"}</text>`; }
    byB.forEach((o, i) => { let y0 = T + ph; const x = L + i * bw + gap / 2, w = Math.max(2, bw - gap), tot = Object.values(o).reduce((a, b) => a + b, 0), b = BK[i];
      const tip = `${b.label}\n` + G.map(g => `${g}: ${rp(o[g] || 0)}`).join("\n") + `\nTotal: ${rp(tot)}`;
      let first = true;
      G.forEach(g => { const v = o[g] || 0; if (!v) return; const h = Math.max(1, v / top * ph); const y = y0 - h;
        svg += `<rect x="${x.toFixed(1)}" y="${(y + (first ? 0 : 1)).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0.5, h - (first ? 0 : 1)).toFixed(1)}" rx="${byMonth ? 4 : 2}" fill="${grupCol(g)}"><title>${esc(tip)}</title></rect>`; y0 = y; first = false; });
      if (tot) svg += `<rect x="${(L + i * bw).toFixed(1)}" y="${T}" width="${bw.toFixed(1)}" height="${ph}" fill="transparent"><title>${esc(tip)}</title></rect>`;
      if (byMonth) { svg += `<text x="${(L + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(b.label.slice(0, 3) + " " + b.key.slice(2, 4))}</text>`; if (tot && nD <= 6) svg += `<text x="${(L + i * bw + bw / 2).toFixed(1)}" y="${(y0 - 4).toFixed(1)}" text-anchor="middle">${esc(rpShort(tot).replace("Rp ", ""))}</text>`; }
      else { const dd = +b.key.slice(8); if (i === 0 || dd === 1 || (dd % 5 === 0 && dd <= 25)) svg += `<text x="${(L + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${dd === 1 || i === 0 ? dd + " " + BLN[+b.key.slice(5,7) - 1].slice(0,3) : dd}</text>`; } });
    svg += `</svg>`;
    $("dDailyTitle").textContent = byMonth ? "Omzet per bulan" : "Omzet harian";
    $("dDaily").innerHTML = D.ms.length ? svg : `<div class="empty">Belum ada omzet di ${perName(k)}. Upload laporan Zenwel atau input omzet manual di tab Omzet.</div>`;
    $("dLegend").innerHTML = D.ms.length && G.length > 1 ? G.map(g => `<span><i style="background:${grupCol(g)}"></i>${esc(g)} <span class="note">(${esc(cabsOfGrup(g).map(shortCab).join(", "))})</span></span>`).join("") : "";
    $("dDailyHint").textContent = perRange(k) + " · arahkan kursor ke batang";

    // tabel omzet per tanggal / per bulan
    $("dTglTitle").textContent = "Omzet " + perName(k);
    const shown = BK.filter(b => b.show);
    const cols = []; G.forEach(g => { const cs = cabsOfGrup(g); cs.forEach(c => cols.push({ type:"c", c, g })); if (G.length > 1 || cs.length > 1) cols.push({ type:"g", g }); });
    D.cabs.filter(c => !cabList().includes(c)).forEach(c => cols.push({ type:"c", c, g:null }));
    const cell = (b, col) => sumOf((b ? b.ms : D.ms).filter(s => col.type === "c" ? s.cabang === col.c : grupOf(s.cabang) === col.g), s => s.total);
    const bTot = b => sumOf(b.ms, s => s.total);
    if (S.db && !S.salesLoaded) $("dTgl").innerHTML = `<tr><td class="empty">Memuat…</td></tr>`;
    else if (!cols.length) $("dTgl").innerHTML = `<tr><td class="empty">Belum ada cabang.</td></tr>`;
    else {
      let h = `<thead><tr><th rowspan="2">${byMonth ? "Bulan" : "Tanggal"}</th>` + G.map(g => { const n = cols.filter(c => c.g === g).length; return n ? `<th class="c gh" colspan="${n}"><i style="background:${grupCol(g)}"></i>${esc(g)}</th>` : ""; }).join("") +
        (cols.some(c => c.g === null) ? `<th class="c gh" colspan="${cols.filter(c => c.g === null).length}">Lainnya</th>` : "") + `<th rowspan="2" class="r">Total</th></tr><tr>` +
        cols.map(c => `<th class="r ${c.type === "g" ? "sg" : ""}">${c.type === "g" ? "Subtotal" : esc(shortCab(c.c))}</th>`).join("") + `</tr></thead><tbody>`;
      const list = S.dDesc ? [...shown].reverse() : shown; let run = 0; const runs = {}; shown.forEach(b => { run += bTot(b); runs[b.key] = run; });
      list.forEach(b => { const dt = bTot(b);
        h += `<tr class="${dt ? "" : "nodata"}"><td class="num" style="white-space:nowrap">${esc(b.label)}<small class="note" style="display:block">${esc(b.sub)}</small></td>` +
          cols.map(c => { const v = cell(b, c); return `<td class="r num ${c.type === "g" ? "sg" : ""}">${v ? fmt(v) : "–"}</td>`; }).join("") +
          `<td class="r num"><b>${dt ? fmt(dt) : "–"}</b>${dt ? `<small class="note" style="display:block">kumulatif ${rpShort(runs[b.key])}</small>` : ""}</td></tr>`; });
      h += `<tr class="total"><td>Total ${byMonth ? esc(mName(k)) : "periode"}</td>${cols.map(c => `<td class="r num ${c.type === "g" ? "sg" : ""}">${fmtOrDash(cell(null, c))}</td>`).join("")}<td class="r num">${fmt(D.omzet)}</td></tr></tbody>`;
      $("dTgl").innerHTML = h;
    }
    $("dSort").textContent = S.dDesc ? "Terlama dulu" : "Terbaru dulu";

    // promo terlaris: item promo/paket + item yang kena diskon atau voucher
    const pr = {}; D.ms.forEach(s => (s.items || []).forEach(it => { const dis = Math.abs(it.disc || 0) + Math.abs(it.voucher || 0);
      if (!(dis > 0 || isPromoName(it.item))) return; const a = pr[it.item] ??= { qty:0, total:0, disc:0 }; a.qty += it.qty || 0; a.total += it.total || 0; a.disc += dis; }));
    const pl = Object.entries(pr).sort((a, b) => b[1].qty - a[1].qty || b[1].total - a[1].total).slice(0, 6), pmx = Math.max(1, ...pl.map(x => x[1].qty));
    $("dPromoHint").textContent = pl.length ? "diskon " + rpShort(sumOf(Object.values(pr), x => x.disc)) : "";
    $("dPromo").innerHTML = pl.length ? pl.map(([n, a]) => `<div class="top-row-i"><b>${esc(n)}</b><span class="num">${esc(fmtQty(Math.round(a.qty * 100) / 100))}× · ${rpShort(a.total)}</span><div class="bar"><i style="width:${(a.qty / pmx * 100).toFixed(1)}%"></i></div>${a.disc ? `<small class="note" style="grid-column:1/-1">diskon/voucher ${rp(a.disc)}</small>` : ""}</div>`).join("") +
      `<p class="note" style="margin:8px 0 0">Dihitung dari item Zenwel yang kena diskon/voucher atau bernama promo/paket.</p>`
      : `<div class="empty">Belum ada penjualan promo di ${perName(k)}.</div>`;

    // therapist
    const th = {}; D.ms.forEach(s => (s.staff || []).forEach(x => { const key = x.nama + "|" + s.cabang; const a = th[key] ??= { nama:x.nama, cabang:s.cabang, total:0, qty:0 }; a.total += x.total || 0; a.qty += x.qty || 0; }));
    const tl = Object.values(th).sort((a, b) => b.total - a.total).slice(0, 8), tmx = Math.max(1, ...tl.map(x => x.total));
    $("dTherHint").textContent = tl.length ? perRange(k) : "";
    $("dTher").innerHTML = tl.length ? tl.map((a, i) => `<div class="top-row-i"><b>${i + 1}. ${esc(a.nama)} <span class="note">${esc(shortCab(a.cabang))}</span></b><span class="num">${rpShort(a.total)}</span><div class="bar"><i style="width:${(a.total / tmx * 100).toFixed(1)}%"></i></div></div>`).join("")
      : `<div class="empty">Belum tersambung. Butuh file export Zenwel per staff/therapist. Setelah contoh file-nya ada, ranking therapist muncul di sini.</div>`;

    // pengeluaran cabang up to date
    $("dExpHint").textContent = "s/d " + fmtDate(t < perEnd(k) ? t : perEnd(k));
    const exCab = c => D.ex.filter(l => l.cabang === c), lastOf = c => exCab(c).reduce((m, l) => l.tanggal > m ? l.tanggal : m, "");
    const exRow = (label, cs, cls) => { const L = D.ex.filter(l => cs.includes(l.cabang)); const lt = cls ? "" : lastOf(cs[0]);
      return `<tr class="${cls || ""}"><td>${label}</td><td class="r num">${fmtOrDash(sumOf(L, l => l.jumlah))}</td><td class="r num">${L.length || "–"}</td><td class="num">${cls ? "" : lt ? esc(fmtDate(lt)) : `<span class="pill no" style="font-size:11px">belum ada</span>`}</td></tr>`; };
    let eh = `<thead><tr><th>Cabang</th><th class="r">Pengeluaran</th><th class="r">Catatan</th><th>Update terakhir</th></tr></thead><tbody>`;
    G.forEach(g => { const cs = cabsOfGrup(g); cs.forEach(c => eh += exRow(`<b>${esc(shortCab(c))}</b>`, [c])); if (G.length > 1 || cs.length > 1) eh += exRow("Subtotal " + esc(g), cs, "sub"); });
    eh += exRow("Total semua cabang", cabList(), "total") + `</tbody>`;
    $("dExp").innerHTML = cabList().length ? eh : `<tr><td class="empty">Belum ada cabang.</td></tr>`;

    // perlu perhatian
    const al = [], need = elapsedDays(k);
    cabList().forEach(c => { const n = new Set(D.ms.filter(s => s.cabang === c && s.sumber !== "Manual").map(s => s.tanggal)).size, miss = Math.max(0, need - n); if (miss) al.push(["warn", `Laporan Zenwel ${shortCab(c)} kurang ${miss} hari`, "omzet belum lengkap", "omzet"]); });
    cabList().forEach(c => { if (!S.rows.some(r => r.cabang === c && inPer(r.tanggal, k))) al.push(["no", `Petty cash ${shortCab(c)} belum ada di ${perName(k)}`, "belum setor", "rekap"]); });
    { const nb = bigList().filter(x => !x.cek).length; if (nb) al.unshift(["warn", `${nb} pengeluaran di atas ${rpShort(hrCfg().notifMin)} belum dicek`, "lihat Notifikasi di atas", "dash"]); }
    const A = agg(); const ns = A.cur.filter(r => r.tanpaStruk).length;
    if (A.flags.length) al.push(["warn", `${A.flags.length} transaksi petty cash perlu dicek`, ns ? `${ns} di antaranya tanpa struk` : "nominal besar / nota", "rekap"]);
    cabList().forEach(c => { const K = kartu(c, k); const sel = K.rows.filter(r => r.sel != null && r.sel !== 0).length;
      if (!K.closeDoc) al.push(["no", `Stock opname ${shortCab(c)} belum ada`, perName(k), "stok"]);
      else if (sel) al.push(["warn", `Selisih stok ${shortCab(c)}: ${sel} barang`, "opname beda dengan catatan", "stok"]); });
    $("dAlertHint").textContent = al.length ? al.length + " hal" : "";
    renderNotif(); if (!S.cmpSel || Object.keys(S.cmpData).length === 0) cmpLoad(); else renderCmp();
    $("dAlerts").innerHTML = al.length ? al.map(([ty, a, b, go]) => `<div class="alert"><span class="pill ${ty}">${ty === "no" ? "Penting" : "Cek"}</span><div style="flex:1;min-width:0"><b>${esc(a)}</b>${b ? `<div class="note">${esc(b)}</div>` : ""}</div><button class="btn ghost" type="button" data-goto="${go}">Buka</button></div>`).join("")
      : `<div class="empty">Semua aman periode ini.</div>`;

    // layanan terlaris
    const ag = {}; D.ms.forEach(s => (s.items || []).forEach(it => { const a = ag[it.item] ??= { qty:0, total:0 }; a.qty += it.qty || 0; a.total += it.total || 0; }));
    const topL = Object.entries(ag).sort((a, b) => b[1].total - a[1].total).slice(0, 6), mx = Math.max(1, ...topL.map(x => x[1].total));
    $("dTopHint").textContent = topL.length ? perRange(k) : "";
    $("dTop").innerHTML = topL.length ? topL.map(([n, a]) => `<div class="top-row-i"><b>${esc(n)}</b><span class="num">${rpShort(a.total)} · ${esc(fmtQty(Math.round(a.qty * 100) / 100))}×</span><div class="bar"><i style="width:${(a.total / mx * 100).toFixed(1)}%"></i></div></div>`).join("") : `<div class="empty">Belum ada data layanan.</div>`;
  }
  $("dSort").addEventListener("click", () => { S.dDesc = !S.dDesc; renderDash(); });
  $("dCsv").addEventListener("click", async () => {
    const D = dashData(); if (!D.ms.length) { toast("Belum ada omzet periode ini"); return; }
    const cs = []; D.G.forEach(g => cabsOfGrup(g).forEach(c => cs.push(c)));
    const q = v => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [["Tanggal", ...cs.map(c => shortCab(c) + " (" + grupOf(c) + ")"), ...D.G.map(g => "Subtotal " + g), "Total"].map(q).join(",")];
    const v = (d, f) => sumOf(D.ms.filter(s => s.tanggal === d && f(s)), s => s.total);
    D.days.forEach(d => { if (!D.ms.some(s => s.tanggal === d)) return; lines.push([d, ...cs.map(c => v(d, s => s.cabang === c)), ...D.G.map(g => v(d, s => grupOf(s.cabang) === g)), v(d, () => true)].map(q).join(",")); });
    lines.push(["TOTAL", ...cs.map(D.omCab), ...D.G.map(D.omGrup), D.omzet].map(q).join(","));
    try { await S.dl.save({ filename:`Omzet per tanggal ${perName(S.rk)}.csv`, data:"﻿" + lines.join("\n") }); toast("File disimpan"); }
    catch (err) { if (err?.code === "declined") return; toast("Download gagal, coba lagi"); }
  });
  document.addEventListener("click", e => { const b = e.target.closest("[data-goto]"); if (!b) return; if (b.dataset.goto.includes("/")) { go(b.dataset.goto); window.scrollTo({ top: 0 }); return; } const [t, sub] = b.dataset.goto.split(":"); if (sub) S.hrdSub = sub; showTab(t); if (sub) showHrd(sub); window.scrollTo({ top: 0 }); });
  $("dAiBtn").addEventListener("click", async () => {
    if (!S.sample) return; const D = dashData(), out = $("dAiOut"), btn = $("dAiBtn");
    if (!D.omzet && !D.ex.length) { out.hidden = false; out.textContent = "Belum ada data di periode ini untuk diringkas."; return; }
    const ag = {}; D.ms.forEach(s => (s.items || []).forEach(it => { const a = ag[it.item] ??= { qty:0, total:0, diskon:0 }; a.qty += it.qty || 0; a.total += it.total || 0; a.diskon += Math.abs(it.disc || 0) + Math.abs(it.voucher || 0); }));
    const stok = cabList().map(c => { const K = kartu(c, S.month); return { cabang:c, ada_opname:!!K.closeDoc, barang_selisih:K.rows.filter(r => r.sel != null && r.sel !== 0).map(r => ({ barang:r.it.nama, selisih:r.sel })) }; });
    const data = { periode:perName(S.rk) + " (" + perRange(S.rk) + ", tutup buku tgl 26)", hari_terakhir_ada_laporan:D.lastIdx >= 0 ? D.days[D.lastIdx] : null, hari_dalam_periode:D.days.length,
      omzet_total:D.omzet, omzet_hari_yang_sama_periode_lalu:D.prevSame || null,
      grup:D.G.map(g => ({ grup:g, omzet:D.omGrup(g), cabang:cabsOfGrup(g).map(c => ({ cabang:c, omzet:D.omCab(c), pengeluaran_cabang_sd_hari_ini:sumOf(D.ex.filter(l => l.cabang === c), l => l.jumlah) })) })),
      layanan_terlaris:Object.entries(ag).sort((a, b) => b[1].total - a[1].total).slice(0, 6).map(([n, a]) => ({ item:n, ...a })),
      promo_diskon:Object.entries(ag).filter(([n, a]) => a.diskon > 0 || isPromoName(n)).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5).map(([n, a]) => ({ item:n, ...a })), stok };
    S.dAiCtl?.abort(); S.dAiCtl = new AbortController();
    btn.disabled = true; btn.textContent = "Menulis…"; out.hidden = false; out.textContent = "Membaca angka…"; $("dAiCopy").hidden = true;
    try {
      await S.sample("Kamu membantu owner usaha salon lash & nail multi-cabang di Indonesia. Cabang dibagi per grup (misalnya Internal dan Wendy). Berikut data periode ini dalam JSON (angka rupiah).\n\n" + JSON.stringify(data) +
        "\n\nTulis ringkasan untuk owner dalam bahasa Indonesia yang santai tapi profesional, siap dikirim lewat WhatsApp. Format: satu kalimat pembuka (omzet total periode dan perbandingan dengan periode lalu kalau ada), lalu 5–7 poin diawali \"- \": omzet per grup dan cabang terkuat/terlemah, layanan dan promo terlaris, pengeluaran cabang sejauh ini, laporan atau stock opname yang belum lengkap, selisih stok, dan 1–2 saran tindakan konkret. Jangan bahas margin atau payroll. Angka ditulis 'Rp 12,5 jt' atau 'Rp 850.000'. Kalau periode belum selesai, sebutkan angka masih berjalan. Jangan pakai markdown tebal atau judul. Jangan mengarang angka di luar data.",
        { signal:S.dAiCtl.signal, cache:false, onText:({ text }) => { out.textContent = text; } });
      $("dAiCopy").hidden = false;
    } catch (err) {
      if (["not_granted","sampling_disabled","not_declared","capability_disabled","capability_removed"].includes(err?.code)) { out.textContent = "Ringkasan AI tidak tersedia di tampilan ini."; btn.hidden = true; }
      else if (err?.code === "rate_limited") out.textContent = (err.text ? err.text + "\n\n" : "") + "Batas pemakaian tercapai. Coba lagi nanti.";
      else if (err?.code === "refused") out.textContent = "Ringkasan tidak bisa dibuat untuk data ini.";
      else if (err?.code !== "cancelled") out.textContent = (err?.text ? err.text + "\n\n(terputus) " : "") + "Gagal membuat ringkasan. Coba lagi.";
    } finally { btn.disabled = false; btn.textContent = "Buat ulang"; }
  });
  $("dAiCopy").addEventListener("click", async () => { const el = $("dAiOut");
    try { await navigator.clipboard.writeText(el.textContent); toast("Ringkasan disalin"); }
    catch { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Teks sudah dipilih, tinggal copy"); } });

  /* ---------- pengaturan HR & notifikasi ---------- */
  S.hr = null; S.ky = null; S.kyLoaded = false; S.closing = {}; S.aset = []; S.asetLoaded = false;
  S.abs = []; S.absLoaded = false; S.absToday = []; S.unsubAbs = null; S.unsubAbsT = null;
  const hrCfg = () => ({ ownerWa: S.hr?.ownerWa || "", notifMin: S.hr?.notifMin > 0 ? S.hr.notifMin : 500000, jamMasuk: S.hr?.jamMasuk || "10:00", toleransi: S.hr?.toleransi >= 0 ? S.hr.toleransi : 15, bhGrup: S.hr?.bhGrup ?? "Wendy", bhPct: S.hr?.bhPct > 0 ? S.hr.bhPct : 50 });
  const waNum = s => { let d = String(s || "").replace(/[^\d]/g, ""); if (d.startsWith("0")) d = "62" + d.slice(1); else if (d.startsWith("8")) d = "62" + d; return d.length >= 10 ? d : ""; };
  const waLink = (num, text) => "https://wa.me/" + num + "?text=" + encodeURIComponent(text);
  function notifText(d){
    return [`🔔 *Pengeluaran di atas ${rp(hrCfg().notifMin)}*`, `${d.unit || d.cabang} · ${fmtDate(d.tanggal)}`, d.kategori ? `Kategori: ${d.kategori}` : "Petty cash",
      `Keterangan: ${d.keterangan}`, `Jumlah: *${rp(d.jumlah)}*`, d.nota ? `No. nota: ${d.nota}` : (d.tanggal && d.tanpaStruk ? "Tanpa struk" : ""), d.pengisi ? `Diisi oleh: ${d.pengisi}` : "",
      ``, `Cek: ${ARTIFACT_URL}#rekap`].filter(x => x !== "").join("\n");
  }
  // tampilkan tombol WA ke owner setelah simpan pengeluaran besar
  function setWa(a, d, coll, id){
    const c = hrCfg(), num = waNum(c.ownerWa);
    if (!a) return;
    if (!(d.jumlah >= c.notifMin) || !num) { a.hidden = true; return; }
    a.href = waLink(num, notifText(d)); a.hidden = false; a.textContent = "Kirim ke Owner (WA)";
    a.onclick = () => { a.textContent = "Terkirim ke WA ✓"; if (S.db && id) S.db.doc(coll + "/" + id).update({ notifWa: true, notifAt: new Date().toISOString() }).catch(() => {}); };
  }
  function renderHrCfg(){
    const c = hrCfg(), ro = !S.admin;
    ["hrWa","hrMin","hrJam","hrTol","hrBhG","hrBhP","hrPartner","hrWlPct","hrWlKata","hrOwners","hrPrep","hrAppr","hrKota","hrSave"].forEach(id => $(id).disabled = ro || !S.db);
    if (S.hrDirty) return;
    $("hrWa").value = c.ownerWa; $("hrMin").value = fmt(c.notifMin); $("hrJam").value = c.jamMasuk; $("hrTol").value = String(c.toleransi); $("hrBhG").innerHTML = `<option value="">Tidak ada bagi hasil</option>` + optList(grups(), c.bhGrup); $("hrBhP").value = String(c.bhPct);
    { const R2 = rptCfg(); $("hrPartner").value = R2.partnerNama; $("hrWlPct").value = String(R2.wlPct); $("hrWlKata").value = R2.wlKata; $("hrOwners").value = ownersCfg().join(", "); $("hrPrep").value = R2.prepBy; $("hrAppr").value = R2.apprBy; $("hrKota").value = R2.kota; }
  }
  ["hrWa","hrJam","hrTol","hrBhP","hrPartner","hrWlPct","hrWlKata","hrOwners","hrPrep","hrAppr","hrKota"].forEach(id => $(id).addEventListener("input", () => { S.hrDirty = true; })); $("hrBhG").addEventListener("change", () => { S.hrDirty = true; });
  $("hrMin").addEventListener("input", e => { S.hrDirty = true; const n = parseRp(e.target.value); e.target.value = n ? fmt(n) : ""; });
  $("hrSave").addEventListener("click", async () => {
    const wa = $("hrWa").value.trim(); if (wa && !waNum(wa)) { $("hrMsg").textContent = "Nomor WA belum benar. Contoh: 0812xxxxxxx"; return; }
    const doc = { ownerWa: wa, notifMin: parseRp($("hrMin").value) || 500000, jamMasuk: $("hrJam").value || "10:00", toleransi: Math.max(0, parseInt($("hrTol").value, 10) || 0), bhGrup: $("hrBhG").value, bhPct: Math.min(99, Math.max(1, parseInt($("hrBhP").value, 10) || 50)),
      partnerNama: $("hrPartner").value.trim() || "Wendy Walters", wlPct: Math.min(99, Math.max(1, parseInt($("hrWlPct").value, 10) || 30)), wlKata: $("hrWlKata").value.trim() || "walters",
      owners: $("hrOwners").value.split(",").map(x => x.trim()).filter(Boolean).slice(0, 4), prepBy: $("hrPrep").value.trim() || "Yulianti", apprBy: $("hrAppr").value.trim() || "Kevin", kota: $("hrKota").value.trim() || "Tangerang" };
    $("hrMsg").textContent = "Menyimpan…";
    try { await S.db.doc("settings/hr").set(doc); S.hrDirty = false; $("hrMsg").textContent = ""; toast("Pengaturan notifikasi & absensi tersimpan"); }
    catch (err) { $("hrMsg").textContent = err?.code === "invalid_argument" ? "Hanya admin yang bisa menyimpan pengaturan." : "Gagal menyimpan, coba lagi."; }
  });

  /* ---------- tutup buku: kunci periode ---------- */
  const isClosed = k => S.closing[k]?.status === "closed";
  const lockOf = iso => iso && isClosed(perOf(iso)) ? `Periode ${mName(perOf(iso))} sudah tutup buku. Minta admin buka kembali kalau perlu koreksi.` : "";
  // cegah hapus data di periode yang sudah ditutup (capture, jalan sebelum handler hapus)
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-del],[data-delps],[data-delsale],[data-delop],[data-delas]"); if (!b) return;
    const id = b.dataset.del || b.dataset.delps || b.dataset.delsale || b.dataset.delop;
    const all = [...S.rows, ...S.ps, ...S.sales, ...S.opn]; const d = all.find(x => x.id === id);
    const lk = d ? lockOf(d.tanggal) : ""; if (lk) { e.stopImmediatePropagation(); e.preventDefault(); toast(lk); }
  }, true);
  function renderPerPill(){
    const p = $("perPill"), ks = tokKeys(S.rk), n = ks.filter(isClosed).length;
    if (!n) { p.hidden = true; return; }
    p.hidden = false; p.textContent = ks.length === 1 ? "Sudah tutup buku" : `${n}/${ks.length} bulan tutup buku`;
  }

  /* ---------- data karyawan ---------- */
  const kyList = () => (S.ky?.list || []).filter(x => x && x.id && x.nama);
  const kyActive = c => kyList().filter(x => x.aktif !== false && (!c || x.cabang === c));
  const kyOf = id => kyList().find(x => x.id === id) || null;
  let kyEdit = null;
  function renderKaryawan(){
    if (!kyEdit || !S.kyDirty) kyEdit = kyList().map(x => ({ ...x, aktif: x.aktif !== false }));
    const opts = [...cabList(), "Pusat"];
    $("kyHint").textContent = kyEdit.length ? kyEdit.filter(x => x.aktif).length + " aktif · " + kyEdit.length + " total" : "";
    $("kyTable").innerHTML = kyEdit.length ? `<thead><tr><th>No</th><th>Nama</th><th>Jabatan</th><th>Penempatan</th><th class="c">Aktif</th><th>Kontak & bank</th><th></th></tr></thead><tbody>` +
      kyEdit.map((x, i) => `<tr class="${x.aktif ? "" : "nodata"}"><td class="num">${i + 1}</td>
        <td><input type="text" class="t" data-ky="${i}" data-f="nama" value="${esc(x.nama)}" placeholder="Nama lengkap" aria-label="Nama"></td>
        <td><input type="text" class="t s" data-ky="${i}" data-f="jabatan" value="${esc(x.jabatan || "")}" placeholder="Jabatan" aria-label="Jabatan"></td>
        <td><select data-ky="${i}" data-f="cabang" aria-label="Penempatan">${optList((opts.includes(x.cabang) ? opts : [x.cabang, ...opts]).filter(Boolean), x.cabang)}</select></td>
        <td class="c"><input type="checkbox" data-ky="${i}" data-f="aktif" ${x.aktif ? "checked" : ""} aria-label="Aktif"></td>
        <td><button class="btn ghost" type="button" data-kydet="${i}">${x.hp || x.email || x.norek ? "Lihat / ubah" : "Lengkapi"}</button>${x.hp ? `<small class="note" style="display:block">${esc(x.hp)}</small>` : ""}</td>
        <td>${x.isNew ? `<button class="btn ghost danger" type="button" data-kydel="${i}" aria-label="Hapus baris">✕</button>` : ""}</td></tr>`).join("") + `</tbody>`
      : `<tr><td class="empty">Belum ada data karyawan. Klik "Ambil dari payroll" atau tambah manual.</td></tr>`;
  }
  $("kyTable").addEventListener("input", e => { const t = e.target; if (t.dataset.ky === undefined) return; S.kyDirty = true; const x = kyEdit[+t.dataset.ky]; x[t.dataset.f] = t.type === "checkbox" ? t.checked : t.value; if (t.type === "checkbox") renderKaryawan(); });
  $("kyTable").addEventListener("change", e => { const t = e.target; if (t.tagName !== "SELECT" || t.dataset.ky === undefined) return; S.kyDirty = true; kyEdit[+t.dataset.ky].cabang = t.value; });
  $("kyTable").addEventListener("click", e => { const b = e.target.closest("[data-kydel]"); if (!b) return; kyEdit.splice(+b.dataset.kydel, 1); renderKaryawan(); });
  $("kyAdd").addEventListener("click", () => { S.kyDirty = true; kyEdit.push({ id: newId(), nama: "", jabatan: "", cabang: cabList()[0] || "Pusat", aktif: true, isNew: true }); renderKaryawan(); const ins = $("kyTable").querySelectorAll('input[data-f="nama"]'); ins[ins.length - 1]?.focus(); });
  $("kyFromPr").addEventListener("click", () => { const have = new Set(kyEdit.map(x => x.id)); let n = 0;
    (S.prDoc?.rows || []).forEach(r => { if (r.id && r.nama && !have.has(r.id)) { kyEdit.push({ id: r.id, nama: r.nama, jabatan: r.jabatan || "", cabang: r.cabang || "Pusat", aktif: true, isNew: true }); n++; } });
    S.kyDirty = n > 0 || S.kyDirty; renderKaryawan(); $("kyMsg").textContent = n ? n + " karyawan diambil dari payroll " + perName(S.month) + ". Klik Simpan." : "Semua karyawan di payroll sudah ada."; });
  $("kySave").addEventListener("click", async () => {
    const list = kyEdit.map(x => ({ ...Object.fromEntries(KY_FIELDS.map(([f]) => [f, String(x[f] || "").trim()]).filter(([, v]) => v)), id: x.id, nama: String(x.nama || "").trim(), jabatan: String(x.jabatan || "").trim(), cabang: x.cabang || "Pusat", aktif: x.aktif !== false })).filter(x => x.nama);
    const names = list.map(x => x.nama.toLowerCase()); if (new Set(names).size !== names.length) { $("kyMsg").textContent = "Ada nama karyawan yang sama. Bedakan dulu (misalnya tambah inisial)."; return; }
    $("kyMsg").textContent = "Menyimpan…";
    try { await S.db.doc("settings/karyawan").set({ list }); S.kyDirty = false; kyEdit = null; $("kyMsg").textContent = ""; toast("Data karyawan tersimpan"); }
    catch (err) { $("kyMsg").textContent = err?.code === "invalid_argument" ? "Hanya admin yang bisa menyimpan data karyawan." : "Gagal menyimpan, coba lagi."; }
  });

  /* ---------- absensi ---------- */
  const AB_ST = { H:"Hadir", T:"Telat", I:"Izin", S:"Sakit", C:"Cuti", A:"Alpha", L:"Libur" };
  const absId = (tgl, id) => tgl + "_" + id;
  const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  const hmMin = s => { const m = /^(\d{1,2}):(\d{2})/.exec(s || ""); return m ? +m[1] * 60 + +m[2] : null; };
  const codeOf = d => { if (!d) return ""; const st = d.status || "H"; if (st !== "H") return st; const c = hrCfg(), mm = hmMin(d.masuk), lim = hmMin(c.jamMasuk); return mm != null && lim != null && mm > lim + c.toleransi ? "T" : "H"; };
  function subscribeHr(){
    if (!S.db) return;
    S.unsubAbs?.(); S.unsubAbsT?.(); S.absLoaded = false;
    if (S.admin) S.unsubAbs = S.db.collection("absen").where("periode", "==", S.month).limit(1000).onSnapshot(sn => { S.abs = sn.docs.map(d => ({ id:d.id, ...d.data() })); S.absLoaded = true; renderAll(); }, () => { S.absLoaded = true; renderAll(); });
    S.unsubAbsT = S.db.collection("absen").where("tanggal", "==", todayISO()).limit(500).onSnapshot(sn => { S.absToday = sn.docs.map(d => ({ id:d.id, ...d.data() })); S.absTLoaded = true; renderAbsen(); }, () => { S.absTLoaded = true; renderAbsen(); });
  }
  // halaman check-in (link cabang)
  S.abPick = null;
  function renderAbsen(){
    if (S.tab !== "absen") return;
    const c = S.staff, t = todayISO();
    $("abToday").textContent = fmtDay(t); $("abClock").textContent = nowHM();
    if (!S.db && S.booted) { $("abList").innerHTML = `<div class="empty">Server belum tersambung. Cek koneksi lalu muat ulang halaman.</div>`; return; }
    if (!c) { $("abList").innerHTML = `<div class="empty">${S.cfgLoaded ? "Link cabang tidak dikenal." : "Memuat…"}</div>`; return; }
    if (!S.kyLoaded || !S.absTLoaded) return;
    const emps = kyActive(c);
    if (!emps.length) { $("abList").innerHTML = `<div class="empty">Belum ada data karyawan untuk ${esc(shortCab(c))}. Admin perlu mengisi Data karyawan di HRD.</div>`; return; }
    const lk = lockOf(t);
    $("abList").innerHTML = emps.map(x => { const d = S.absToday.find(a => a.empId === x.id), code = codeOf(d), st = d?.status || "";
      let act;
      if (lk) act = `<span class="note">terkunci</span>`;
      else if (st && st !== "H") act = `<span class="pill ab-${st}">${AB_ST[st]}</span>`;
      else if (!d?.masuk) act = `<button class="btn primary" type="button" data-ab="${esc(x.id)}" data-act="masuk">Masuk</button>`;
      else if (!d?.pulang) act = `<button class="btn" type="button" data-ab="${esc(x.id)}" data-act="pulang">Pulang</button>`;
      else act = `<span class="pill ok">Selesai</span>`;
      const info = d?.masuk ? `Masuk ${esc(d.masuk)}${code === "T" ? " · telat" : ""}${d.pulang ? " · Pulang " + esc(d.pulang) : ""}` : (st && st !== "H" ? esc(d.ket || AB_ST[st]) : "Belum absen");
      return `<div class="ab-row"><div><b>${esc(x.nama)}</b><small>${esc(x.jabatan || "")}${x.jabatan ? " · " : ""}${info}</small></div>${act}</div>`; }).join("");
  }
  setInterval(() => { if (S.tab === "absen") $("abClock").textContent = nowHM(); }, 15000);
  $("abList").addEventListener("click", e => { const b = e.target.closest("[data-ab]"); if (!b) return; const x = kyOf(b.dataset.ab); if (!x) return;
    S.abPick = { emp: x, act: b.dataset.act }; $("abSheetTitle").textContent = x.nama + " · " + (b.dataset.act === "masuk" ? "Masuk" : "Pulang");
    $("abSheetSub").textContent = "Jam " + nowHM() + " · " + fmtDay(todayISO()); $("abSheet").hidden = false; $("abYes").focus(); });
  $("abNo").addEventListener("click", () => { $("abSheet").hidden = true; S.abPick = null; });
  $("abYes").addEventListener("click", async () => {
    const P = S.abPick; if (!P || !S.db) return; const t = todayISO(), hm = nowHM(), ref = S.db.doc("absen/" + absId(t, P.emp.id));
    const lk = lockOf(t); if (lk) { toast(lk); return; }
    $("abYes").disabled = true;
    try {
      const ex = S.absToday.find(a => a.empId === P.emp.id);
      if (P.act === "masuk") {
        if (ex) await ref.update({ masuk: hm, masukAt: new Date().toISOString(), status: "H" });
        else await ref.set({ tanggal: t, periode: perOf(t), bulan: t.slice(0, 7), empId: P.emp.id, nama: P.emp.nama, cabang: S.staff, status: "H", masuk: hm, masukAt: new Date().toISOString(), pulang: "", by: S.uid || null, at: new Date().toISOString(), contoh: false });
      } else await ref.update({ pulang: hm, pulangAt: new Date().toISOString() });
      $("abSheet").hidden = true; S.abPick = null;
      $("abOkTitle").textContent = P.emp.nama + " · " + (P.act === "masuk" ? "Masuk " : "Pulang ") + hm; $("abOkSub").textContent = "Tercatat. Selamat " + (P.act === "masuk" ? "bekerja!" : "istirahat!");
      $("abOk").hidden = false; clearTimeout(S.abT); S.abT = setTimeout(() => { $("abOk").hidden = true; }, 6000);
    } catch (err) { toast(err?.code === "invalid_argument" ? "Check-in ditolak server. Pastikan nama terdaftar di Data Karyawan, lalu coba lagi." : "Gagal mencatat, coba lagi."); }
    finally { $("abYes").disabled = false; }
  });
  // rekap & koreksi (admin)
  S.abSel = null;
  function absCounts(empId, list = S.abs){ const o = { H:0, T:0, I:0, S:0, C:0, A:0, L:0, kosong:0, noPulang:0 };
    list.filter(a => a.empId === empId).forEach(a => { const c = codeOf(a); if (o[c] != null) o[c]++; if ((c === "H" || c === "T") && a.masuk && !a.pulang && a.tanggal < todayISO()) o.noPulang++; }); return o; }
  function renderAbsAdmin(){
    const cabs = [...cabList(), "Pusat"]; fillSelect($("abCabang"), cabs, $("abCabang").value || cabs[0]);
    const c = $("abCabang").value, days = perDays(S.month), t = todayISO();
    $("abTitle").textContent = shortCab(c) + " · " + perName(S.month);
    const emps = kyList().filter(x => x.cabang === c && (x.aktif !== false || S.abs.some(a => a.empId === x.id)));
    S.abs.filter(a => a.cabang === c && !emps.some(x => x.id === a.empId)).forEach(a => { if (!emps.some(x => x.id === a.empId)) emps.push({ id: a.empId, nama: a.nama, jabatan: "" }); });
    const past = days.filter(d => d <= t);
    const all = emps.map(x => ({ x, n: absCounts(x.id) }));
    const tot = k => sumOf(all, a => a.n[k]);
    const kosong = sumOf(emps, x => past.filter(d => !S.abs.some(a => a.empId === x.id && a.tanggal === d)).length);
    $("abKpis").innerHTML = [
      ["Hadir", `<span class="num">${tot("H") + tot("T")}</span>`, emps.length + " karyawan · " + past.length + " hari berjalan"],
      ["Telat", `<span class="num ${tot("T") ? "up" : ""}">${tot("T")}</span>`, "lewat jam " + hrCfg().jamMasuk + " + " + hrCfg().toleransi + " mnt"],
      ["Izin · sakit · cuti", `<span class="num">${tot("I")} · ${tot("S")} · ${tot("C")}</span>`, "alpha " + tot("A")],
      ["Belum ada data", `<span class="num ${kosong ? "up" : ""}">${kosong}</span>`, tot("noPulang") ? tot("noPulang") + " lupa absen pulang" : "hari × karyawan"]
    ].map(([l,v,s]) => `<div class="kpi"><span class="l">${l}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join("");
    if (S.db && !S.absLoaded) { $("abTable").innerHTML = `<tr><td class="empty">Memuat…</td></tr>`; return; }
    if (!emps.length) { $("abTable").innerHTML = `<tr><td class="empty">Belum ada karyawan di ${esc(shortCab(c))}. Isi dulu di Data karyawan.</td></tr>`; }
    else {
      const HR = ["M","S","S","R","K","J","S"];
      let h = `<thead><tr><th class="ab-n">Karyawan</th>${days.map(d => { const dt = new Date(d + "T00:00"); return `<th class="c ${dt.getDay() === 0 ? "sun" : ""}">${+d.slice(8)}<small>${HR[dt.getDay()]}</small></th>`; }).join("")}<th class="r">H</th><th class="r">T</th><th class="r">I</th><th class="r">S</th><th class="r">C</th><th class="r">A</th></tr></thead><tbody>`;
      all.forEach(({ x, n }) => {
        h += `<tr><td class="ab-n"><b>${esc(x.nama)}</b>${x.jabatan ? `<small>${esc(x.jabatan)}</small>` : ""}</td>` + days.map(d => { const a = S.abs.find(z => z.empId === x.id && z.tanggal === d), code = codeOf(a);
          const sel = S.abSel && S.abSel.id === x.id && S.abSel.d === d;
          const tip = a ? `${AB_ST[code]}${a.masuk ? " · masuk " + a.masuk : ""}${a.pulang ? " · pulang " + a.pulang : ""}${a.koreksi ? " · dikoreksi " + (a.koreksiBy || "pusat") : ""}${a.ket ? " · " + a.ket : ""}` : (d <= t ? "Belum ada data" : "");
          return `<td class="c"><button type="button" class="abc ${code ? "ab-" + code : d <= t ? "ab-0" : "ab-f"} ${a?.koreksi ? "kor" : ""} ${sel ? "sel" : ""}" data-abc="${esc(x.id)}|${d}" title="${esc(fmtDate(d) + " · " + tip)}" aria-label="${esc(x.nama + " " + fmtDate(d) + " " + tip)}">${code || (d <= t ? "·" : "")}</button></td>`; }).join("") +
          ["H","T","I","S","C","A"].map(k => `<td class="r num">${n[k] || "–"}</td>`).join("") + `</tr>`; });
      $("abTable").innerHTML = h + `</tbody>`;
    }
    $("abLinks").innerHTML = cabList().map((cb, i) => `<div class="links-row"><b>${esc(cb)}</b><code id="abl${i}">${esc(ARTIFACT_URL + "#absen-" + slug(cb))}</code><button class="btn" type="button" data-abl="${i}">Salin</button>${qrBtn(ARTIFACT_URL + "#absen-" + slug(cb), "Check-in absensi " + shortCab(cb))}</div>`).join("") || `<p class="note">Tambahkan cabang dulu.</p>`;
  }
  $("abCabang").addEventListener("change", () => { S.abSel = null; $("abEdit").hidden = true; renderAbsAdmin(); });
  $("abLinks").addEventListener("click", async e => { const b = e.target.closest("[data-abl]"); if (!b) return; const el = $("abl" + b.dataset.abl);
    try { await navigator.clipboard.writeText(el.textContent); b.textContent = "Tersalin"; setTimeout(() => b.textContent = "Salin", 1800); } catch { toast("Salin manual: " + el.textContent); } });
  $("abTable").addEventListener("click", e => { const b = e.target.closest("[data-abc]"); if (!b) return; const [id, d] = b.dataset.abc.split("|");
    const x = kyOf(id) || { id, nama: S.abs.find(a => a.empId === id)?.nama || "Karyawan" }; const a = S.abs.find(z => z.empId === id && z.tanggal === d);
    S.abSel = { id, d, nama: x.nama, cabang: $("abCabang").value };
    $("abEditTitle").textContent = "Koreksi · " + x.nama + " · " + fmtDay(d);
    $("abStatus").value = a?.status || "H"; $("abMasuk").value = a?.masuk || ""; $("abPulang").value = a?.pulang || ""; $("abKet").value = a?.ket || "";
    $("abEditInfo").textContent = a ? (a.masukAt ? "Check-in dari HP cabang: masuk " + (a.masuk || "–") + (a.pulang ? ", pulang " + a.pulang : "") + "." : "") + (a.koreksi ? " Terakhir dikoreksi oleh " + (a.koreksiBy || "pusat") + "." : "") : "Belum ada data untuk hari ini.";
    $("abDel").hidden = !a; $("abMsg").textContent = lockOf(d); $("abEdit").hidden = false; renderAbsAdmin();
    $("abEdit").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" }); });
  $("abClose").addEventListener("click", () => { S.abSel = null; $("abEdit").hidden = true; renderAbsAdmin(); });
  $("abSave").addEventListener("click", async () => {
    const A = S.abSel; if (!A || !S.db) return; const lk = lockOf(A.d); if (lk) { $("abMsg").textContent = lk; return; }
    const by = $("abBy").value.trim(); if (!by) { $("abMsg").textContent = "Isi nama yang mengoreksi."; $("abBy").focus(); return; }
    const st = $("abStatus").value, ex = S.abs.find(z => z.empId === A.id && z.tanggal === A.d);
    const doc = { ...(ex || {}), tanggal: A.d, periode: perOf(A.d), bulan: A.d.slice(0, 7), empId: A.id, nama: A.nama, cabang: ex?.cabang || A.cabang, status: st,
      masuk: st === "H" ? $("abMasuk").value : "", pulang: st === "H" ? $("abPulang").value : "", ket: $("abKet").value.trim(), koreksi: true, koreksiBy: by, koreksiAt: new Date().toISOString(), contoh: ex?.contoh || false };
    delete doc.id; if (!doc.at) doc.at = new Date().toISOString();
    if (st === "H" && !doc.masuk) { $("abMsg").textContent = "Status hadir perlu jam masuk."; return; }
    $("abMsg").textContent = "Menyimpan…";
    try { await S.db.doc("absen/" + absId(A.d, A.id)).set(doc); $("abMsg").textContent = ""; toast("Absensi " + A.nama + " " + fmtDate(A.d) + " dikoreksi"); }
    catch { $("abMsg").textContent = "Gagal menyimpan, coba lagi."; }
  });
  $("abDel").addEventListener("click", async e => { const A = S.abSel, b = e.currentTarget; if (!A) return; const lk = lockOf(A.d); if (lk) { $("abMsg").textContent = lk; return; }
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Yakin hapus?"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Hapus data hari ini"; }, 3000); return; }
    b.dataset.armed = ""; b.textContent = "Hapus data hari ini";
    try { await S.db.doc("absen/" + absId(A.d, A.id)).delete(); $("abEdit").hidden = true; S.abSel = null; toast("Data absensi dihapus"); } catch { $("abMsg").textContent = "Gagal menghapus."; } });
  $("abCsv").addEventListener("click", async () => {
    const days = perDays(S.month), list = [...S.abs].sort((a, b) => (a.cabang || "").localeCompare(b.cabang || "") || (a.nama || "").localeCompare(b.nama || "") || a.tanggal.localeCompare(b.tanggal));
    if (!list.length) { toast("Belum ada data absensi periode ini"); return; }
    const q = v => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [["Tanggal","Cabang","Nama","Status","Masuk","Pulang","Keterangan","Dikoreksi oleh"].map(q).join(",")];
    list.forEach(a => lines.push([a.tanggal, a.cabang, a.nama, AB_ST[codeOf(a)], a.masuk || "", a.pulang || "", a.ket || "", a.koreksi ? a.koreksiBy || "pusat" : ""].map(q).join(",")));
    try { await S.dl.save({ filename: `Absensi ${perName(S.month)}.csv`, data: "﻿" + lines.join("\n") }); toast("File disimpan"); } catch (err) { if (err?.code !== "declined") toast("Download gagal"); }
  });
  // payroll: isi absensi & ambil dari data karyawan
  $("prAbs").addEventListener("click", () => { const W = prWork(); let n = 0;
    W.rows.forEach(r => { if (!r.id) return; const c = absCounts(r.id); if (!S.abs.some(a => a.empId === r.id)) return;
      r.hadir = c.H + c.T; r.izin = c.I + c.C; r.sakit = c.S; r.alpha = c.A; n++; });
    S.prDirty = n > 0 || S.prDirty; prSig = ""; renderPayroll(); $("prMsg").textContent = n ? `Absensi terisi untuk ${n} karyawan (cuti dihitung izin). HK tidak diubah. Jangan lupa simpan.` : "Belum ada data absensi periode ini."; });
  $("prFromKy").addEventListener("click", () => { const W = prWork(), have = new Set(W.rows.map(r => r.id)); let n = 0;
    kyActive().forEach(x => { if (have.has(x.id)) return; W.rows.push({ id: x.id, nama: x.nama, jabatan: x.jabatan || "", cabang: x.cabang || "Pusat", hk: 26, hadir: 0, izin: 0, sakit: 0, alpha: 0, pokok: 0, tunjangan: 0, bonus: 0, komisi: 0, potLain: 0, ketPot: "", wa: "" }); n++; });
    S.prDirty = n > 0 || S.prDirty; prSig = ""; renderPayroll(); $("prMsg").textContent = n ? n + " karyawan ditambahkan dari Data karyawan. Isi gajinya lalu simpan." : "Semua karyawan aktif sudah ada di lembar payroll."; });

  /* ---------- HRD: sub menu & cek slip ---------- */
  S.hrdSub = ["karyawan","absensi","payroll","kpi","slip"].includes(ls.get("rpc-hrd")) ? ls.get("rpc-hrd") : "payroll";
  function showHrd(sub){ go("hrd/" + sub); }
  function renderHrd(){
    if (S.tab !== "hrd") return;
    if (!S.admin && S.leaf === "hrd/kpi" && canKpi()) { $("hrdRO").hidden = true; $("hrdBody").hidden = true; return; }
    if (!adminGate("hrdBody", "hrdRO")) return;
    if (S.hrdSub === "karyawan") renderKaryawan();
    if (S.hrdSub === "absensi") renderAbsAdmin();
    if (S.hrdSub === "slip") renderCekSlip();
  }
  S.prHist = null; S.csKpi = {};
  async function loadSlipHist(force){
    if (!S.db || !S.admin || (S.prHist && !force)) { renderCekSlip(); return; }
    $("csMsg").textContent = "Memuat riwayat payroll…";
    try { const sn = await S.db.collection("payroll").limit(120).get(); S.prHist = {}; sn.docs.forEach(d => S.prHist[d.id] = d.data()); $("csMsg").textContent = ""; }
    catch { $("csMsg").textContent = "Riwayat payroll tidak bisa dimuat."; S.prHist = {}; }
    renderCekSlip();
  }
  function csEmps(){ const m = new Map(); kyList().forEach(x => m.set(x.id, { id: x.id, nama: x.nama, cabang: x.cabang, aktif: x.aktif !== false }));
    Object.values(S.prHist || {}).forEach(P => (P.rows || []).forEach(r => { if (r.id && !m.has(r.id)) m.set(r.id, { id: r.id, nama: r.nama, cabang: r.cabang, aktif: false }); }));
    return [...m.values()].sort((a, b) => (a.nama || "").localeCompare(b.nama || "")); }
  function renderCekSlip(){
    const q = $("csQ").value.trim().toLowerCase(), emps = csEmps().filter(x => !q || (x.nama || "").toLowerCase().includes(q));
    const keep = $("csEmp").value; $("csEmp").innerHTML = emps.length ? emps.map(x => `<option value="${esc(x.id)}">${esc(x.nama)} · ${esc(shortCab(x.cabang || ""))}${x.aktif ? "" : " (nonaktif)"}</option>`).join("") : `<option value="">Tidak ada karyawan</option>`;
    if (emps.some(x => x.id === keep)) $("csEmp").value = keep;
    const id = $("csEmp").value; $("csHint").textContent = S.prHist ? Object.keys(S.prHist).length + " periode payroll" : "";
    if (!S.prHist) { $("csTable").innerHTML = `<tr><td class="empty">Memuat…</td></tr>`; return; }
    if (!id) { $("csTable").innerHTML = `<tr><td class="empty">Pilih karyawan.</td></tr>`; return; }
    const hist = Object.entries(S.prHist).map(([k, P]) => ({ k, P, r: (P.rows || []).find(r => r.id === id) })).filter(x => x.r).sort((a, b) => b.k.localeCompare(a.k));
    if (!S.csKpi[id]) { S.csKpi[id] = "loading"; S.db.collection("kpi").where("empId", "==", id).limit(120).get().then(sn => { S.csKpi[id] = {}; sn.docs.forEach(d => { const x = d.data(); S.csKpi[id][x.periode] = x; }); renderCekSlip(); }).catch(() => { S.csKpi[id] = {}; renderCekSlip(); }); }
    const K = typeof S.csKpi[id] === "object" ? S.csKpi[id] : {};
    $("csTable").innerHTML = hist.length ? `<thead><tr><th>Periode</th><th>Penempatan</th><th>Status</th><th class="r">KPI</th><th class="r">Ditransfer</th><th></th></tr></thead><tbody>` +
      hist.map(({ k, P, r }) => { const D = slipData({ r, k, prDoc: P, kpi: K[k] || null }); return `<tr><td><b>${esc(perName(k))}</b><small class="note" style="display:block">${esc(perRange(k))}</small></td><td>${esc(shortCab(r.cabang || ""))}</td>
        <td><span class="pill ${P.status === "final" ? "ok" : "warn"}">${P.status === "final" ? "Dibayar " + esc(fmtDate(P.tglBayar)) : "Draft"}</span></td>
        <td class="r num">${D.kc ? D.kc.poin + "/" + KPI_MAX : "–"}</td><td class="r num"><b>${fmt(D.total)}</b></td>
        <td class="r"><button class="btn" type="button" data-cs="${esc(k)}">Lihat slip</button></td></tr>`; }).join("") + `</tbody>`
      : `<tr><td class="empty">Belum ada slip untuk karyawan ini.</td></tr>`;
  }
  $("csEmp").addEventListener("change", renderCekSlip);
  $("csQ").addEventListener("input", renderCekSlip);
  $("csTable").addEventListener("click", e => { const b = e.target.closest("[data-cs]"); if (!b) return; const id = $("csEmp").value, k = b.dataset.cs, P = S.prHist[k], r = (P?.rows || []).find(x => x.id === id);
    if (r) showSlip(r, k, P, (S.csKpi[id] || {})[k] || null); });

  /* ---------- persediaan: aset ---------- */
  const AS_KAT = ["Peralatan treatment", "Furnitur", "Elektronik", "Perlengkapan", "Kendaraan", "Lainnya"];
  S.pSub = ls.get("rpc-psub") === "aset" ? "aset" : "stok"; S.asEdit = null;
  function showPsub(p){ go(p === "aset" ? "inv/aset" : "inv/stok"); }
  const asLok = () => [...cabList(), "Pusat"];
  $("asTgl").value = "";
  ["asNilai"].forEach(id => $(id).addEventListener("input", e => { const n = parseRp(e.target.value); e.target.value = n ? fmt(n) : ""; }));
  function renderAset(){
    if (S.pSub !== "aset" || document.body.classList.contains("staff")) return;
    const L = asLok(), A = S.aset;
    fillSelect($("asLokasi"), L, $("asLokasi").value || L[0]); if (!$("asKat").options.length) $("asKat").innerHTML = optList(AS_KAT);
    { const keep = $("asFilter").value; $("asFilter").innerHTML = `<option value="">Semua lokasi</option>` + optList(L, keep); }
    $("asNames").innerHTML = [...new Set(A.map(a => a.nama))].map(n => `<option value="${esc(n)}">`).join("");
    const unit = sumOf(A, a => a.qty), rusak = sumOf(A, a => a.rusak), nilai = sumOf(A, a => (a.qty || 0) * (a.nilai || 0));
    $("asKpis").innerHTML = [
      ["Jenis aset", `<span class="num">${new Set(A.map(a => a.nama.toLowerCase())).size}</span>`, A.length + " catatan"],
      ["Total unit", `<span class="num">${fmt(unit)}</span>`, L.length + " lokasi"],
      ["Unit rusak", `<span class="num ${rusak ? "up" : ""}">${fmt(rusak)}</span>`, unit ? pct(rusak / unit) + " dari total" : "–"],
      ["Nilai aset", `<span class="num">${rpShort(nilai)}</span>`, "jumlah × nilai per unit"]
    ].map(([l,v,s]) => `<div class="kpi"><span class="l">${l}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join("");
    if (S.db && !S.asetLoaded) { $("asMatrix").innerHTML = `<tr><td class="empty">Memuat…</td></tr>`; }
    else if (!A.length) { $("asMatrix").innerHTML = `<tr><td class="empty">Belum ada aset. Tambahkan lewat form di bawah, atau import CSV.</td></tr>`; }
    else {
      const names = [...new Map(A.map(a => [a.nama.toLowerCase(), a])).values()].sort((a, b) => AS_KAT.indexOf(a.kategori) - AS_KAT.indexOf(b.kategori) || a.nama.localeCompare(b.nama));
      let h = `<thead><tr><th>Aset</th>${L.map(l => `<th class="c">${esc(shortCab(l))}</th>`).join("")}<th class="c">Total</th><th class="r">Nilai</th></tr></thead><tbody>`, kat = null;
      names.forEach(n => { const rows = A.filter(a => a.nama.toLowerCase() === n.nama.toLowerCase());
        if (n.kategori !== kat) { kat = n.kategori; h += `<tr class="day"><td colspan="${L.length + 3}">${esc(kat || "Lainnya")}</td></tr>`; }
        h += `<tr><td><b>${esc(n.nama)}</b></td>` + L.map(l => { const x = rows.filter(a => a.lokasi === l), q = sumOf(x, a => a.qty), rs = sumOf(x, a => a.rusak);
          return q ? `<td class="q"><b>${fmt(q)}</b>${rs ? `<small style="color:var(--crit)">${fmt(rs)} rusak</small>` : ""}</td>` : `<td class="q na">–</td>`; }).join("") +
          `<td class="q"><b>${fmt(sumOf(rows, a => a.qty))}</b></td><td class="r num">${fmtOrDash(sumOf(rows, a => (a.qty || 0) * (a.nilai || 0)))}</td></tr>`; });
      h += `<tr class="total"><td>Total</td>${L.map(l => `<td class="q">${fmtOrDash(sumOf(A.filter(a => a.lokasi === l), a => a.qty))}</td>`).join("")}<td class="q">${fmt(unit)}</td><td class="r num">${fmt(nilai)}</td></tr></tbody>`;
      $("asMatrix").innerHTML = h;
    }
    const fv = $("asFilter").value, list = A.filter(a => !fv || a.lokasi === fv).sort((a, b) => (a.lokasi || "").localeCompare(b.lokasi || "") || a.nama.localeCompare(b.nama));
    $("asList").innerHTML = list.length ? `<thead><tr><th>Aset</th><th>Lokasi</th><th class="r">Unit</th><th class="r">Nilai</th><th></th></tr></thead><tbody>` +
      list.map(a => `<tr><td><b>${esc(a.nama)}</b><small class="note" style="display:block">${esc(a.kategori || "")}${a.tglBeli ? " · beli " + esc(fmtDate(a.tglBeli)) : ""}${a.ket ? " · " + esc(a.ket) : ""} ${a.contoh ? `<span class="tag contoh">contoh</span>` : ""}</small></td><td>${esc(shortCab(a.lokasi))}</td>
        <td class="r num">${fmt(a.qty)}${a.rusak ? `<small style="display:block;color:var(--crit)">${fmt(a.rusak)} rusak</small>` : ""}</td><td class="r num">${fmtOrDash((a.qty || 0) * (a.nilai || 0))}</td>
        <td class="r" style="white-space:nowrap">${a.rusak ? `<button class="btn ghost danger" type="button" data-asmus="${esc(a.id)}">Musnahkan</button>` : ""}<button class="btn ghost" type="button" data-ased="${esc(a.id)}">Edit</button><button class="btn ghost danger" type="button" data-delas="${esc(a.id)}">Hapus</button></td></tr>`).join("") + `</tbody>`
      : `<tr><td class="empty">Belum ada aset${fv ? " di " + esc(shortCab(fv)) : ""}.</td></tr>`;
  }
  $("asFilter").addEventListener("change", renderAset);
  function asReset(){ S.asEdit = null; ["asNama","asQty","asRusak","asNilai","asKet","asTgl"].forEach(id => $(id).value = ""); $("asFormTitle").textContent = "Tambah aset"; $("asCancel").hidden = true; $("asEditHint").textContent = ""; }
  $("asCancel").addEventListener("click", asReset);
  $("asList").addEventListener("click", async e => {
    const ed = e.target.closest("[data-ased]");
    if (ed) { const a = S.aset.find(x => x.id === ed.dataset.ased); if (!a) return; S.asEdit = a.id;
      $("asLokasi").value = a.lokasi; $("asKat").value = AS_KAT.includes(a.kategori) ? a.kategori : "Lainnya"; $("asNama").value = a.nama; $("asQty").value = a.qty ?? ""; $("asRusak").value = a.rusak || ""; $("asNilai").value = a.nilai ? fmt(a.nilai) : ""; $("asTgl").value = a.tglBeli || ""; $("asKet").value = a.ket || "";
      $("asFormTitle").textContent = "Edit aset"; $("asEditHint").textContent = a.nama + " · " + shortCab(a.lokasi); $("asCancel").hidden = false; $("asNama").focus(); return; }
    const b = e.target.closest("[data-delas]"); if (!b) return;
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Yakin?"; setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.textContent = "Hapus"; } }, 3000); return; }
    b.disabled = true; try { await S.db.doc("aset/" + b.dataset.delas).delete(); toast("Aset dihapus"); if (S.asEdit === b.dataset.delas) asReset(); } catch { toast("Gagal menghapus"); b.disabled = false; }
  });
  $("asForm").addEventListener("submit", async e => { e.preventDefault(); const msg = $("asMsg");
    const doc = { lokasi: $("asLokasi").value, kategori: $("asKat").value, nama: $("asNama").value.trim(), qty: parseInt(String($("asQty").value).replace(/[^\d]/g, ""), 10) || 0, rusak: parseInt(String($("asRusak").value).replace(/[^\d]/g, ""), 10) || 0, nilai: parseRp($("asNilai").value), tglBeli: $("asTgl").value || "", ket: $("asKet").value.trim() };
    if (!S.db) { msg.textContent = "Penyimpanan belum tersambung."; return; }
    if (!doc.nama) { msg.textContent = "Isi nama aset."; $("asNama").focus(); return; }
    if (doc.qty <= 0) { msg.textContent = "Jumlah unit minimal 1."; return; }
    if (doc.rusak > doc.qty) { msg.textContent = "Unit rusak tidak boleh lebih dari jumlah unit."; return; }
    msg.textContent = "Menyimpan…";
    try { const base = { ...doc, by: S.uid || null, at: new Date().toISOString(), contoh: false };
      if (S.asEdit) await S.db.doc("aset/" + S.asEdit).set(base); else await S.db.collection("aset").add(base);
      msg.textContent = ""; toast((S.asEdit ? "Aset diperbarui: " : "Aset tersimpan: ") + doc.nama + " · " + shortCab(doc.lokasi)); asReset(); }
    catch (err) { msg.textContent = err?.code === "invalid_argument" ? "Hanya admin yang bisa mengubah data aset." : "Gagal menyimpan, coba lagi."; }
  });
  $("asCsv").addEventListener("click", async () => { if (!S.aset.length) { toast("Belum ada aset"); return; }
    const q = v => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [["Lokasi","Nama aset","Kategori","Jumlah","Rusak","Nilai per unit","Total nilai","Tanggal beli","Keterangan"].map(q).join(",")];
    S.aset.forEach(a => lines.push([a.lokasi, a.nama, a.kategori, a.qty, a.rusak || 0, a.nilai || 0, (a.qty || 0) * (a.nilai || 0), a.tglBeli || "", a.ket || ""].map(q).join(",")));
    try { await S.dl.save({ filename: "Daftar Aset Lash Bounty.csv", data: "﻿" + lines.join("\n") }); toast("File disimpan"); } catch (err) { if (err?.code !== "declined") toast("Download gagal"); } });

  /* ---------- omzet manual ---------- */
  const OM_KAT = ["Penjualan produk", "Jasa di luar Zenwel", "Paket / membership", "Pemasukan lain"];
  $("omTgl").value = todayISO();
  $("omJml").addEventListener("input", e => { const n = parseRp(e.target.value); e.target.value = n ? fmt(n) : ""; });
  $("omForm").addEventListener("submit", async e => { e.preventDefault(); const msg = $("omMsg");
    const doc = { cabang: $("omCabang").value, tanggal: $("omTgl").value, kategori: $("omKat").value, keterangan: $("omKet").value.trim(), total: parseRp($("omJml").value), pengisi: $("omPengisi").value.trim() };
    if (!S.db) { msg.textContent = "Penyimpanan belum tersambung."; return; }
    if (!doc.cabang) { msg.textContent = "Pilih cabang."; return; }
    if (!doc.tanggal) { msg.textContent = "Isi tanggal."; return; }
    const lk = lockOf(doc.tanggal); if (lk) { msg.textContent = lk; return; }
    if (!(doc.total > 0)) { msg.textContent = "Jumlah harus lebih dari 0."; return; }
    if (!doc.keterangan) { msg.textContent = "Isi keterangan."; return; }
    if (!doc.pengisi) { msg.textContent = "Isi nama pengisi."; return; }
    msg.textContent = "Menyimpan…";
    try { await S.db.collection("sales").add({ ...doc, bulan: doc.tanggal.slice(0, 7), sumber: "Manual", net: doc.total, items: [], qty: 0, by: S.uid || null, at: new Date().toISOString(), contoh: false });
      msg.textContent = ""; toast("Omzet manual tersimpan: " + shortCab(doc.cabang) + " · " + rp(doc.total));
      if ($("omCust").value.trim() && doc.cabang !== "Pusat") { ctAdd([{ tanggal: doc.tanggal, cabang: doc.cabang, nama: $("omCust").value.trim(), hp: $("omHp").value, layanan: doc.keterangan, total: doc.total, src: "omzet manual" }]).catch(() => {}); }
      $("omJml").value = ""; $("omKet").value = ""; $("omCust").value = ""; $("omHp").value = ""; jumpTo(doc.tanggal); }
    catch (err) { msg.textContent = err?.code === "invalid_argument" ? "Akun kamu belum punya akses tulis." : "Gagal menyimpan, coba lagi."; }
  });

  /* ---------- scan nota untuk pengeluaran pusat & biaya cabang ---------- */
  async function scanNota(file, f){
    if (!file || !S.sample) return; f.btn.textContent = "Membaca nota…"; f.msg.textContent = "";
    try {
      const out = await S.sample.json("Gambar ini adalah foto nota/struk/kuitansi pengeluaran sebuah salon kecantikan di Indonesia. Ambil datanya.\n" +
        "Pilih kategori yang paling cocok dari daftar ini: " + JSON.stringify(f.kats) + ".\n" +
        "Balas hanya JSON: {\"tanggal\":\"YYYY-MM-DD atau null\",\"jumlah\":angka total akhir rupiah atau null,\"keterangan\":\"ringkas maks 8 kata\",\"nota\":\"nomor nota atau null\",\"kategori\":\"salah satu dari daftar atau null\"}. Isi null kalau tidak yakin.",
        { images: [file], modelTier: "default" });
      let n = 0;
      if (out?.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(out.tanggal)) { $(f.tgl).value = out.tanggal; n++; }
      if (Number(out?.jumlah) > 0) { $(f.jml).value = fmt(Number(out.jumlah)); n++; }
      if (out?.keterangan) { $(f.ket).value = String(out.keterangan).slice(0, 140); n++; }
      if (out?.nota) { $(f.nota).value = String(out.nota).slice(0, 40); n++; }
      if (out?.kategori && f.kats.includes(out.kategori)) $(f.kat).value = out.kategori;
      f.msg.textContent = n ? "Terisi dari nota. Cek angka & kategorinya, lalu simpan." : "Nota tidak terbaca jelas. Isi manual ya.";
    } catch (err) {
      if (["not_granted","sampling_disabled","not_declared","capability_disabled","capability_removed","images_unavailable"].includes(err?.code)) { f.box.hidden = true; f.msg.textContent = "Scan AI tidak tersedia di tampilan ini."; }
      else if (err?.code === "rate_limited") f.msg.textContent = "Terlalu banyak permintaan. Coba lagi beberapa menit lagi.";
      else if (err?.code !== "cancelled") f.msg.textContent = "Gagal membaca nota. Coba lagi atau isi manual.";
    } finally { f.btn.textContent = "Pilih foto nota"; }
  }
  $("pcScan").addEventListener("change", e => { const file = e.target.files?.[0]; e.target.value = ""; scanNota(file, { tgl:"pcTgl", jml:"pcJml", ket:"pcKet", nota:"pcNota", kat:"pcKat", kats:PST_KAT, msg:$("pcMsg"), btn:$("pcScanBtn"), box:$("pcScanBox") }); });
  $("bcScan").addEventListener("change", e => { const file = e.target.files?.[0]; e.target.value = ""; scanNota(file, { tgl:"bcTgl", jml:"bcJml", ket:"bcKet", nota:"bcNota", kat:"bcKat", kats:CAB_KAT, msg:$("bcMsg"), btn:$("bcScanBtn"), box:$("bcScanBox") }); });

  /* ---------- import CSV ---------- */
  const normH = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const parseTgl = v => { v = String(v || "").trim(); let m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v))) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
    if ((m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(v))) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return y + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0"); }
    return ""; };
  const validISO = s => { if (!s) return false; const d = new Date(s + "T00:00"); return !isNaN(d) && isoOf(d) === s; };
  const findCab = v => cabList().find(c => slug(c) === slug(v)) || "";
  const pickKat = (v, list) => list.find(k => normH(k) === normH(v)) || list.find(k => normH(k).startsWith(normH(v)) && normH(v).length >= 3) || "";
  const hmOk = v => !v || /^\d{1,2}[:.]\d{2}$/.test(String(v).trim());
  const hmNorm = v => { v = String(v || "").trim().replace(".", ":"); const m = /^(\d{1,2}):(\d{2})$/.exec(v); return m ? m[1].padStart(2, "0") + ":" + m[2] : ""; };
  const IM = {
    pc: { label: "Petty cash cabang", cols: [["Tanggal",1,"2026-10-24","YYYY-MM-DD atau DD/MM/YYYY"],["Cabang",1,"Gading Serpong","nama cabang"],["Keterangan",1,"Beli galon & gas LPG",""],["Jumlah",1,"85000","angka, boleh pakai titik"],["No Nota",0,"NT-1042",""],["Diisi Oleh",1,"Rina",""]],
      ex2: ["2026-10-25","Tebet","Tisu & sabun","62500","","Dewi"],
      build: v => { const t = parseTgl(v.tanggal), c = findCab(v.cabang), j = num(v.jumlah);
        if (!validISO(t)) return "Tanggal tidak valid"; if (!c) return "Cabang tidak dikenal"; if (!v.keterangan) return "Keterangan kosong"; if (!(j > 0)) return "Jumlah harus > 0"; if (!v.diisioleh) return "Diisi oleh kosong";
        return { coll: "expenses", doc: { cabang: c, tanggal: t, bulan: t.slice(0, 7), jumlah: j, keterangan: v.keterangan, nota: v.nonota || "", pengisi: v.diisioleh, sumber: "CSV" } }; } },
    bc: { label: "Biaya cabang di luar petty cash", cols: [["Tanggal",1,"2026-10-06",""],["Cabang",1,"Tebet",""],["Kategori",1,"Listrik", CAB_KAT.join(" / ")],["Keterangan",1,"Tagihan PLN Oktober",""],["Jumlah",1,"1850000",""],["No Bukti",0,"PLN-1006",""],["Diisi Oleh",1,"Ci Yuli",""],["Dibayar Dari",0,"Pusat","Kas cabang / Pusat / FMS / Koko"]],
      ex2: ["2026-10-12","Bekasi","Perbaikan cabang","Service AC 2 unit","2400000","SRV-221","Ci Yuli","Koko"],
      build: v => { const t = parseTgl(v.tanggal), c = findCab(v.cabang), k = pickKat(v.kategori, CAB_KAT), j = num(v.jumlah);
        if (!validISO(t)) return "Tanggal tidak valid"; if (!c) return "Cabang tidak dikenal"; if (!k) return "Kategori tidak dikenal"; if (!v.keterangan) return "Keterangan kosong"; if (!(j > 0)) return "Jumlah harus > 0"; if (!v.diisioleh) return "Diisi oleh kosong";
        return { coll: "pusat", doc: { unit: c, kategori: k, tanggal: t, bulan: t.slice(0, 7), jumlah: j, keterangan: v.keterangan, nota: v.nobukti || "", dana: v.dibayardari || "", pengisi: v.diisioleh, sumber: "CSV" } }; } },
    ps: { label: "Pengeluaran pusat", cols: [["Tanggal",1,"2026-10-03",""],["Kategori",1,"Petty cash pusat", PST_KAT.join(" / ")],["Keterangan",1,"ATK kantor",""],["Jumlah",1,"245000",""],["No Bukti",0,"PST-101",""],["Diisi Oleh",1,"Ci Yuli",""]],
      ex2: ["2026-10-10","Kendaraan & leasing","Leasing mobil operasional ke-8","6200000","LS-08","Ci Yuli"],
      build: v => { const t = parseTgl(v.tanggal), k = pickKat(v.kategori, PST_KAT), j = num(v.jumlah);
        if (!validISO(t)) return "Tanggal tidak valid"; if (!k) return "Kategori tidak dikenal"; if (!v.keterangan) return "Keterangan kosong"; if (!(j > 0)) return "Jumlah harus > 0"; if (!v.diisioleh) return "Diisi oleh kosong";
        return { coll: "pusat", doc: { unit: "Pusat", kategori: k, tanggal: t, bulan: t.slice(0, 7), jumlah: j, keterangan: v.keterangan, nota: v.nobukti || "", pengisi: v.diisioleh, sumber: "CSV" } }; } },
    om: { label: "Omzet manual", cols: [["Tanggal",1,"2026-10-24",""],["Cabang",1,"Pluit",""],["Jenis",1,"Penjualan produk", OM_KAT.join(" / ")],["Keterangan",1,"Jual serum bulu mata 2 pcs",""],["Jumlah",1,"350000",""],["Diisi Oleh",1,"Ci Yuli",""]],
      ex2: ["2026-10-24","Gading Serpong","Paket / membership","Membership 10x lash retouch","1500000","Ci Yuli"],
      build: v => { const t = parseTgl(v.tanggal), c = findCab(v.cabang), k = pickKat(v.jenis, OM_KAT), j = num(v.jumlah);
        if (!validISO(t)) return "Tanggal tidak valid"; if (!c) return "Cabang tidak dikenal"; if (!k) return "Jenis tidak dikenal"; if (!v.keterangan) return "Keterangan kosong"; if (!(j > 0)) return "Jumlah harus > 0"; if (!v.diisioleh) return "Diisi oleh kosong";
        return { coll: "sales", doc: { cabang: c, tanggal: t, bulan: t.slice(0, 7), sumber: "Manual", kategori: k, keterangan: v.keterangan, total: j, net: j, items: [], qty: 0, pengisi: v.diisioleh } }; } },
    ab: { label: "Absensi", cols: [["Tanggal",1,"2026-10-24",""],["Nama",1,"Maya Safitri","sama persis dengan Data karyawan"],["Status",1,"H","H hadir / I izin / S sakit / C cuti / A alpha / L libur"],["Masuk",0,"09:55","HH:MM, wajib kalau H"],["Pulang",0,"19:02","HH:MM"],["Keterangan",0,"",""]],
      ex2: ["2026-10-24","Contoh Karyawan 2","I","","","Izin keluarga"],
      build: v => { const t = parseTgl(v.tanggal), e = kyList().find(x => x.nama.toLowerCase().trim() === String(v.nama || "").toLowerCase().trim()), st = String(v.status || "H").trim().toUpperCase().slice(0, 1);
        if (!validISO(t)) return "Tanggal tidak valid"; if (!e) return "Nama tidak ada di Data karyawan"; if (!"HISCAL".includes(st) || !st) return "Status harus H/I/S/C/A/L";
        if (!hmOk(v.masuk) || !hmOk(v.pulang)) return "Jam harus format HH:MM"; if (st === "H" && !hmNorm(v.masuk)) return "Hadir perlu jam masuk";
        return { coll: "absen", id: absId(t, e.id), doc: { tanggal: t, periode: perOf(t), bulan: t.slice(0, 7), empId: e.id, nama: e.nama, cabang: e.cabang, status: st, masuk: st === "H" ? hmNorm(v.masuk) : "", pulang: st === "H" ? hmNorm(v.pulang) : "", ket: v.keterangan || "", sumber: "CSV" } }; } },
    as: { label: "Aset", cols: [["Lokasi",1,"Gading Serpong","nama cabang atau Pusat"],["Nama Aset",1,"Kasur lash bed",""],["Kategori",1,"Furnitur", AS_KAT.join(" / ")],["Jumlah",1,"4",""],["Rusak",0,"0",""],["Nilai per Unit",0,"2500000",""],["Tanggal Beli",0,"2025-03-01",""],["Keterangan",0,"",""]],
      ex2: ["Pusat","Laptop admin","Elektronik","2","0","7000000","2024-11-15","ASUS"],
      build: v => { const l = /^pusat$/i.test(String(v.lokasi || "").trim()) ? "Pusat" : findCab(v.lokasi), k = pickKat(v.kategori, AS_KAT) || "Lainnya", q = parseInt(String(v.jumlah).replace(/[^\d]/g, ""), 10) || 0, r = parseInt(String(v.rusak || 0).replace(/[^\d]/g, ""), 10) || 0, tb = v.tanggalbeli ? parseTgl(v.tanggalbeli) : "";
        if (!l) return "Lokasi tidak dikenal"; if (!v.namaaset) return "Nama aset kosong"; if (q <= 0) return "Jumlah minimal 1"; if (r > q) return "Rusak lebih dari jumlah"; if (v.tanggalbeli && !validISO(tb)) return "Tanggal beli tidak valid";
        return { coll: "aset", doc: { lokasi: l, nama: v.namaaset, kategori: k, qty: q, rusak: r, nilai: num(v.nilaiperunit), tglBeli: tb, ket: v.keterangan || "", sumber: "CSV" } }; } }
  };
  S.im = null;
  $("imType").innerHTML = Object.entries(IM).map(([k, t]) => `<option value="${k}">${esc(t.label)}</option>`).join("");
  $("imType").value = IM[ls.get("rpc-imtype")] ? ls.get("rpc-imtype") : "pc";
  function renderImGuide(){ const T = IM[$("imType").value];
    $("imGuide").innerHTML = `<div class="scroll"><table class="im-g"><thead><tr><th>Kolom</th><th>Wajib</th><th>Contoh</th><th>Keterangan</th></tr></thead><tbody>` +
      T.cols.map(([n, w, ex, k]) => `<tr><td><b>${esc(n)}</b></td><td>${w ? "Ya" : "–"}</td><td class="num">${esc(ex || "–")}</td><td class="note">${esc(k || "")}</td></tr>`).join("") + `</tbody></table></div>`; }
  function renderImpor(){ if (S.tab !== "impor") return; if (!adminGate("imBody", "imRO")) return; if (!$("imGuide").innerHTML) renderImGuide(); }
  $("imType").addEventListener("change", e => { ls.set("rpc-imtype", e.target.value); S.im = null; $("imPreview").innerHTML = ""; $("imGo").disabled = true; $("imMsg").textContent = ""; renderImGuide(); });
  $("imTpl").addEventListener("click", async () => { const T = IM[$("imType").value];
    const q = v => { const s = String(v ?? ""); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const data = "﻿" + [T.cols.map(c => c[0]), T.cols.map(c => c[2]), T.ex2].map(r => r.map(q).join(";")).join("\n") + "\n";
    if (!S.dl) { toast("Download tidak tersedia di tampilan ini"); return; }
    try { await S.dl.save({ filename: `Template ${T.label}.csv`, data }); toast("Template disimpan. Hapus 2 baris contoh sebelum diisi."); } catch (err) { if (err?.code !== "declined") toast("Download gagal"); } });
  async function imLoad(file){
    if (!file) return; const T = IM[$("imType").value]; $("imMsg").textContent = "Membaca file…"; $("imGo").disabled = true;
    const readText = f => typeof f.text === "function" ? f.text() : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(f); });
    void readText; let rows; try { rows = parseCSV(await fileToCsv(file, T)); } catch (err) { $("imMsg").textContent = err?.message && /AI|Sheet|PDF|foto/.test(err.message) ? err.message : "File tidak terbaca."; return; }
    if (rows.length < 2) { $("imMsg").textContent = "File kosong. Isi minimal 1 baris di bawah judul kolom."; return; }
    const head = rows[0].map(normH), need = T.cols.filter(c => c[1]).map(c => normH(c[0])), miss = need.filter(h => !head.includes(h));
    if (miss.length) { $("imMsg").textContent = "Kolom belum lengkap: " + T.cols.filter(c => miss.includes(normH(c[0]))).map(c => c[0]).join(", ") + ". Pakai template dari tombol di atas."; $("imPreview").innerHTML = ""; return; }
    const out = rows.slice(1).map((r, i) => { const v = {}; head.forEach((h, j) => v[h] = String(r[j] ?? "").trim()); const b = T.build(v);
      if (typeof b === "string") return { n: i + 2, v, err: b }; const lk = b.doc.tanggal ? lockOf(b.doc.tanggal) : ""; return lk ? { n: i + 2, v, err: "Periode sudah tutup buku" } : { n: i + 2, v, ok: b }; });
    S.im = { type: $("imType").value, rows: out, file: file.name };
    const good = out.filter(x => x.ok), bad = out.filter(x => x.err);
    $("imPreview").innerHTML = `<div class="zprev"><div class="scroll"><table><thead><tr><th>Baris</th><th>Status</th>${T.cols.map(c => `<th>${esc(c[0])}</th>`).join("")}</tr></thead><tbody>` +
      out.slice(0, 200).map(x => `<tr class="${x.err ? "im-bad" : ""}"><td class="num">${x.n}</td><td>${x.err ? `<span class="pill no">${esc(x.err)}</span>` : `<span class="pill ok">OK</span>`}</td>${T.cols.map(c => `<td>${esc(x.v[normH(c[0])] || "")}</td>`).join("")}</tr>`).join("") +
      `</tbody></table></div><div class="zcheck ${bad.length ? "bad" : "okc"}">${good.length} baris siap di-import${bad.length ? " · " + bad.length + " baris bermasalah (tidak ikut)" : ""}${out.length > 200 ? " · tabel menampilkan 200 baris pertama" : ""}</div></div>`;
    $("imMsg").textContent = ""; $("imGo").disabled = !good.length; $("imGo").textContent = good.length ? `Import ${good.length} baris` : "Import";
  }
  $("imFile").addEventListener("change", e => { const f = e.target.files?.[0]; e.target.value = ""; imLoad(f); });
  { const d = $("imDrop"); ["dragenter","dragover"].forEach(ev => d.addEventListener(ev, e => { e.preventDefault(); d.classList.add("over"); }));
    ["dragleave","drop"].forEach(ev => d.addEventListener(ev, e => { e.preventDefault(); d.classList.remove("over"); })); d.addEventListener("drop", e => imLoad(e.dataTransfer?.files?.[0])); }
  $("imGo").addEventListener("click", async () => {
    const I = S.im; if (!I || !S.db) return; const good = I.rows.filter(x => x.ok); const btn = $("imGo"); btn.disabled = true; let n = 0, fail = 0;
    for (const x of good) { const base = { ...x.ok.doc, by: S.uid || null, at: new Date().toISOString(), contoh: false };
      try { if (x.ok.id) await S.db.doc(x.ok.coll + "/" + x.ok.id).set(base); else await S.db.collection(x.ok.coll).add(base); n++; } catch { fail++; }
      $("imMsg").textContent = `Mengimport… ${n + fail}/${good.length}`; }
    $("imMsg").textContent = `Selesai: ${n} baris masuk${fail ? ", " + fail + " gagal (cek akses)" : ""}.`; toast(`Import ${IM[I.type].label}: ${n} baris`);
    S.im = null; $("imPreview").innerHTML = ""; btn.textContent = "Import";
  });

  /* ---------- notifikasi pengeluaran besar (dashboard) ---------- */
  function bigList(k = S.rk){ const min = hrCfg().notifMin;
    return [...S.rows.filter(r => inPer(r.tanggal, k) && (r.jumlah || 0) >= min).map(r => ({ coll: "expenses", id: r.id, tanggal: r.tanggal, unit: r.cabang, kat: "Petty cash", ket: r.keterangan, jumlah: r.jumlah, wa: !!r.notifWa, cek: !!r.cekOwner, pengisi: r.pengisi, contoh: r.contoh })),
      ...S.ps.map(biayaNorm).filter(p => inPer(p.tanggal, k) && (p.jumlah || 0) >= min).map(p => ({ coll: "pusat", id: p.id, tanggal: p.tanggal, unit: p.unit, kat: p.kategori, ket: p.keterangan, jumlah: p.jumlah, wa: !!p.notifWa, cek: !!p.cekOwner, pengisi: p.pengisi, contoh: p.contoh }))]
      .sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || "") || b.jumlah - a.jumlah); }
  S.nfAll = false;
  function renderNotif(){
    const L = bigList(), open = L.filter(x => !x.cek), show = S.nfAll ? L : open.slice(0, 6);
    $("dNotifHint").textContent = L.length ? `${open.length} belum dicek · di atas ${rpShort(hrCfg().notifMin)}` : "";
    $("dNotif").innerHTML = (show.length ? show.map(x => `<div class="alert"><span class="pill ${x.cek ? "ok" : "warn"}">${x.cek ? "Dicek" : "Baru"}</span><div style="flex:1;min-width:0"><b>${esc(x.ket)} · ${rp(x.jumlah)}</b>
        <div class="note">${esc(shortCab(x.unit))} · ${esc(x.kat)} · ${esc(fmtDate(x.tanggal))}${x.pengisi ? " · " + esc(x.pengisi) : ""} · ${x.wa ? "WA terkirim" : "WA belum dikirim"} ${x.contoh ? `<span class="tag contoh">contoh</span>` : ""}</div></div>
        ${x.cek ? "" : `<button class="btn ghost" type="button" data-nfcek="${esc(x.coll)}|${esc(x.id)}">Tandai dicek</button>`}</div>`).join("")
      : `<div class="empty">${L.length ? "Semua pengeluaran besar sudah dicek." : "Tidak ada pengeluaran di atas " + rp(hrCfg().notifMin) + " di " + perName(S.rk) + "."}</div>`) +
      (L.length > show.length || S.nfAll ? `<button class="btn ghost" type="button" id="nfAllBtn" style="margin-top:6px">${S.nfAll ? "Tampilkan yang belum dicek saja" : "Lihat semua (" + L.length + ")"}</button>` : "") +
      (!waNum(hrCfg().ownerWa) ? `<p class="note" style="margin:8px 0 0">No. WhatsApp owner belum diisi. Isi di Pengaturan supaya tombol kirim WA muncul setelah input.</p>` : "");
  }
  $("dNotif").addEventListener("click", async e => {
    if (e.target.id === "nfAllBtn") { S.nfAll = !S.nfAll; renderNotif(); return; }
    const b = e.target.closest("[data-nfcek]"); if (!b) return; const [coll, id] = b.dataset.nfcek.split("|"); b.disabled = true;
    try { await S.db.doc(coll + "/" + id).update({ cekOwner: true, cekAt: new Date().toISOString() }); } catch { toast("Gagal menandai"); b.disabled = false; } });

  /* ---------- compare antar bulan ---------- */
  S.cmpSel = null; S.cmpData = {}; S.cmpBusy = false;
  function cmpOpts(){ const out = []; let k = perOf(todayISO()); for (let i = 0; i < 12; i++) { out.push(k); k = prevMonth(k); } return out; }
  async function cmpFetch(k){
    const mons = [prevMonth(k), k], q = (coll) => S.db.collection(coll).where("bulan", "in", mons).limit(1000).get().then(sn => sn.docs.map(d => ({ id: d.id, ...d.data() })));
    const [sales, ex, ps, pr] = await Promise.all([q("sales"), q("expenses"), q("pusat").catch(() => []), S.db.doc("payroll/" + k).get().then(s => s.exists ? s.data() : null).catch(() => null)]);
    const ms = sales.filter(s => inPer(s.tanggal, k)), pc = ex.filter(r => inPer(r.tanggal, k)), B = ps.map(biayaNorm).filter(p => inPer(p.tanggal, k));
    const omC = {}; ms.forEach(s => { omC[s.cabang] = (omC[s.cabang] || 0) + (s.total || 0); });
    const it = {}; ms.forEach(s => (s.items || []).forEach(x => { it[x.item] = (it[x.item] || 0) + (x.total || 0); }));
    const prT = pr ? (pr.total > 0 ? pr.total : sumOf(pr.rows || [], r => { r = prNorm(r); return (r.pokok || 0) + (r.tunjangan || 0) + (r.bonus || 0) + (r.komisi || 0) - (r.potLain || 0); })) : 0;
    return { om: sumOf(ms, s => s.total), omC, pc: sumOf(pc, r => r.jumlah), nPc: pc.length, bc: sumOf(B.filter(p => p.unit !== "Pusat"), p => p.jumlah), ps: sumOf(B.filter(p => p.unit === "Pusat"), p => p.jumlah), pr: prT, prAda: !!pr,
      top: Object.entries(it).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]) };
  }
  async function cmpLoad(force){
    if (!S.db || !S.admin || !S.cfgLoaded) return; if (!S.cmpSel) { const o = cmpOpts(); S.cmpSel = [o[2], o[1], o[0]]; }
    const need = S.cmpSel.filter(k => force || !S.cmpData[k]); if (!need.length) { renderCmp(); return; }
    S.cmpBusy = true; renderCmp();
    try { for (const k of need) S.cmpData[k] = await cmpFetch(k); } catch { toast("Data pembanding tidak bisa dimuat"); }
    S.cmpBusy = false; renderCmp();
  }
  function renderCmp(){
    const opts = cmpOpts(); if (!S.cmpSel) S.cmpSel = [opts[2], opts[1], opts[0]];
    $("cmpChips").innerHTML = opts.slice().reverse().map(k => `<button type="button" class="chip" data-cmp="${k}" aria-pressed="${S.cmpSel.includes(k)}">${BLN[+k.slice(5) - 1].slice(0, 3)} ${k.slice(0, 4)}</button>`).join("");
    const sel = [...S.cmpSel].sort(), G = grups(), D = sel.map(k => S.cmpData[k]);
    D.forEach(x => { if (x) { x.omG = {}; G.forEach(g => x.omG[g] = sumOf(cabsOfGrup(g), c => x.omC[c] || 0)); } });
    if (S.cmpBusy || D.some(x => !x)) { $("cmpTable").innerHTML = `<tr><td class="empty">${S.cmpBusy ? "Memuat data pembanding…" : "Klik Muat ulang untuk memuat data."}</td></tr>`; $("cmpChart").innerHTML = ""; $("cmpLegend").innerHTML = ""; return; }
    const delta = vals => { const a = vals[0], b = vals[vals.length - 1]; if (!a || sel.length < 2) return "–"; const d = b / a - 1; return `<span class="${d >= 0 ? "down" : "up"}">${d >= 0 ? "+" : ""}${pct(d)}</span>`; };
    const deltaCost = vals => { const a = vals[0], b = vals[vals.length - 1]; if (!a || sel.length < 2) return "–"; const d = b / a - 1; return `<span class="${d <= 0 ? "down" : "up"}">${d >= 0 ? "+" : ""}${pct(d)}</span>`; };
    const row = (label, vals, cls = "", cost = false) => `<tr class="${cls}"><td>${label}</td>${vals.map(v => `<td class="r num">${fmtOrDash(v)}</td>`).join("")}<td class="r num">${cost ? deltaCost(vals) : delta(vals)}</td></tr>`;
    let h = `<thead><tr><th></th>${sel.map(k => `<th class="r">${esc(mName(k))}</th>`).join("")}<th class="r">${sel.length > 1 ? esc(mName(sel[sel.length - 1]).split(" ")[0]) + " vs " + esc(mName(sel[0]).split(" ")[0]) : ""}</th></tr></thead><tbody>`;
    h += row("<b>Omzet total</b>", D.map(x => x.om), "sub");
    G.forEach(g => { h += row(`Omzet ${esc(g)}`, D.map(x => x.omG[g] || 0)); cabsOfGrup(g).forEach(c => { h += row(`<span class="ind">${esc(shortCab(c))}</span>`, D.map(x => x.omC[c] || 0), "minor"); }); });
    h += row("<b>Pengeluaran cabang</b>", D.map(x => x.pc + x.bc), "sub", true);
    h += row(`<span class="ind">Petty cash</span>`, D.map(x => x.pc), "minor", true) + row(`<span class="ind">Di luar petty cash</span>`, D.map(x => x.bc), "minor", true);
    h += row("Pengeluaran pusat", D.map(x => x.ps), "", true) + row("Payroll", D.map(x => x.pr), "", true);
    h += row("<b>Total pengeluaran</b>", D.map(x => x.pc + x.bc + x.ps + x.pr), "sub", true);
    h += `<tr><td>Transaksi petty cash</td>${D.map(x => `<td class="r num">${x.nPc || "–"}</td>`).join("")}<td></td></tr>`;
    h += `<tr><td>Layanan terlaris</td>${D.map(x => `<td class="r" style="font-size:12.5px">${esc(x.top.join(", ") || "–")}</td>`).join("")}<td></td></tr></tbody>`;
    $("cmpTable").innerHTML = h;
    // grafik: omzet per grup per bulan
    const maxV = Math.max(1, ...D.map(x => Math.max(0, ...G.map(g => x.omG[g] || 0))));
    const step = [1e6, 2e6, 5e6, 1e7, 2e7, 5e7, 1e8, 2e8, 5e8].find(s => maxV / s <= 4) || 5e8, top = Math.ceil(maxV / step) * step;
    const W = 760, H = 220, Lm = 48, R = 8, T = 16, B = 28, pw = W - Lm - R, ph = H - T - B, gw = pw / sel.length, bw = Math.min(34, (gw - 16) / Math.max(1, G.length));
    let svg = `<svg class="daily" viewBox="0 0 ${W} ${H}" role="img" aria-label="Omzet per grup per bulan">`;
    for (let v = 0; v <= top; v += step) { const y = T + ph - v / top * ph; svg += `<line class="grid" x1="${Lm}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${Lm - 6}" y="${y + 3}" text-anchor="end">${v ? (v / 1e6).toLocaleString("id-ID") + " jt" : "0"}</text>`; }
    sel.forEach((k, i) => { const x0 = Lm + i * gw + (gw - bw * G.length - 2 * (G.length - 1)) / 2;
      G.forEach((g, j) => { const v = D[i].omG[g] || 0, hh = Math.max(v ? 1 : 0, v / top * ph), x = x0 + j * (bw + 2);
        svg += `<rect x="${x.toFixed(1)}" y="${(T + ph - hh).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="3" fill="${grupCol(g)}"><title>${esc(mName(k))} · ${esc(g)}: ${rp(v)}</title></rect>`; });
      svg += `<text x="${(Lm + i * gw + gw / 2).toFixed(1)}" y="${H - 9}" text-anchor="middle">${esc(mName(k).slice(0, 3) + " " + k.slice(2, 4))}</text>`; });
    $("cmpChart").innerHTML = svg + `</svg>`;
    $("cmpLegend").innerHTML = G.map(g => `<span><i style="background:${grupCol(g)}"></i>Omzet ${esc(g)}</span>`).join("");
  }
  $("cmpChips").addEventListener("click", e => { const b = e.target.closest("[data-cmp]"); if (!b) return; const k = b.dataset.cmp;
    if (S.cmpSel.includes(k)) { if (S.cmpSel.length <= 2) { toast("Minimal 2 bulan"); return; } S.cmpSel = S.cmpSel.filter(x => x !== k); }
    else { if (S.cmpSel.length >= 6) { toast("Maksimal 6 bulan"); return; } S.cmpSel.push(k); }
    cmpLoad(); });
  $("cmpReload").addEventListener("click", () => { S.cmpData = {}; cmpLoad(true); });
  $("cmpCsv").addEventListener("click", async () => { const sel = [...(S.cmpSel || [])].sort(), D = sel.map(k => S.cmpData[k]); if (D.some(x => !x)) { toast("Data belum dimuat"); return; }
    const q = v => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    D.forEach(x => { x.omG = {}; grups().forEach(g => x.omG[g] = sumOf(cabsOfGrup(g), c => x.omC[c] || 0)); });
    const lines = [["Baris", ...sel.map(mName)].map(q).join(",")], add = (l, vals) => lines.push([l, ...vals].map(q).join(","));
    add("Omzet total", D.map(x => x.om)); grups().forEach(g => { add("Omzet " + g, D.map(x => x.omG[g] || 0)); cabsOfGrup(g).forEach(c => add("  " + shortCab(c), D.map(x => x.omC[c] || 0))); });
    add("Petty cash", D.map(x => x.pc)); add("Biaya cabang di luar petty cash", D.map(x => x.bc)); add("Pengeluaran pusat", D.map(x => x.ps)); add("Payroll", D.map(x => x.pr)); add("Total pengeluaran", D.map(x => x.pc + x.bc + x.ps + x.pr));
    try { await S.dl.save({ filename: "Compare " + sel.map(k => mName(k)).join(" - ") + ".csv", data: "﻿" + lines.join("\n") }); toast("File disimpan"); } catch (err) { if (err?.code !== "declined") toast("Download gagal"); } });

  /* ---------- halaman tutup buku ---------- */
  function plOf(k){
    const ms = S.sales.filter(s => inPer(s.tanggal, k)), zen = ms.filter(s => s.sumber !== "Manual"), man = ms.filter(s => s.sumber === "Manual");
    const pc = S.rows.filter(r => inPer(r.tanggal, k)), B = biayaPer(k), bc = B.filter(p => p.unit !== "Pusat"), ps = B.filter(p => p.unit === "Pusat");
    const prC = {}, ks = tokKeys(k); ks.forEach(mk => Object.entries(payrollByCab(mk)).forEach(([c, v]) => { prC[c] = (prC[c] || 0) + v; }));
    const prCab = sumOf(Object.entries(prC).filter(([c]) => c !== "Pusat"), x => x[1]), prPst = prC["Pusat"] || 0;
    const omG = {}; grups().forEach(g => omG[g] = sumOf(zen.filter(s => grupOf(s.cabang) === g), s => s.total));
    const masuk = sumOf(ms, s => s.total), keluar = sumOf(pc, r => r.jumlah) + sumOf(B, p => p.jumlah) + prCab + prPst;
    const perCab = cabList().map(c => { const om = sumOf(ms.filter(s => s.cabang === c), s => s.total), ex = sumOf(pc.filter(r => r.cabang === c), r => r.jumlah) + sumOf(bc.filter(p => p.unit === c), p => p.jumlah) + (prC[c] || 0); return { c, om, ex, kon: om - ex }; });
    return { ms, zen, man, pc, bc, ps, prCab, prPst, omG, masuk, keluar, laba: masuk - keluar, perCab, pstEx: sumOf(ps, p => p.jumlah) + prPst };
  }
  // ---- checklist tutup buku + detail yang belum beres
  const fmtD = iso => { const [, m, d] = String(iso).split("-"); return +d + " " + BLN[+m - 1].slice(0, 3); };
  const listCap = (arr, n = 12) => arr.length > n ? arr.slice(0, n).join(", ") + " +" + (arr.length - n) + " lagi" : arr.join(", ");
  function checklist(k){
    const cabs = cabList(), t = todayISO(), ds = perDays(k).filter(d => t > perEnd(k) || d < t), out = [];
    const noPc = cabs.filter(c => !S.rows.some(r => r.cabang === c && inPer(r.tanggal, k)));
    out.push([!noPc.length, noPc.length ? "Petty cash belum masuk: " + noPc.map(shortCab).join(", ") : "Petty cash semua cabang sudah masuk", "acc/jurnal/input",
      noPc.map(c => shortCab(c) + ": belum ada transaksi petty cash di " + perName(k))]);
    const zMiss = cabs.map(c => { const have = new Set(S.sales.filter(s => s.cabang === c && s.sumber !== "Manual" && inPer(s.tanggal, k)).map(s => s.tanggal)); return [c, ds.filter(d => !have.has(d))]; }).filter(x => x[1].length);
    out.push([!zMiss.length, zMiss.length ? "Laporan Zenwel kurang: " + zMiss.map(([c, m]) => shortCab(c) + " " + m.length + " hari").join(", ") : "Laporan Zenwel lengkap " + ds.length + " hari", "acc/omzet/input",
      zMiss.map(([c, m]) => shortCab(c) + " belum upload tanggal " + listCap(m.map(fmtD)))]);
    const noOp = cabs.filter(c => !kartu(c, k).closeDoc);
    out.push([!noOp.length, noOp.length ? "Stock opname belum ada: " + noOp.map(shortCab).join(", ") : "Stock opname semua cabang sudah ada", "inv/stok/input",
      noOp.map(c => shortCab(c) + ": stock opname akhir periode belum diinput")]);
    const P = S.prDocs[k], rows = P?.rows || [];
    const prDet = !P ? ["Lembar payroll " + perName(k) + " belum dibuat"] : P.status === "final" ? [] : [
      ...(rows.filter(r => !(r.pokok > 0)).length ? ["Gaji pokok masih kosong: " + listCap(rows.filter(r => !(r.pokok > 0)).map(r => r.nama || "(tanpa nama)"))] : []),
      ...(rows.filter(r => !r.nama).length ? [rows.filter(r => !r.nama).length + " baris tanpa nama"] : []), "Payroll belum ditandai sudah dibayar"];
    out.push([P?.status === "final", !P ? "Payroll belum dibuat" : P.status === "final" ? "Payroll sudah dibayar " + fmtDate(P.tglBayar) : "Payroll masih draft", "hrd:payroll", prDet]);
    const noKpi = rows.filter(r => !S.kpiAll[k + "|" + r.id]), kn = rows.length - noKpi.length;
    out.push([rows.length > 0 && !noKpi.length, rows.length ? `KPI sudah dinilai ${kn} dari ${rows.length} karyawan` : "KPI belum bisa dinilai (payroll kosong)", "hrd:kpi",
      rows.length ? (noKpi.length ? ["Belum dinilai: " + listCap(noKpi.map(r => (r.nama || "–") + " (" + shortCab(r.cabang || "Pusat") + ")"))] : []) : ["Buat payroll dulu supaya KPI bisa dinilai"]]);
    const big = bigList(k).filter(x => !x.cek);
    out.push([!big.length, big.length ? big.length + " pengeluaran besar belum dicek owner" : "Pengeluaran besar sudah dicek", "dash/notif",
      big.slice(0, 15).map(x => fmtD(x.tanggal) + " · " + shortCab(x.unit) + " · " + (x.ket || x.kat) + " · " + rp(x.jumlah)).concat(big.length > 15 ? ["+" + (big.length - 15) + " lainnya"] : [])]);
    const B = bhCfg(), pCabs = cabsOfGrup(B.grup);
    if (pCabs.length) { const co = biayaPer(k).filter(p => pCabs.includes(p.unit) && CO_KAT.includes(p.kategori)), ads = co.filter(p => p.kategori === ADS_KAT).length, fee = co.length - ads;
      out.push([ads > 0 && fee > 0, ads && fee ? "Ads & office fee cabang " + B.grup + " sudah diinput" : "Ads / office fee cabang " + B.grup + " belum lengkap", "acc/jurnal/biaya",
        [...(ads ? [] : ["Belum ada biaya kategori \"Ads / iklan\" untuk " + pCabs.map(shortCab).join(" / ") + " (masuk Company Expenses laporan Wendy)"]), ...(fee ? [] : ["Belum ada biaya kategori \"Office + admin fee\" untuk cabang " + B.grup])]]); }
    if (typeof bankCheck === "function") { const b = bankCheck(k); if (b) out.push(b); }
    return out;
  }
  // ---- laba rugi perusahaan: cabang internal + bagi hasil partner + pusat + gaji owner
  const bhCfg = () => ({ grup: S.hr?.bhGrup ?? "Wendy", pct: S.hr?.bhPct > 0 && S.hr?.bhPct < 100 ? S.hr.bhPct : 50 });
  const ADS_KAT = "Ads / iklan", CO_KAT = ["Ads / iklan", "Office + admin fee"];
  const ownersCfg = () => { const a = (Array.isArray(S.hr?.owners) ? S.hr.owners : []).map(x => String(x || "").trim()).filter(Boolean); return a.length ? a : ["Kevin Maxmillian", "Reyza"]; };
  const rptCfg = () => ({ partnerNama: S.hr?.partnerNama || "Wendy Walters", wlPct: S.hr?.wlPct > 0 && S.hr?.wlPct < 100 ? S.hr.wlPct : 30, wlKata: S.hr?.wlKata || "walters",
    prepBy: S.hr?.prepBy || "Yuli Lim", apprBy: S.hr?.apprBy || "Kevin", kota: S.hr?.kota || "Tangerang" });
  const ownerAmt = (C, n) => C?.gajiOwners && C.gajiOwners[n] != null ? +C.gajiOwners[n] || 0 : 0;
  function waltersOf(k){
    const R = rptCfg(), rx = new RegExp(R.wlKata.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), pCabs = cabsOfGrup(bhCfg().grup), iCabs = cabList().filter(c => !pCabs.includes(c));
    const per = iCabs.map(c => { const its = [];
      S.sales.filter(s => s.cabang === c && inPer(s.tanggal, k)).forEach(s => { if (s.sumber === "Manual") { if (rx.test((s.keterangan || "") + " " + (s.kategori || ""))) its.push({ item: s.keterangan || "Walters Lash (manual)", qty: 1, total: s.total || 0, tanggal: s.tanggal }); return; }
        (s.items || []).forEach(it => { if (rx.test(it.item || "")) its.push({ item: it.item, qty: it.qty || 0, total: it.total || 0, tanggal: s.tanggal }); }); });
      const om = sumOf(its, it => it.total); return { c, om, qty: sumOf(its, it => it.qty), fee: Math.round(om * R.wlPct / 100), its }; });
    return { per, om: sumOf(per, x => x.om), qty: sumOf(per, x => x.qty), total: pCabs.length ? sumOf(per, x => x.fee) : 0, pct: R.wlPct, on: pCabs.length > 0 };
  }
  function companyPL(k){
    const B = bhCfg(), pCabs = cabsOfGrup(B.grup), partner = pCabs.length ? B.grup : null, iCabs = cabList().filter(c => !pCabs.includes(c));
    const I = incomeStmt(iCabs, k), W = partner ? incomeStmt(pCabs, k) : null, PS = pusatStmt(k), WL = waltersOf(k);
    const coAds = W ? W.coB.filter(p => p.kategori === ADS_KAT) : [], coFee = W ? W.coB.filter(p => p.kategori !== ADS_KAT) : [];
    const ads = sumOf(coAds, p => p.jumlah), fee = sumOf(coFee, p => p.jumlah), wl = WL.total;
    const wNet = W ? W.net - ads - fee : 0, partnerPart = wNet * B.pct / 100, share = wNet - partnerPart;
    const oi = (S.salesPst || []).filter(s => inPer(s.tanggal, k)), othInc = sumOf(oi, s => s.total);
    const sebelum = I.net + ads + fee + share + othInc - PS.total - wl;
    const ks = tokKeys(k), gajiOwner = sumOf(ks, mk => S.closing[mk]?.gajiOwner || 0), gajiSet = ks.every(mk => S.closing[mk]?.gajiOwner != null);
    const owners = ownersCfg().map(n => ({ nama: n, v: sumOf(ks, mk => ownerAmt(S.closing[mk], n)) })), rest = gajiOwner - sumOf(owners, o => o.v);
    if (Math.round(rest)) owners.push({ nama: "Owner (lainnya)", v: rest });
    return { I, W, PS, WL, partner, pct: B.pct, coAds, coFee, ads, fee, wl, wNet, partnerPart, share, oi, othInc, sebelum, owners, gajiOwner, gajiSet, bersih: sebelum - gajiOwner, iCabs, pCabs };
  }
  const stageOf = k => { const C = S.closing[k]; if (!C || C.status === "open" && !C.prefinalAt) return 0; if (C.status === "closed") return 3; if (C.status === "prefinal" || C.prefinalAt) return C.gajiOwner != null ? 2 : 1; return 0; };
  const canReopen = () => !S.appUser || ["owner","head"].includes(myRole());
  S.tbGajiSig = "";
  function renderTutup(){
    if (S.tab !== "tutup") return; if (!adminGate("tbBody", "tbRO")) return;
    const k = S.rk, mk = S.month, C = S.closing[mk], closed = isClosed(mk), st = stageOf(mk), rev = (C?.revisi || []).length;
    $("tbTitle").textContent = S.span === 1 ? perName(mk) + " · " + perRange(mk) : mName(S.rk) + " · " + perRange(S.rk);
    const stLabel = ["Belum pre-final", "Pre-final · tunggu gaji owner", "Pre-final · siap final", "Final · sudah tutup buku"];
    const stTxt = s => stLabel[s] + (s < 3 && rev ? " · revisi ke-" + rev : s === 3 && C?.revisiKe ? " · revisi ke-" + C.revisiKe : "");
    $("tbStatus").className = "pill " + (S.span === 1 ? (closed ? "ok" : st ? "warn" : "no") : (tokKeys(S.rk).every(isClosed) ? "ok" : "warn"));
    $("tbStatus").textContent = S.span === 1 ? stTxt(st) : tokKeys(S.rk).filter(isClosed).length + "/" + tokKeys(S.rk).length + " bulan ditutup";
    $("tbNote").textContent = S.span === 1 ? (closed ? `Ditutup oleh ${C.closedBy || "admin"} ${fmtDate(String(C.closedAt).slice(0, 10))}${C.ket ? " · " + C.ket : ""}. Data periode ini terkunci.` : rev ? `Sedang direvisi (revisi ke-${rev}): ${C.revisi[rev - 1].alasan}. Perbaiki datanya, hitung ulang pre-final, lalu tutup buku final lagi.` : "Cek daftar di bawah. Alurnya: hitung pre-final → Head of admin input gaji owner → tutup buku final.") : "Ringkasan " + mName(S.rk) + ". Tutup buku dilakukan per bulan: pilih Bulanan di atas.";
    const cl = checklist(mk);
    $("tbCheck").innerHTML = S.span === 1 ? cl.map(([ok, t, go]) => `<div class="alert"><span class="pill ${ok ? "ok" : "warn"}">${ok ? "Beres" : "Cek"}</span><div style="flex:1;min-width:0">${esc(t)}</div><button class="btn ghost" type="button" data-goto="${go}">Buka</button></div>`).join("") : "";
    $("tbSpanPanel").hidden = S.span === 1;
    if (S.span > 1) { $("tbSpanTitle").textContent = "Status per bulan · " + mName(S.rk);
      $("tbSpan").innerHTML = `<thead><tr><th>Bulan</th><th>Status</th><th class="r">Laba sebelum gaji owner</th><th class="r">Gaji owner</th><th class="r">Laba bersih</th></tr></thead><tbody>` +
        tokKeys(S.rk).map(m => { const p = companyPL(m), s2 = stageOf(m); return `<tr><td><b>${esc(mName(m))}</b></td><td><span class="pill ${s2 === 3 ? "ok" : s2 ? "warn" : "no"}">${["Terbuka","Pre-final","Pre-final","Final"][s2]}</span></td><td class="r num">${fmtOrDash(p.sebelum)}</td><td class="r num">${fmtOrDash(p.gajiOwner)}</td><td class="r num ${p.bersih < 0 ? "up" : ""}">${fmt(p.bersih)}</td></tr>`; }).join("") + `</tbody>`; }
    // laba rugi ringkas (alur ke Global)
    const P = companyPL(k), I = P.I, line = (l, v, cls = "") => `<tr class="${cls}"><td>${l}</td><td class="r num">${v < 0 ? "(" + fmt(-v) + ")" : fmtOrDash(v)}</td></tr>`;
    $("tbPLHint").textContent = "sama dengan laporan Global · " + perRange(k);
    let h = `<tbody><tr class="day"><td colspan="2">Cabang internal (${esc(P.iCabs.map(shortCab).join(", "))})</td></tr>`;
    P.iCabs.forEach(c => h += line(`<span class="ind">Profit ${esc(shortCab(c))}</span>`, incomeStmt([c], k).net));
    h += line("<b>Total income</b>", I.net, "sub");
    h += `<tr class="day"><td colspan="2">Other income</td></tr>`;
    if (P.partner) h += line(`<span class="ind">Online ads & admin fee (${esc(P.pCabs.map(shortCab).join(" & "))})</span>`, P.ads + P.fee) + line(`<span class="ind">Bagi hasil ${100 - P.pct}% net ${esc(P.partner)} (${fmt(P.wNet)})</span>`, P.share);
    h += line(`<span class="ind">Pendapatan lain kantor pusat</span>`, P.othInc);
    h += `<tr class="day"><td colspan="2">Kantor pusat</td></tr>` + line(`<span class="ind">Company expenses (marketing)</span>`, -P.PS.secT.exp) + line(`<span class="ind">Payroll kantor pusat</span>`, -P.PS.pr) + line(`<span class="ind">Head office</span>`, -P.PS.secT.ho) + line(`<span class="ind">Rent & mortgage</span>`, -P.PS.secT.rent) + line(`<span class="ind">Other expenses</span>`, -P.PS.secT.oth);
    if (P.partner) h += line(`<span class="ind">Komisi Walters Lash ${P.WL.pct}% ke ${esc(P.partner)}</span>`, -P.wl);
    h += line("<b>Laba sebelum gaji owner</b>", P.sebelum, "sub");
    P.owners.forEach(o => h += line(`<span class="ind">Gaji ${esc(o.nama)}</span>${P.gajiSet ? "" : ' <span class="note">(belum diinput)</span>'}`, -o.v));
    h += `<tr class="total"><td>${P.bersih < 0 ? "Rugi" : "Laba"} bersih</td><td class="r num ${P.bersih < 0 ? "up" : ""}">${P.bersih < 0 ? "(" + fmt(-P.bersih) + ")" : fmt(P.bersih)}</td></tr></tbody>`;
    $("tbPL").innerHTML = h;
    const Q = plOf(k), cr = (label, cs, cls) => { const L = Q.perCab.filter(x => cs.includes(x.c)); const kon = sumOf(L, x => x.kon); return `<tr class="${cls || ""}"><td>${label}</td><td class="r num">${fmtOrDash(sumOf(L, x => x.om))}</td><td class="r num">${fmtOrDash(sumOf(L, x => x.ex))}</td><td class="r num ${kon < 0 ? "up" : ""}"><b>${fmt(kon)}</b></td></tr>`; };
    let ch = `<thead><tr><th>Cabang</th><th class="r">Omzet</th><th class="r">Pengeluaran</th><th class="r">Kontribusi</th></tr></thead><tbody>`;
    grups().forEach(g => { const cs = cabsOfGrup(g); cs.forEach(c => ch += cr(`<b>${esc(shortCab(c))}</b>`, [c])); ch += cr("Subtotal " + esc(g), cs, "sub"); });
    ch += `<tr><td>Kantor Pusat</td><td class="r num">${fmtOrDash(P.othInc)}</td><td class="r num">${fmtOrDash(Q.pstEx)}</td><td class="r num up"><b>${fmt(P.othInc - Q.pstEx)}</b></td></tr></tbody>`;
    $("tbCab").innerHTML = ch;
    // alur pre-final → gaji owner → final
    $("tbAct").hidden = S.span !== 1;
    $("tbActTitle").textContent = "Tutup buku " + perName(mk); $("tbStage").className = "pill " + (st === 3 ? "ok" : st ? "warn" : "no"); $("tbStage").textContent = stTxt(st);
    document.querySelectorAll("#tbSteps li").forEach(li => { const n = +li.dataset.st; li.className = n <= st ? "done" : n === st + 1 ? "now" : ""; });
    const cur = companyPL(mk), pre = C?.pre, drift = pre && st >= 1 && st < 3 && Math.round(pre.sebelum) !== Math.round(cur.sebelum);
    $("tbPreBox").innerHTML = st === 0 ? `<p class="note" style="margin:0">Klik <b>Hitung pre-final</b> untuk menghitung semua tutup buku sebelum gaji owner. Hasilnya bisa dilihat di preview laporan.</p><div class="tb-sum"><div><small>Laba sebelum gaji owner (sementara)</small><b class="num">${rp(cur.sebelum)}</b></div></div>`
      : `<div class="tb-sum"><div><small>Laba sebelum gaji owner</small><b class="num">${rp(pre?.sebelum ?? cur.sebelum)}</b><span>pre-final ${esc(fmtDate(String(C.prefinalAt || "").slice(0, 10)))} oleh ${esc(C.prefinalBy || "–")}</span></div>
          <div><small>Gaji owner</small><b class="num">${C.gajiOwner != null ? rp(C.gajiOwner) : "–"}</b><span>${C.gajiOwner != null ? esc(ownersCfg().map(n => n.split(" ")[0] + " " + rpShort(ownerAmt(C, n))).join(" · ")) : "belum diinput"}</span></div>
          <div><small>Laba bersih</small><b class="num ${cur.bersih < 0 ? "up" : ""}">${C.gajiOwner != null ? rp((pre?.sebelum ?? cur.sebelum) - C.gajiOwner) : "–"}</b><span>${st === 3 ? "final" : "setelah gaji owner"}</span></div></div>
         ${drift ? `<p class="warn-t" style="margin:8px 0 0">Angka berubah sejak pre-final (${rp(pre.sebelum)} → ${rp(cur.sebelum)}). Klik Hitung ulang pre-final.</p>` : ""}`;
    $("tbPrev").hidden = false;
    $("tbGajiRow").hidden = st === 0 || st === 3;
    const sig = mk + "|" + ownersCfg().join(",") + "|" + st + "|" + JSON.stringify(C?.gajiOwners || {}) + (C?.gajiOwner ?? "");
    if (sig !== S.tbGajiSig && !$("tbGajiList").contains(document.activeElement)) { S.tbGajiSig = sig;
      $("tbGajiList").innerHTML = ownersCfg().map((n, i) => `<div class="field"><label for="tbOw${i}">Gaji ${esc(n)}</label><div class="rp"><span>Rp</span><input type="text" id="tbOw${i}" data-own="${esc(n)}" inputmode="numeric" placeholder="0" value="${C?.gajiOwners?.[n] != null ? fmt(C.gajiOwners[n]) : C?.gajiOwner != null && i === 0 && !C?.gajiOwners ? fmt(C.gajiOwner) : ""}"></div></div>`).join("") +
        `<div class="field"><label>Total gaji owner</label><div class="tb-tot num" id="tbOwTot">–</div></div>`; tbOwTot(); }
    $("tbPre").hidden = st === 3; $("tbPre").textContent = st === 0 ? "Hitung pre-final" : "Hitung ulang pre-final";
    $("tbGajiSave").hidden = st === 0 || st === 3; $("tbClose").hidden = st !== 2; $("tbOpen").hidden = st !== 3 || !canReopen(); $("tbRevRow").hidden = st !== 3 || !canReopen();
    const bad = cl.filter(x => !x[0]); if ($("tbClose").dataset.armed !== "1") $("tbClose").textContent = bad.length ? `Tutup buku final (${bad.length} hal belum beres)` : "Tutup buku final";
    // detail yang belum beres (muncul di langkah final)
    $("tbTodo").hidden = st === 0 || st === 3;
    $("tbTodo").innerHTML = bad.length || (st >= 1 && C?.gajiOwner == null) ? `<div class="sec-h" style="margin:4px 0 6px"><h3>Yang belum beres sebelum final</h3><span class="hint">${bad.length + (C?.gajiOwner == null ? 1 : 0)} hal</span></div>` +
      (C?.gajiOwner == null ? `<div class="todo"><div class="todo-h"><span class="pill no">Wajib</span><b>Gaji owner belum diinput</b></div><ul><li>Isi ${esc(ownersCfg().map(n => "gaji " + n).join(" dan "))} di atas, lalu klik Simpan gaji owner.</li></ul></div>` : "") +
      bad.map(([, t, go, det]) => `<div class="todo"><div class="todo-h"><span class="pill warn">Cek</span><b>${esc(t)}</b><button class="btn ghost" type="button" data-goto="${go}">Buka</button></div>${det?.length ? `<ul>${det.map(d => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}</div>`).join("") +
      (bad.length ? `<p class="note" style="margin:8px 0 0">Tetap bisa tutup buku final walau masih ada yang "Cek", tapi sebaiknya dibereskan dulu supaya angka laporan lengkap.</p>` : "")
      : `<div class="ok-box"><span class="ok-ic">✓</span><div><b>Semua sudah beres.</b> Siap tutup buku final.</div></div>`;
    // riwayat revisi
    const R = C?.revisi || [];
    $("tbHist").hidden = !R.length;
    $("tbHist").innerHTML = R.length ? `<div class="sec-h" style="margin:14px 0 6px"><h3>Riwayat revisi</h3><span class="hint">${R.length}×</span></div><div class="scroll"><table><thead><tr><th>Revisi</th><th>Dibuka</th><th>Alasan</th><th class="r">Laba bersih sebelum revisi</th><th class="r">Sesudah</th></tr></thead><tbody>` +
      R.map((r, i) => { const after = i < R.length - 1 ? R[i + 1].before?.labaBersih : st === 3 ? C.ringkasan?.labaBersih : null;
        return `<tr><td><b>Ke-${r.no}</b></td><td>${esc(fmtDate(String(r.at).slice(0, 10)))}<small>${esc(r.by || "")}</small></td><td class="k">${esc(r.alasan || "")}</td><td class="r num">${r.before?.labaBersih != null ? fmt(r.before.labaBersih) : "–"}</td><td class="r num">${after != null ? fmt(after) : "<span class=note>belum final</span>"}</td></tr>`; }).join("") + `</tbody></table></div>` : "";
  }
  function tbOwTot(){ const el = $("tbOwTot"); if (!el) return; const v = [...document.querySelectorAll("#tbGajiList [data-own]")].reduce((s, i) => s + parseRp(i.value), 0); el.textContent = rp(v); }
  const actorName = () => S.appUser?.nama || ls.get("rpc-pengisi") || "admin";
  const plSnap = mk => { const p = companyPL(mk); return { pendapatanInternal: p.I.sales, labaCabangInternal: p.I.net, netPartner: p.wNet, bagiHasil: p.share, adsPartner: p.ads, feePartner: p.fee, walters: p.wl, pendapatanPusat: p.othInc, bebanPusat: p.PS.total, sebelum: p.sebelum }; };
  $("tbPre").addEventListener("click", async () => { const mk = S.month; if (isClosed(mk)) return; $("tbMsg").textContent = "Menghitung…";
    try { const C = S.closing[mk], doc = { periode: mk, status: "prefinal", prefinalAt: new Date().toISOString(), prefinalBy: actorName(), pre: plSnap(mk), by: S.uid || null };
      if (C) await S.db.doc("closing/" + mk).update(doc); else await S.db.doc("closing/" + mk).set(doc); $("tbMsg").textContent = ""; toast("Pre-final " + perName(mk) + " tersimpan"); }
    catch (err) { $("tbMsg").textContent = err?.code === "invalid_argument" ? "Tutup buku hanya untuk role admin." : "Gagal menyimpan, coba lagi."; } });
  $("tbGajiList").addEventListener("input", e => { const i = e.target.closest("[data-own]"); if (!i) return; const n = parseRp(i.value); i.value = n ? fmt(n) : ""; tbOwTot(); });
  $("tbGajiSave").addEventListener("click", async () => { const mk = S.month, ins = [...document.querySelectorAll("#tbGajiList [data-own]")];
    if (ins.some(i => !i.value.trim())) { $("tbMsg").textContent = "Isi semua gaji owner (isi 0 kalau tidak ada)."; ins.find(i => !i.value.trim())?.focus(); return; }
    const go = {}; ins.forEach(i => go[i.dataset.own] = parseRp(i.value)); const v = Object.values(go).reduce((a, b) => a + b, 0);
    try { await S.db.doc("closing/" + mk).update({ gajiOwners: go, gajiOwner: v, gajiOwnerBy: actorName(), gajiOwnerAt: new Date().toISOString(), ket: $("tbKet").value.trim() || S.closing[mk]?.ket || "" }); $("tbMsg").textContent = ""; toast("Gaji owner " + rp(v) + " tersimpan"); }
    catch { $("tbMsg").textContent = "Gagal menyimpan gaji owner."; } });
  $("tbClose").addEventListener("click", async e => { const b = e.currentTarget, mk = S.month, C = S.closing[mk]; if (!C || C.gajiOwner == null) return;
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Yakin? Klik sekali lagi"; setTimeout(() => { b.dataset.armed = ""; renderTutup(); }, 4000); return; }
    b.dataset.armed = ""; b.disabled = true; $("tbMsg").textContent = "Menyimpan…";
    const P = plOf(mk), snap = plSnap(mk);
    try { await S.db.doc("closing/" + mk).update({ status: "closed", closedAt: new Date().toISOString(), closedBy: actorName(), ket: $("tbKet").value.trim() || C.ket || "", revisiKe: (C.revisi || []).length,
        ringkasan: { ...snap, gajiOwner: C.gajiOwner, gajiOwners: C.gajiOwners || null, labaBersih: snap.sebelum - C.gajiOwner, pemasukan: P.masuk, pengeluaran: P.keluar, perCabang: P.perCab, checklist: checklist(mk).map(([ok, t]) => ({ ok, t })) } });
      $("tbMsg").textContent = ""; toast(perName(mk) + " sudah tutup buku final"); }
    catch (err) { $("tbMsg").textContent = err?.code === "invalid_argument" ? "Tutup buku hanya untuk role admin." : "Gagal menyimpan, coba lagi."; }
    finally { b.disabled = false; } });
  $("tbOpen").addEventListener("click", async e => { const b = e.currentTarget, mk = S.month, C = S.closing[mk]; if (!C || !canReopen()) return;
    const al = $("tbAlasan").value.trim(); if (al.length < 5) { $("tbMsg").textContent = "Tulis alasan revisi dulu (contoh: omzet Pluit tgl 12 salah input)."; $("tbAlasan").focus(); return; }
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Yakin buka untuk revisi?"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Buka untuk revisi"; }, 4000); return; }
    b.dataset.armed = ""; b.textContent = "Buka untuk revisi";
    const R = C.revisi || [], at = new Date().toISOString();
    try { await S.db.doc("closing/" + mk).update({ status: "prefinal", openedAt: at, openedBy: actorName(),
        revisi: [...R, { no: R.length + 1, at, by: actorName(), alasan: al, before: { sebelum: C.ringkasan?.sebelum ?? null, gajiOwner: C.gajiOwner ?? null, labaBersih: C.ringkasan?.labaBersih ?? null, closedAt: C.closedAt || null, closedBy: C.closedBy || null } }] });
      $("tbAlasan").value = ""; $("tbMsg").textContent = ""; toast(perName(mk) + " dibuka untuk revisi ke-" + (R.length + 1)); }
    catch { $("tbMsg").textContent = "Gagal membuka kembali."; } });
  document.addEventListener("click", e => { const b = e.target.closest("#tbPrev [data-nav]"); if (b) { go(b.dataset.nav); window.scrollTo({ top: 0 }); } });
  $("tbCsv").addEventListener("click", async () => { const k = S.rk, G = globalModel(k);
    const q = v => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; const L = [], add = (...r) => L.push(r.map(q).join(","));
    add("Lash Bounty Global"); add("Income Statement " + perName(k), perRange(k)); add("");
    G.secs.forEach(sc => { add(sc.t); sc.rows.forEach(r => add(r.l, Math.round(r.v), r.note || "")); add(sc.tot, Math.round(sc.T)); add(""); });
    add("Total Company Expenses", Math.round(G.exp)); add("Total Company Net Income", Math.round(G.net));
    try { await S.dl.save({ filename: "Tutup Buku Global " + perName(k) + ".csv", data: "﻿" + L.join("\n") }); toast("File disimpan"); } catch (err) { if (err?.code !== "declined") toast("Download gagal"); } });

  // ---- halaman biaya cabang di luar petty cash
  function renderBiaya(){
    if (S.leaf !== "acc/jurnal/biaya") return; if (!adminGate("bcBody", "bcRO")) return;
    const k = S.rk, B = biayaPer(k).filter(p => p.unit !== "Pusat"), cabs = cabList();
    { const keep = $("bcFilter").value; $("bcFilter").innerHTML = `<option value="">Semua cabang</option>` + optList(cabs, keep); }
    const tot = sumOf(B, p => p.jumlah), grpT = g => sumOf(B.filter(p => katGrp(p.kategori) === g), p => p.jumlah);
    $("bcKpis").innerHTML = [["Total biaya cabang", rpShort(tot), perRange(k)], ["Stok bahan (HPP)", rpShort(grpT("hpp")), "masuk COGS"], ["Bulanan & sewa", rpShort(grpT("bulanan") + grpT("sewa")), "IPL, listrik, PAM, internet, sewa"], ["Lain-lain", rpShort(grpT("lain")), "termasuk ads, refund, EDC, perbaikan"]]
      .map(([l, v, s2]) => `<div class="kpi"><span class="l">${l}</span><span class="v num">${v}</span><span class="s">${s2}</span></div>`).join("");
    $("bcSumHint").textContent = perName(k);
    const kats = CAB_KAT_ALL.filter(c => CAB_KAT.includes(c) || B.some(p => p.kategori === c));
    $("bcSum").innerHTML = `<thead><tr><th>Kategori</th>${cabs.map(c => `<th class="r">${esc(shortCab(c))}</th>`).join("")}<th class="r">Total</th></tr></thead><tbody>` +
      kats.map(c => `<tr><td>${esc(c)}</td>${cabs.map(cb => `<td class="r num">${fmtOrDash(sumOf(B.filter(p => p.kategori === c && p.unit === cb), p => p.jumlah))}</td>`).join("")}<td class="r num"><b>${fmtOrDash(sumOf(B.filter(p => p.kategori === c), p => p.jumlah))}</b></td></tr>`).join("") +
      `<tr class="total"><td>Total</td>${cabs.map(cb => `<td class="r num">${fmtOrDash(sumOf(B.filter(p => p.unit === cb), p => p.jumlah))}</td>`).join("")}<td class="r num">${fmt(tot)}</td></tr></tbody>`;
    const fv = $("bcFilter").value, L = B.filter(p => !fv || p.unit === fv).sort((a, b) => (a.tanggal || "").localeCompare(b.tanggal || ""));
    $("bcListTitle").textContent = (fv ? shortCab(fv) : "Semua cabang") + " · " + perName(k);
    $("bcList").innerHTML = (S.db && !S.psLoaded) ? `<tr><td class="empty">Memuat…</td></tr>` : L.length ? `<thead><tr><th>Tanggal</th><th>Cabang</th><th>Kategori</th><th>Keterangan</th><th>Dibayar dari</th><th>No. bukti</th><th class="r">Jumlah (Rp)</th><th></th></tr></thead><tbody>` +
      L.map(p => `<tr><td class="num">${esc(fmtDate(p.tanggal))}</td><td>${esc(shortCab(p.unit))}</td><td><span class="kat">${esc(p.kategori)}</span></td><td class="k">${esc(p.keterangan || "")}${p.pengisi ? `<small>Diisi oleh ${esc(p.pengisi)}</small>` : ""} ${p.contoh ? `<span class="tag contoh">contoh</span>` : ""}</td><td>${esc(p.dana || "–")}</td><td class="num">${esc(p.nota || "–")}</td><td class="r num">${fmt(p.jumlah)}</td><td class="r"><button class="btn ghost danger" data-delps="${esc(p.id)}">Hapus</button></td></tr>`).join("") +
      `<tr class="total"><td colspan="6">Total · ${L.length} catatan</td><td class="r num">${fmt(sumOf(L, p => p.jumlah))}</td><td></td></tr></tbody>`
      : `<tr><td class="empty">Belum ada biaya cabang di luar petty cash di ${perName(k)}.</td></tr>`;
  }
  $("bcFilter").addEventListener("change", renderBiaya);


  /* ---------- akun login: username & password ---------- */
  S.roles = null; S.me = null; S.isOwner = false; S.rlEdit = null;
  S.users = []; S.usersLoaded = false; S.appUser = null; S.pwreq = []; S.lgMode = "login"; S.lgFail = 0; S.lgUntil = 0; S.usEdit = null;
  const ss = { get(k){ try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v){ try { sessionStorage.setItem(k, v); } catch {} }, del(k){ try { sessionStorage.removeItem(k); } catch {} } };
  const lsDel = k => { try { localStorage.removeItem(k); } catch {} };
  const roleLabel = r => ROLES_DEF[r] || r || "–";
  const myCab = () => (["manager","staff"].includes(myRole()) ? S.appUser?.cabang || "" : "");
  const canManageUsers = () => ["owner","head"].includes(myRole());
  const isAppOwner = () => myRole() === "owner";
  const enc = new TextEncoder(), hexOf = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  const newSalt = () => hexOf(crypto.getRandomValues(new Uint8Array(16)));
  async function pwHash(pw, salt, iter = 150000){
    const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
    return hexOf(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: iter }, key, 256)); }
  const normU = u => String(u || "").replace(/\s+/g, "").toLowerCase();
  const validU = u => /^[a-z0-9._-]{3,30}$/.test(u);
  const userOf = u => S.users.find(x => x.id === normU(u)) || null;
  const pwErr = p => p.length < 8 ? "Password minimal 8 karakter." : !/[a-zA-Z]/.test(p) || !/\d/.test(p) ? "Password harus ada huruf dan angka." : "";
  const genPw = () => { const a = "abcdefghjkmnpqrstuvwxyz", d = "23456789", r = n => crypto.getRandomValues(new Uint32Array(n)); const x = r(10);
    return [...x].map((v, i) => i < 6 ? a[v % a.length] : d[v % d.length]).join("").replace(/^./, c => c.toUpperCase()); };
  function authNeeded(){ if (!S.booted || !S.db) return false; if (document.body.classList.contains("staff") && S.tab === "absen") return false; return !S.appUser; }
  function saveSession(u, remember){ const v = JSON.stringify({ u: u.id, h: String(u.hash).slice(0, 16) }); ss.set("lb-user", v); if (remember) ls.set("lb-user", v); else lsDel("lb-user"); }
  function clearSession(){ ss.del("lb-user"); lsDel("lb-user"); S.appUser = null; if (SA.user) SA.logout().finally(() => location.reload()); }
  function restoreSession(){
    if (!S.usersLoaded) return;
    const fresh = SA.user && (userOf(SA.user.id) || SA.user);
    S.appUser = fresh && fresh.aktif !== false ? { ...SA.user, ...fresh, id: SA.user.id } : null;
  }
  function loginLog(aksi, u){ if (!RAWDB) return; RAWDB.collection("log").add({ at: new Date().toISOString(), by: S.uid || null, nama: u?.nama || u?.id || "", aksi, path: "users/" + (u?.id || ""), coll: "login", hal: S.leaf || "", ringkas: aksi + " · " + (u?.id || ""), before: null, after: null }).catch(() => {}); }
  function setLgMode(m){ S.lgMode = m; ["lgForm","fgForm","suForm"].forEach(id => $(id).hidden = true); $({ login:"lgForm", forgot:"fgForm", setup:"suForm" }[m]).hidden = false; $("lgMsg").textContent = "";
    $("lgSub").textContent = { login:"Masuk dengan akun kamu", forgot:"Lupa password", setup:"Buat akun owner pertama" }[m]; }
  function renderLogin(){
    const show = authNeeded(); $("login").hidden = !show; document.body.classList.toggle("locked", show); renderUserChip();
    if (!show) return;
    $("lgLoad").hidden = S.usersLoaded; if (!S.usersLoaded) { ["lgForm","fgForm","suForm"].forEach(id => $(id).hidden = true); return; }
    if (SA.bootstrap) { if (S.admin || S.isOwner) { if (S.lgMode !== "setup") setLgMode("setup"); } else { ["lgForm","fgForm","suForm"].forEach(id => $(id).hidden = true); $("lgLoad").hidden = false; $("lgLoad").textContent = "Belum ada akun. Minta owner membuat akun untuk kamu."; } return; }
    if (S.lgMode === "setup") setLgMode("login");
    if (!$("lgForm").hidden || !$("fgForm").hidden) {} else setLgMode(S.lgMode);
    $("fgOwner").hidden = true;
  }
  $("lgForm").addEventListener("submit", async e => { e.preventDefault();
    if (Date.now() < S.lgUntil) { $("lgMsg").textContent = "Terlalu banyak percobaan. Tunggu " + Math.ceil((S.lgUntil - Date.now()) / 1000) + " detik."; return; }
    const pw = $("lgPass").value;
    if (!$("lgUser").value.trim() || !pw) { $("lgMsg").textContent = "Isi username dan password."; return; }
    $("lgGo").disabled = true; $("lgMsg").textContent = "Memeriksa…";
    let r = null; try { r = await SA.login(normU($("lgUser").value), pw, $("lgRemember").checked); }
    catch (err) { $("lgGo").disabled = false; if (err?.code === "locked") S.lgUntil = Date.now() + (err.wait || 60) * 1000;
      $("lgMsg").textContent = err?.code === "unavailable" ? "Server tidak bisa dihubungi. Cek koneksi lalu coba lagi." : err?.message || "Username atau password salah."; $("lgPass").value = ""; $("lgPass").focus(); return; }
    $("lgPass").value = ""; $("lgMsg").textContent = "Berhasil masuk…"; ls.set("rpc-pengisi", r.user.nama || "");
    location.reload(); return; go(document.body.classList.contains("staff") ? (S.leaf || "acc/jurnal/input") : (S.tabFromUser ? S.leaf : (perm("dash") ? "dash/ringkasan" : "acc/jurnal/input")));
  });
  $("lgToForgot").addEventListener("click", () => { $("fgUser").value = $("lgUser").value; setLgMode("forgot"); });
  $("fgBack").addEventListener("click", () => setLgMode("login"));
  $("fgForm").addEventListener("submit", async e => { e.preventDefault();
    const un = normU($("fgUser").value), p1 = $("fgPass").value, p2 = $("fgPass2").value, u = { nama: un };
    if (!validU(un)) { $("lgMsg").textContent = "Isi username yang benar."; return; }
    const er = pwErr(p1); if (er) { $("lgMsg").textContent = er; return; } if (p1 !== p2) { $("lgMsg").textContent = "Ulangi password belum sama."; return; }
    $("fgGo").disabled = true; $("lgMsg").textContent = "Mengirim…";
    try { const salt = newSalt(); await RAWDB.doc("pwreq/" + S.uid).set({ username: un, nama: u.nama, salt, hash: await pwHash(p1, salt), iter: 150000, at: new Date().toISOString(), status: "pending" });
      $("lgMsg").textContent = "Permintaan terkirim. Password baru aktif setelah disetujui owner."; ["fgPass","fgPass2"].forEach(id => $(id).value = ""); }
    catch (err) { $("lgMsg").textContent = err?.message === "Username tidak ditemukan." ? "Username tidak ditemukan atau akun nonaktif." : "Gagal mengirim permintaan. Coba lagi."; }
    finally { $("fgGo").disabled = false; } });
  $("fgOwner").addEventListener("click", async () => {
    const un = normU($("fgUser").value), p1 = $("fgPass").value, p2 = $("fgPass2").value, u = userOf(un);
    if (!S.isOwner) return; if (!u) { $("lgMsg").textContent = "Username tidak ditemukan."; return; }
    if (u.role !== "owner") { $("lgMsg").textContent = "Reset langsung hanya untuk akun Owner. Akun lain lewat permintaan."; return; }
    const er = pwErr(p1); if (er) { $("lgMsg").textContent = er; return; } if (p1 !== p2) { $("lgMsg").textContent = "Ulangi password belum sama."; return; }
    try { const salt = newSalt(); await S.db.doc("users/" + un).update({ salt, hash: await pwHash(p1, salt), iter: 150000, pwAt: new Date().toISOString() });
      $("lgMsg").textContent = "Password owner diganti. Silakan masuk."; setLgMode("login"); $("lgUser").value = un; }
    catch { $("lgMsg").textContent = "Gagal mengganti password."; } });
  $("suForm").addEventListener("submit", async e => { e.preventDefault();
    const nama = $("suNama").value.trim(), un = normU($("suUser").value), p1 = $("suPass").value, p2 = $("suPass2").value;
    if (!nama) { $("lgMsg").textContent = "Isi nama."; return; } if (!validU(un)) { $("lgMsg").textContent = "Username 3–30 karakter: huruf kecil, angka, titik, minus."; return; }
    const er = pwErr(p1); if (er) { $("lgMsg").textContent = er; return; } if (p1 !== p2) { $("lgMsg").textContent = "Ulangi password belum sama."; return; }
    if (!SA.bootstrap) { $("lgMsg").textContent = "Akun sudah ada. Silakan login."; setLgMode("login"); return; }
    $("suGo").disabled = true;
    try { const salt = newSalt(), doc = { username: un, nama, role: "owner", cabang: "", aktif: true, salt, hash: await pwHash(p1, salt), iter: 150000, createdBy: nama, createdAt: new Date().toISOString() };
      await S.db.doc("users/" + un).set(doc); toast("Akun owner dibuat"); await SA.login(un, p1, true); location.reload(); }
    catch (err) { $("lgMsg").textContent = err?.code === "invalid_argument" ? "Gagal membuat akun owner pertama." : "Gagal membuat akun."; }
    finally { $("suGo").disabled = false; } });
  function renderUserChip(){
    const on = !!(S.appUser && !document.body.classList.contains("staff")); $("userChip").hidden = !on;
    $("staffUser").hidden = !(S.appUser && document.body.classList.contains("staff"));
    if (S.appUser) $("staffUser").textContent = S.appUser.nama + " · keluar";
    if (!on) return;
    $("ucAva").hidden = true; $("ucName").textContent = S.appUser.nama; $("ucRole").textContent = roleLabel(myRole()) + (myCab() ? " · " + shortCab(myCab()) : "");
  }
  function logout(){ loginLog("logout", S.appUser); clearSession(); setLgMode("login"); renderLogin(); }
  $("userChip").addEventListener("click", e => { const b = e.currentTarget;
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; $("ucRole").textContent = "Klik lagi untuk keluar"; setTimeout(() => { b.dataset.armed = ""; renderUserChip(); }, 3000); return; }
    b.dataset.armed = ""; logout(); });
  $("staffUser").addEventListener("click", logout);
  // ---- kelola akun (Owner & Head of admin)
  function renderUsers(){
    if (S.leaf !== "set/role") return;
    const can = canManageUsers() && S.admin, list = [...S.users].sort((a, b) => Object.keys(ROLES_DEF).indexOf(a.role) - Object.keys(ROLES_DEF).indexOf(b.role) || (a.nama || "").localeCompare(b.nama || ""));
    $("usHint").textContent = list.filter(u => u.aktif !== false).length + " aktif · " + list.length + " akun";
    $("usNote").textContent = can ? "Hanya Owner dan Head of admin yang bisa membuat atau mengubah akun. Lupa password hanya bisa disetujui Owner." : "Kamu bisa melihat daftar akun. Membuat dan mengubah akun hanya Owner dan Head of admin (di perangkat dengan akses Editor).";
    $("usTable").innerHTML = list.length ? `<thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Cabang</th><th>Status</th><th>Password diganti</th>${can ? "<th></th>" : ""}</tr></thead><tbody>` +
      list.map(u => `<tr class="${u.aktif === false ? "nodata" : ""}"><td><b>${esc(u.nama)}</b>${u.id === S.appUser?.id ? ` <span class="tag contoh">kamu</span>` : ""}</td><td class="num">${esc(u.id)}</td><td>${esc(roleLabel(u.role))}</td><td>${esc(u.cabang ? shortCab(u.cabang) : "Semua")}</td>
        <td><span class="pill ${u.aktif === false ? "no" : "ok"}">${u.aktif === false ? "Nonaktif" : "Aktif"}</span></td><td class="num">${esc(fmtDate(String(u.pwAt || u.createdAt || "").slice(0, 10)) || "–")}</td>
        ${can ? `<td class="r" style="white-space:nowrap"><button class="btn ghost" type="button" data-use="${esc(u.id)}">Edit</button>${u.id !== S.appUser?.id && !(u.role === "owner" && !isAppOwner()) ? `<button class="btn ghost ${u.aktif === false ? "" : "danger"}" type="button" data-usa="${esc(u.id)}">${u.aktif === false ? "Aktifkan" : "Nonaktifkan"}</button>` : ""}</td>` : ""}</tr>`).join("") + `</tbody>`
      : `<tr><td class="empty">Belum ada akun.</td></tr>`;
    $("usFormPanel").hidden = !can;
    const roles = Object.entries(ROLES_DEF).filter(([r]) => r !== "owner" || isAppOwner());
    if (!$("usRole").options.length || $("usRole").dataset.k !== roles.map(r => r[0]).join()) { $("usRole").innerHTML = roles.map(([r, l]) => `<option value="${r}">${esc(l)}</option>`).join(""); $("usRole").dataset.k = roles.map(r => r[0]).join(); }
    { const keep = $("usCab").value; $("usCab").innerHTML = `<option value="">Semua cabang / pusat</option>` + optList(cabList(), keep); }
    // permintaan reset
    const pend = S.pwreq.filter(r => r.status === "pending");
    $("prqPanel").hidden = !S.admin; $("prqHint").textContent = pend.length ? pend.length + " menunggu" : "";
    $("prqList").innerHTML = pend.length ? pend.map(r => `<div class="alert"><span class="pill warn">Menunggu</span><div style="flex:1;min-width:0"><b>${esc(r.nama || r.username)}</b><div class="note">username ${esc(r.username)} · ${esc(fmtDate(String(r.at).slice(0, 10)))} ${esc(String(r.at).slice(11, 16))}</div></div>
      ${isAppOwner() ? `<button class="btn primary" type="button" data-prq="${esc(r.id)}|ok">Setujui</button><button class="btn ghost danger" type="button" data-prq="${esc(r.id)}|no">Tolak</button>` : `<span class="note">perlu Owner</span>`}</div>`).join("")
      : `<div class="empty">Tidak ada permintaan.</div>`;
    renderMatrix();
  }
  function usReset(){ S.usEdit = null; ["usNama","usUser","usPass","usEmail","usTg"].forEach(id => $(id).value = ""); $("usUser").disabled = false; $("usFormTitle").textContent = "Buat akun baru"; $("usPassLabel").textContent = "Password awal"; $("usCancel").hidden = true; $("usMsg").textContent = ""; }
  $("usCancel").addEventListener("click", usReset);
  $("usGen").addEventListener("click", () => { $("usPass").value = genPw(); $("usMsg").textContent = "Catat password ini dan berikan ke user."; });
  $("usTable").addEventListener("click", async e => {
    const ed = e.target.closest("[data-use]");
    if (ed) { const u = userOf(ed.dataset.use); if (!u) return; if (u.role === "owner" && !isAppOwner()) { toast("Akun Owner hanya bisa diubah Owner"); return; }
      S.usEdit = u.id; $("usNama").value = u.nama || ""; $("usUser").value = u.id; $("usUser").disabled = true; $("usRole").value = u.role; $("usCab").value = u.cabang || ""; $("usPass").value = ""; $("usEmail").value = u.email || ""; $("usTg").value = u.tgChat || "";
      $("usFormTitle").textContent = "Edit akun · " + u.id; $("usPassLabel").textContent = "Password baru (kosongkan kalau tidak diganti)"; $("usCancel").hidden = false; $("usNama").focus(); return; }
    const ac = e.target.closest("[data-usa]"); if (!ac) return; const u = userOf(ac.dataset.usa); if (!u) return;
    try { await S.db.doc("users/" + u.id).update({ aktif: u.aktif === false }); toast((u.aktif === false ? "Diaktifkan: " : "Dinonaktifkan: ") + u.nama); } catch { toast("Gagal mengubah akun"); }
  });
  $("usForm").addEventListener("submit", async e => { e.preventDefault(); const msg = $("usMsg");
    if (!canManageUsers()) { msg.textContent = "Hanya Owner dan Head of admin yang bisa mengelola akun."; return; }
    const nama = $("usNama").value.trim(), un = S.usEdit || normU($("usUser").value), role = $("usRole").value, cabang = $("usCab").value, pw = $("usPass").value, email = $("usEmail").value.trim(), tgChat = $("usTg").value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "Format email belum benar."; return; }
    if (!nama) { msg.textContent = "Isi nama."; return; } if (!validU(un)) { msg.textContent = "Username 3–30 karakter: huruf kecil, angka, titik, minus."; return; }
    if (!S.usEdit && userOf(un)) { msg.textContent = "Username sudah dipakai."; return; }
    if (role === "owner" && !isAppOwner()) { msg.textContent = "Hanya Owner yang bisa membuat akun Owner."; return; }
    if (!S.usEdit || pw) { const er = pwErr(pw); if (er) { msg.textContent = er; return; } }
    msg.textContent = "Menyimpan…";
    try {
      const doc = { username: un, nama, role, cabang, aktif: true, email, tgChat };
      if (pw) { const salt = newSalt(); Object.assign(doc, { salt, hash: await pwHash(pw, salt), iter: 150000, pwAt: new Date().toISOString() }); }
      if (S.usEdit) await S.db.doc("users/" + un).update(doc); else await S.db.doc("users/" + un).set({ ...doc, createdBy: S.appUser?.nama || "", createdAt: new Date().toISOString() });
      const wasEdit = !!S.usEdit; usReset(); toast((wasEdit ? "Akun diperbarui: " : "Akun dibuat: ") + un);
      if (pw) msg.textContent = `Berikan ke ${nama}: username ${un} · password ${pw}`;
    } catch (err) { msg.textContent = err?.code === "invalid_argument" ? "Akun kamu tidak punya hak untuk menyimpan akun ini." : "Gagal menyimpan, coba lagi."; }
  });
  $("prqList").addEventListener("click", async e => { const b = e.target.closest("[data-prq]"); if (!b || !isAppOwner()) return; const [id, act] = b.dataset.prq.split("|"), r = S.pwreq.find(x => x.id === id); if (!r) return;
    b.disabled = true;
    try { if (act === "ok") { if (!userOf(r.username)) throw new Error("x"); await S.db.doc("users/" + r.username).update({ salt: r.salt, hash: r.hash, iter: r.iter || 150000, pwAt: new Date().toISOString() }); }
      await RAWDB.doc("pwreq/" + id).update({ status: act === "ok" ? "approved" : "rejected", doneBy: S.appUser?.nama || "owner", doneAt: new Date().toISOString() });
      toast(act === "ok" ? "Password " + r.username + " sudah aktif" : "Permintaan ditolak"); }
    catch { toast("Gagal memproses permintaan"); b.disabled = false; } });
  // ---- level akses per role
  function rlWork(){ if (!S.rlEdit || !S.rlDirty) S.rlEdit = { matrix: JSON.parse(JSON.stringify({ ...MATRIX_DEF, ...(S.roles?.matrix || {}) })) };
    Object.keys(ROLES_DEF).forEach(r => S.rlEdit.matrix[r] = { ...MATRIX_DEF[r], ...(S.rlEdit.matrix[r] || {}) }); return S.rlEdit; }
  function renderMatrix(){
    const W = rlWork(), ro = !(canManageUsers() && S.admin), LV = [["0","Tidak"],["1","Lihat"],["2","Edit"]];
    $("rlMatrix").innerHTML = `<thead><tr><th>Menu</th>${Object.values(ROLES_DEF).map(l => `<th class="c">${esc(l)}</th>`).join("")}</tr></thead><tbody>` +
      MODS.map(([m, l]) => `<tr><td><b>${esc(l)}</b></td>${Object.keys(ROLES_DEF).map(r => r === "owner" ? `<td class="c"><span class="pill ok">Edit</span></td>` :
        `<td class="c"><select class="lv lv${W.matrix[r][m] ?? 0}" data-rlm="${r}|${m}" ${ro ? "disabled" : ""} aria-label="${esc(l)} untuk ${esc(ROLES_DEF[r])}">${LV.map(([v, t]) => `<option value="${v}" ${String(W.matrix[r][m] ?? 0) === v ? "selected" : ""}>${t}</option>`).join("")}</select></td>`).join("")}</tr>`).join("") + `</tbody>`;
    ["rlSave","rlReset"].forEach(id => $(id).disabled = ro);
  }
  const renderRole = renderUsers;
  $("rlMatrix").addEventListener("change", e => { const t = e.target; if (!t.dataset.rlm) return; const [r, m] = t.dataset.rlm.split("|"); const W = rlWork(); S.rlDirty = true; W.matrix[r][m] = +t.value; t.className = "lv lv" + t.value; $("rlMsg").textContent = "Belum disimpan."; });
  $("rlReset").addEventListener("click", () => { const W = rlWork(); S.rlDirty = true; W.matrix = JSON.parse(JSON.stringify(MATRIX_DEF)); renderMatrix(); $("rlMsg").textContent = "Level akses kembali ke default. Klik Simpan."; });
  $("rlSave").addEventListener("click", async () => { const W = rlWork(); $("rlMsg").textContent = "Menyimpan…";
    try { await S.db.doc("settings/roles").set({ matrix: W.matrix }); S.rlDirty = false; $("rlMsg").textContent = ""; toast("Level akses tersimpan"); }
    catch (err) { $("rlMsg").textContent = err?.code === "invalid_argument" ? "Hanya Owner / Head of admin yang bisa menyimpan." : "Gagal menyimpan, coba lagi."; } });

  /* ---------- riwayat perubahan (audit) ---------- */
  let RAWDB = null;
  const AUD_SKIP = ["log", "logadm", "akun", "pwreq", "askboss"], AUD_ADM = ["pusat","payroll","kpi","aset","closing","settings","users","bankcfg","mutasi","bankflag","bayar","kas","cust","custtx","refund","kasbon","pemusnahan","tabungan","pengumuman","aiimport"];
  const COLL_LABEL = { expenses:"Petty cash", pusat:"Biaya cabang/pusat", sales:"Omzet", opname:"Stok", payroll:"Payroll", kpi:"KPI", absen:"Absensi", aset:"Aset", closing:"Tutup buku", settings:"Pengaturan", users:"Akun login", login:"Login", refund:"Refund", kasbon:"Kasbon", permintaan:"Permintaan barang", pemusnahan:"Pemusnahan aset", tabungan:"Tabungan sewa", pengumuman:"Pengumuman" };
  function localOf(path){ const [c, id] = path.split("/"), f = a => (a || []).find(x => x.id === id) || null;
    if (c === "expenses") return f(S.rows); if (c === "pusat") return f(S.ps); if (c === "sales") return f(S.sales); if (c === "opname") return f(S.opn); if (c === "aset") return f(S.aset);
    if (c === "absen") return f(S.abs) || f(S.absToday); if (c === "payroll") return S.prDocs[id] || null; if (c === "kpi") return Object.values(S.kpiAll).find(x => x.id === id) || null;
    if (c === "refund") return f(S.refund); if (c === "kasbon") return f(S.kasbon); if (c === "permintaan") return f(S.minta); if (c === "tabungan") return f(S.tbg); if (c === "pemusnahan") return f(S.musnah);
    if (c === "closing") return S.closing[id] || null; if (c === "users") return S.users.find(x => x.id === id) || null; if (c === "settings") return { main:S.cfg, stok:S.stok, hr:S.hr, karyawan:S.ky, roles:S.roles }[id] || null; return null; }
  const SLIM_SKIP = ["hash","salt","iter","tx","m","gajiOwners","revisi","rekening","pre","by","at","contoh","bulan","items","rincian","rows","cek","nilai","catatan","komentar","penilai","komplain","list","matrix","assign","ringkasan","cabang_list"];
  function slim(d){ if (!d) return null; const o = {}; let n = 0;
    Object.entries(d).forEach(([k, v]) => { if (n >= 14 || SLIM_SKIP.includes(k) || k === "id") return; if (typeof v === "string") { o[k] = v.slice(0, 120); n++; } else if (typeof v === "number" || typeof v === "boolean") { o[k] = v; n++; } });
    if (Array.isArray(d.rows)) { o.karyawan = d.rows.length; } if (Array.isArray(d.items)) o.item = d.items.length; return o; }
  function ringkas(c, d){ if (!d) return ""; const bits = [d.cabang || d.unit || d.lokasi || "", d.tanggal ? fmtDate(d.tanggal) : "", d.kategori || "", d.keterangan || d.nama || "", d.jumlah ? rp(d.jumlah) : d.total ? rp(d.total) : "", d.status || ""].filter(Boolean);
    return (COLL_LABEL[c] || c) + (bits.length ? " · " + bits.join(" · ") : ""); }
  function audit(aksi, path, before, after){
    const c = path.split("/")[0]; if (AUD_SKIP.includes(c) || !RAWDB) return;
    const nama = S.appUser?.nama || ls.get("rpc-pengisi") || "";
    RAWDB.collection(AUD_ADM.includes(c) ? "logadm" : "log").add({ at: new Date().toISOString(), by: S.uid || null, nama, aksi, path, coll: c, hal: S.leaf || S.tab || "", ringkas: ringkas(c, after || before), before: slim(before), after: slim(after) }).catch(() => {});
  }
  function wrapDoc(path){ const d = RAWDB.doc(path);
    return { id: d.id, path: d.path, get: () => d.get(), onSnapshot: (...a) => d.onSnapshot(...a),
      set: async x => { const b = localOf(path); await d.set(x); audit(b ? "ubah" : "tambah", path, b, x); },
      update: async x => { const b = localOf(path); await d.update(x); audit("ubah", path, b, { ...(b || {}), ...x }); },
      delete: async () => { const b = localOf(path); await d.delete(); audit("hapus", path, b, null); } }; }
  function wrapDb(db){ RAWDB = db;
    return { doc: p => wrapDoc(p), collection: name => { const c = db.collection(name);
      return { where: (...a) => c.where(...a), limit: (...a) => c.limit(...a), orderBy: (...a) => c.orderBy(...a), onSnapshot: (...a) => c.onSnapshot(...a), get: (...a) => c.get(...a),
        doc: id => wrapDoc(name + "/" + id), add: async d => { const r = await c.add(d); audit("tambah", name + "/" + r.id, null, d); return r; } }; } }; }
  S.logs = []; S.logLoaded = false;
  function renderLog(){
    if (S.leaf !== "set/log") return;
    { const keep = $("loColl").value; $("loColl").innerHTML = `<option value="">Semua data</option>` + Object.entries(COLL_LABEL).map(([k, l]) => `<option value="${k}" ${k === keep ? "selected" : ""}>${esc(l)}</option>`).join(""); }
    if (!S.admin) { $("loTable").innerHTML = `<tr><td class="empty">Riwayat perubahan hanya bisa dibuka admin.</td></tr>`; return; }
    if (!S.logLoaded) { $("loTable").innerHTML = `<tr><td class="empty">Memuat…</td></tr>`; return; }
    const fc = $("loColl").value, q = $("loQ").value.trim().toLowerCase();
    const L = S.logs.filter(x => (!fc || x.coll === fc) && (!q || ((x.nama || "") + " " + (x.ringkas || "")).toLowerCase().includes(q)));
    const diff = x => { const b = x.before || {}, a = x.after || {}; if (x.aksi === "tambah" || x.aksi === "hapus") return "";
      const ks = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(k => String(b[k] ?? "") !== String(a[k] ?? "")).slice(0, 4);
      return ks.map(k => `${esc(k)}: ${esc(String(b[k] ?? "–"))} → <b>${esc(String(a[k] ?? "–"))}</b>`).join("<br>"); };
    $("loTable").innerHTML = L.length ? `<thead><tr><th>Waktu</th><th>Oleh</th><th>Aksi</th><th>Data</th><th>Perubahan</th></tr></thead><tbody>` +
      L.map(x => { const d = new Date(x.at); return `<tr><td class="num" style="white-space:nowrap">${esc(fmtDate(isoOf(d)))}<small class="note" style="display:block">${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}</small></td>
        <td>${esc(x.nama || "–")}<small class="note" style="display:block">${esc(x.hal || "")}</small></td><td><span class="pill ${x.aksi === "hapus" ? "no" : x.aksi === "ubah" ? "warn" : "ok"}">${esc(x.aksi)}</span></td>
        <td class="k">${esc(x.ringkas || x.path)}</td><td class="k" style="font-size:12.5px">${diff(x)}</td></tr>`; }).join("") + `</tbody>`
      : `<tr><td class="empty">Belum ada perubahan tercatat.</td></tr>`;
  }
  $("loColl").addEventListener("change", renderLog); $("loQ").addEventListener("input", renderLog);
  $("loCsv").addEventListener("click", async () => { if (!S.logs.length) { toast("Belum ada riwayat"); return; }
    const q = v => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [["Waktu","Oleh","Halaman","Aksi","Data","Path","Sebelum","Sesudah"].map(q).join(",")];
    S.logs.forEach(x => lines.push([x.at, x.nama, x.hal, x.aksi, x.ringkas, x.path, JSON.stringify(x.before || ""), JSON.stringify(x.after || "")].map(q).join(",")));
    try { await S.dl.save({ filename: "Riwayat perubahan Lash Bounty ERP.csv", data: "﻿" + lines.join("\n") }); toast("File disimpan"); } catch (err) { if (err?.code !== "declined") toast("Download gagal"); } });
  // backup Excel
  let xlsxP = null;
  const loadXlsx = () => xlsxP ||= new Promise((res, rej) => { if (window.XLSX) return res(window.XLSX); const sc = document.createElement("script");
    sc.charset = "utf-8"; sc.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; sc.onload = () => res(window.XLSX); sc.onerror = () => { xlsxP = null; rej(new Error("load")); }; document.head.appendChild(sc); });
  $("bkXlsx").addEventListener("click", async () => {
    if (!RAWDB || !S.dl) { $("bkMsg").textContent = "Butuh penyimpanan & download aktif."; return; }
    const btn = $("bkXlsx"); btn.disabled = true; $("bkMsg").textContent = "Mengambil data…";
    try {
      const X = await loadXlsx(), get = async c => { try { const sn = await RAWDB.collection(c).limit(1000).get(); return sn.docs.map(d => ({ id: d.id, ...d.data() })); } catch { return []; } };
      const [ex, sa, ps, op, pr, kp, ab, as, cl, lg0, lg1, byr, ksx, ctx, cus] = await Promise.all(["expenses","sales","pusat","opname","payroll","kpi","absen","aset","closing","log","logadm","bayar","kas","custtx","cust"].map(get)); const lg = [...lg0, ...lg1];
      const mt = canBank() ? await get("mutasi") : [];
      const wb = X.utils.book_new(), add = (name, rows) => X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows.length ? rows : [{ info: "kosong" }]), name);
      add("Petty cash", ex.map(r => ({ tanggal: r.tanggal, periode: perOf(r.tanggal || ""), cabang: r.cabang, keterangan: r.keterangan, jumlah: r.jumlah, nota: r.nota || "", tanpa_struk: r.tanpaStruk ? "ya" : "", hpp: isHpp(r) ? "HPP" : "Keperluan", diisi_oleh: r.pengisi || "", contoh: r.contoh ? "ya" : "" })));
      add("Biaya cabang & pusat", ps.map(biayaNorm).map(p => ({ tanggal: p.tanggal, periode: perOf(p.tanggal || ""), unit: p.unit, kategori: p.kategori, keterangan: p.keterangan, jumlah: p.jumlah, dibayar_dari: p.dana || "", nota: p.nota || "", diisi_oleh: p.pengisi || "" })));
      add("Omzet", sa.map(s => ({ tanggal: s.tanggal, periode: perOf(s.tanggal || ""), cabang: s.cabang, sumber: s.sumber || "Zenwel", keterangan: s.keterangan || "", total: s.total, item: (s.items || []).length })));
      add("Omzet per item", sa.flatMap(s => (s.items || []).map(it => ({ tanggal: s.tanggal, cabang: s.cabang, item: it.item, qty: it.qty, gross: it.gross, diskon: it.disc, net: it.net, total: it.total }))));
      add("Stok", op.flatMap(o => (o.items || []).map(it => ({ tanggal: o.tanggal, cabang: o.cabang, jenis: o.jenis, barang: it.nama, qty: it.qty ?? "", masuk: it.masuk ?? "", keluar: it.keluar ?? "", oleh: o.pengisi || "" }))));
      add("Payroll", pr.flatMap(P => (P.rows || []).map(r => ({ periode: P.periode || P.bulan, status: P.status, nama: r.nama, jabatan: r.jabatan, penempatan: r.cabang, hk: r.hk, hadir: r.hadir, izin: r.izin, sakit: r.sakit, alpha: r.alpha, pokok: r.pokok, tunjangan: r.tunjangan, bonus: r.bonus, komisi: r.komisi || 0, potongan: r.potLain || 0 }))));
      add("KPI", kp.map(k => ({ periode: k.periode, nama: k.nama, cabang: k.cabang, poin: k.poin, nilai_kpi: k.net })));
      add("Absensi", ab.map(a => ({ tanggal: a.tanggal, cabang: a.cabang, nama: a.nama, status: a.status, masuk: a.masuk || "", pulang: a.pulang || "", keterangan: a.ket || "", koreksi: a.koreksi ? a.koreksiBy || "pusat" : "" })));
      add("Aset", as.map(a => ({ lokasi: a.lokasi, nama: a.nama, kategori: a.kategori, jumlah: a.qty, rusak: a.rusak || 0, nilai_per_unit: a.nilai || 0, total_nilai: (a.qty || 0) * (a.nilai || 0) })));
      add("Tutup buku", cl.map(c => ({ periode: c.id, status: c.status, ditutup_oleh: c.closedBy || "", tanggal: c.closedAt || "", pemasukan: c.ringkasan?.pemasukan ?? "", pengeluaran: c.ringkasan?.pengeluaran ?? "", laba: c.ringkasan?.laba ?? "" })));
      add("Metode bayar", byr.map(b => ({ tanggal: b.tanggal, cabang: b.cabang, ...Object.fromEntries(Object.entries(b.m || {}).map(([k2, v]) => [k2 === "cash" ? "cash" : k2 === "lain" ? "transfer_lain" : rekOf(k2)?.nama || k2, v])) })));
      add("Setoran cash", ksx.map(x => ({ tanggal: x.tanggal, cabang: x.cabang, rekening: rekOf(x.rek)?.nama || x.rek, jumlah: x.jumlah, keterangan: x.ket || "" })));
      add("Customer", cus.flatMap(b => Object.entries(b.list || {}).map(([k2, c]) => ({ nama: c.nama, hp: c.hp || "", cabang: c.cabang || "", rating: c.rating || "", label: c.tag || "", catatan: c.catatan || "" }))));
      add("Transaksi customer", ctx.flatMap(d => (d.tx || []).map(x => ({ tanggal: d.tanggal, cabang: d.cabang, nama: x.nama, hp: x.hp, layanan: x.layanan, total: x.total, metode: x.metode, therapist: x.therapist, invoice: x.inv }))));
      if (mt.length) add("Mutasi bank", mt.flatMap(m => (m.tx || []).map(x => ({ tanggal: m.tanggal, rekening: rekOf(m.rek)?.nama || m.rek, jam: x.jam, keterangan: x.ket, masuk: x.jumlah > 0 ? x.jumlah : "", keluar: x.jumlah < 0 ? -x.jumlah : "", saldo: x.saldo ?? "" }))));
      add("Riwayat perubahan", lg.sort((a, b) => (b.at || "").localeCompare(a.at || "")).map(x => ({ waktu: x.at, oleh: x.nama, aksi: x.aksi, data: x.ringkas, path: x.path })));
      const out = X.write(wb, { bookType: "xlsx", type: "array" });
      $("bkMsg").textContent = "Menyimpan file…";
      await S.dl.save({ filename: `Backup Lash Bounty ERP ${todayISO()}.xlsx`, data: new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) });
      $("bkMsg").textContent = ""; toast("Backup Excel disimpan");
    } catch (err) { $("bkMsg").textContent = err?.code === "declined" ? "" : "Gagal membuat backup. Coba lagi."; }
    finally { btn.disabled = false; }
  });

  /* ---------- laporan tutup buku: Simple, Cabang Wendy, Expertise ---------- */
  const HPP_RX = /(bulu ?mata|eyelash|lash|lem\b|glue|remover|primer|serum|kutek|\bgel\b|top ?coat|base ?coat|cat ?eye|fake ?nail|press ?on|nail|kuku|buffer|akrilik|acrylic|garam|pedi|mani|micropore|pouch|steril|sponge|stiker|sticker|aksesoris|kapas|cotton|eye ?pad|pinset|tweezer|lift|tint|henna|wax|masker|cleanser|shampoo|glitter|rhinestone|foil)/i;
  const hppGuess = r => HPP_RX.test((r.keterangan || "") + " " + (r.rincian || []).map(x => x.barang).join(" "));
  const isHpp = r => r.hpp != null ? !!r.hpp : hppGuess(r);
  const MONTHLY = [["IPL", ["IPL"]], ["Internet", ["Internet & telepon"]], ["PAM", ["PAM / air"]], ["Listrik", ["Listrik", "Listrik & air"]]];
  const katGrp = k => k === "Stok bahan (HPP)" ? "hpp" : MONTHLY.some(([, ks]) => ks.includes(k)) ? "bulanan" : k === "Sewa / mortgage" ? "sewa" : "lain";
  const fA = n => (Math.round(n) < 0 ? "-" : "") + "Rp" + Math.abs(Math.round(n || 0)).toLocaleString("en-US");
  const fAcc = n => { const v = Math.round(n || 0); return v < 0 ? "(" + fmt(-v) + ")" : v ? fmt(v) : "–"; };
  const pctS = (a, b) => b ? pct(a / b) : "–";
  function incomeStmt(cabs, k){
    const ms = S.sales.filter(s => cabs.includes(s.cabang) && inPer(s.tanggal, k));
    const zen = sumOf(ms.filter(s => s.sumber !== "Manual"), s => s.total), man = sumOf(ms.filter(s => s.sumber === "Manual"), s => s.total);
    const pc = S.rows.filter(r => cabs.includes(r.cabang) && inPer(r.tanggal, k)), B0 = biayaPer(k).filter(p => cabs.includes(p.unit)), pc0 = cabsOfGrup(bhCfg().grup);
    const isCo = p => CO_KAT.includes(p.kategori) && pc0.includes(p.unit), coB = B0.filter(isCo), B = B0.filter(p => !isCo(p));
    const hpp = [...B.filter(p => katGrp(p.kategori) === "hpp").map(p => ({ label: p.keterangan || p.kategori, v: p.jumlah || 0, note: p.dana || "", cab: p.unit, src: "bc" })),
      ...pc.filter(isHpp).map(r => ({ label: r.keterangan, v: r.jumlah || 0, note: r.dana || "kas", cab: r.cabang, src: "pc", id: r.id }))];
    const pcLain = pc.filter(r => !isHpp(r));
    const sal = {}, kom = {};
    tokKeys(k).forEach(mk => (S.prDocs[mk]?.rows || []).filter(r => cabs.includes(r.cabang)).forEach(r0 => { const r = prNorm(r0), t = thp(r0, mk), c = r.komisi || 0, key = r.nama + "|" + r.cabang;
      (sal[key] ||= { label: r.nama, cab: r.cabang, v: 0 }).v += t - c; if (c) (kom[key] ||= { label: r.nama, cab: r.cabang, v: 0 }).v += c; }));
    const monthly = MONTHLY.map(([l, ks]) => ({ label: l, v: sumOf(B.filter(p => ks.includes(p.kategori)), p => p.jumlah), note: [...new Set(B.filter(p => ks.includes(p.kategori)).map(p => p.dana).filter(Boolean))].join(", ") }));
    const rent = B.filter(p => katGrp(p.kategori) === "sewa").map(p => ({ label: p.keterangan || "Sewa", v: p.jumlah || 0, note: p.dana || "", cab: p.unit }));
    const other = [{ label: "Belanja Keperluan Cabang", v: sumOf(pcLain, r => r.jumlah), note: pcLain.length + " transaksi" },
      ...B.filter(p => katGrp(p.kategori) === "lain").map(p => ({ label: p.kategori === "Lain-lain" ? (p.keterangan || "Lain-lain") : p.kategori + (p.keterangan ? " (" + p.keterangan + ")" : ""), v: p.jumlah || 0, note: p.dana || "", cab: p.unit, kat: p.kategori }))];
    const T = a => sumOf(a, x => x.v);
    const o = { ms, zen, man, sales: zen + man, hpp, hppT: T(hpp), salary: Object.values(sal), salT: T(Object.values(sal)), komisi: Object.values(kom), komT: T(Object.values(kom)),
      monthly, monT: T(monthly), rent, rentT: T(rent), other, othT: T(other), pc, pcLain, B, coB, coT: sumOf(coB, p => p.jumlah) };
    o.gross = o.sales - o.hppT; o.exp = o.salT + o.komT + o.monT + o.rentT + o.othT; o.net = o.gross - o.exp; return o;
  }
  function pusatStmt(k){
    const B = biayaPer(k).filter(p => p.unit === "Pusat"), ks = tokKeys(k);
    const kats = [...PST_KAT, ...new Set(B.map(p => p.kategori).filter(c => !PST_KAT.includes(c)))];
    const kat = kats.map(c => ({ label: c, v: sumOf(B.filter(p => p.kategori === c), p => p.jumlah), sec: pstSec(c) }));
    const prRows = {}; ks.forEach(mk => (S.prDocs[mk]?.rows || []).filter(r => (r.cabang || "Pusat") === "Pusat").forEach(r => { const key = r.nama || "(tanpa nama)"; (prRows[key] ||= { label: key, v: 0, note: r.jabatan || "" }).v += thp(r, mk); }));
    const staff = Object.values(prRows), pr = sumOf(staff, x => x.v);
    const lines = sc => { const L = B.filter(p => pstSec(p.kategori) === sc), one = p => ({ label: p.keterangan || p.kategori, v: p.jumlah || 0, note: [p.dana, fmtD(p.tanggal)].filter(Boolean).join(" · ") });
      if (sc !== "oth") return L.map(one); const pc = L.filter(p => p.kategori === "Petty cash pusat");
      return [...(pc.length ? [{ label: "Petty cash pusat", v: sumOf(pc, p => p.jumlah), note: pc.length + " transaksi" }] : []), ...L.filter(p => p.kategori !== "Petty cash pusat").map(one)]; };
    const sec = { exp: lines("exp"), ho: lines("ho"), rent: lines("rent"), oth: lines("oth") }, T = a => sumOf(a, x => x.v);
    return { B, kat, pr, staff, sec, secT: { exp: T(sec.exp), ho: T(sec.ho), rent: T(sec.rent), oth: T(sec.oth) }, total: sumOf(B, p => p.jumlah) + pr }; }
  const rptName = k => isTok(k) ? "Period " + mName(k) : "Period " + mName(k);
  const closedInfo = k => { const ks = tokKeys(k), st = ks.map(m => stageOf(m)), rv = ks.length === 1 ? (S.closing[ks[0]]?.revisi || []).length : 0; if (st.every(x => x === 3)) return "Final · sudah tutup buku" + (rv ? " · revisi ke-" + rv : ""); if (rv) return "Sedang direvisi (revisi ke-" + rv + ")"; if (st.every(x => x >= 1)) return st.every(x => x >= 2) ? "Pre-final · termasuk gaji owner" : "Pre-final · belum termasuk gaji owner"; return "Draft · angka sementara"; };
  const stampOf = k => { const st = tokKeys(k).map(m => stageOf(m)); const rv = tokKeys(k).some(m => (S.closing[m]?.revisi || []).length && stageOf(m) < 3); return st.every(x => x === 3) ? "" : `<div class="rp-stamp">${rv ? "REVISI" : st.every(x => x >= 1) ? "PRE-FINAL" : "DRAFT"}</div>`; };
  const printed = () => { const d = new Date(); return fmtDate(isoOf(d)) + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  function paperFoot(k){ return `<div class="rp-foot rb">Dibuat dari Lash Bounty ERP · ${esc(perRange(k))} · ${esc(closedInfo(k))} · dicetak ${esc(printed())}</div>`; }
  // 1) Simple (format file Income Statement per cabang)
  function simpleHtml(c, k, bare){
    const I = incomeStmt([c], k), nm = shortCab(c);
    const row = (l, v, note = "", cls = "") => `<tr class="${cls}"><td>${l}</td><td class="r">${v}</td><td class="n">${esc(note)}</td></tr>`;
    const lines = (arr) => arr.map(x => row(`<span class="ind">${esc(x.label)}</span>`, fA(-x.v), x.note)).join("");
    let h = (bare ? "" : stampOf(k)) + `<div class="rp-h rb"><b>Lash Bounty ${esc(nm)}</b><span>Income Statement for the ${isTok(k) ? "" : "Month Ended "}${esc(rptName(k))}</span><small>${esc(perRange(k))}</small></div><table class="rp-t">`;
    h += `<tr class="rp-sec"><td colspan="3">Sales Report (${esc(nm)})</td></tr>` + row("<b>SALES</b>", `<b>${fA(I.zen)}</b>`, "sesuai zenwel", "rp-big");
    if (I.man) h += row(`<span class="ind">Omzet manual (di luar Zenwel)</span>`, fA(I.man), "input manual") + row("<b>Total Sales</b>", `<b>${fA(I.sales)}</b>`, "", "rp-tot");
    h += `<tr class="rp-sub"><td colspan="3">(Cost Of Good Sold)</td></tr>` + (I.hpp.length ? lines(I.hpp) : row(`<span class="ind note">Belum ada</span>`, fA(0)));
    h += row("Total Cost of Good Sold", fA(-I.hppT), "", "rp-tot") + row("<b>GROSS PROFIT</b>", `<b>${fA(I.gross)}</b>`, "", "rp-big") + `<tr class="rp-gap"><td colspan="3"></td></tr>`;
    h += `<tr class="rp-sec"><td colspan="3">Expenses Report</td></tr>`;
    h += `<tr class="rp-sub"><td colspan="3">Salary Expenses</td></tr>` + (I.salary.length ? lines(I.salary) : row(`<span class="ind note">Payroll ${esc(perName(k))} belum ada</span>`, fA(0))) + row("Total Salary Expenses", fA(-I.salT), "", "rp-tot");
    h += `<tr class="rp-sub"><td colspan="3">Commision Expenses</td></tr>` + (I.komisi.length ? lines(I.komisi) : row(`<span class="ind note">Tidak ada komisi</span>`, fA(0))) + row("Total Commision Expenses", fA(-I.komT), "", "rp-tot");
    h += `<tr class="rp-sub"><td colspan="3">Monthly Expenses</td></tr>` + lines(I.monthly) + row("Total Monthly Expenses", fA(-I.monT), "", "rp-tot");
    h += `<tr class="rp-sub"><td colspan="3">Rent & Mortgage Expenses</td></tr>` + (I.rent.length ? lines(I.rent) : row(`<span class="ind note">Tidak ada</span>`, fA(0))) + row("Total Rent & Mortgage Expenses", fA(-I.rentT), "", "rp-tot");
    h += `<tr class="rp-sub"><td colspan="3">Other Expenses</td></tr>` + lines(I.other.filter((x, i) => i === 0 || x.v)) + row("Total Other Expenses", fA(-I.othT), "", "rp-tot");
    h += row("<b>Total Expenses</b>", `<b>${fA(-I.exp)}</b>`, "", "rp-tot2") + `<tr class="rp-gap"><td colspan="3"></td></tr>` + row("<b>Net Profit</b>", `<b>${fA(I.net)}</b>`, I.sales ? "margin " + pct(I.net / I.sales) : "", "rp-net " + (I.net < 0 ? "neg" : ""));
    h += `</table>`;
    if (I.coT) h += `<p class="note rb" style="margin:6px 0 0">Ads & office/admin fee cabang ini (${fA(I.coT)}) tidak dipotong di sini; dicatat di Company Expenses laporan Lash Bounty X ${esc(rptCfg().partnerNama)}.</p>`;
    return h + (bare ? "" : ttdBlock(k) + paperFoot(k));
  }
  const tglPanjang = iso => { const [y, m, d] = iso.split("-"); return d + " " + BLN[+m - 1] + " " + y; };
  const signHtml = (who) => `<div class="rp-sign2 rb">${who.map(([t, n]) => `<div><small>${esc(t)}</small><span></span><b>${esc(n)}</b></div>`).join("")}</div>`;
  // tabel laporan 2 kolom + catatan (format Global & Wendy)
  function stmtTable(secs, extraRows = ""){
    const row = (l, v, note = "", cls = "") => `<tr class="${cls}"><td>${l}</td><td class="r">${v}</td><td class="n">${esc(note)}</td></tr>`;
    let h = `<table class="rp-t">`;
    secs.forEach(sc => { h += `<tr class="rp-sec"><td colspan="3">${esc(sc.t)}</td></tr>`;
      h += sc.rows.length ? sc.rows.map(r => row(`<span class="ind">${esc(r.l)}</span>`, fA(r.v), r.note || "")).join("") : row(`<span class="ind note">${esc(sc.empty || "Tidak ada")}</span>`, fA(0));
      h += row(sc.tot, `<b>${fA(sc.T)}</b>`, "", "rp-tot") + `<tr class="rp-gap"><td colspan="3"></td></tr>`; });
    return h + extraRows + `</table>`;
  }
  // 2a) Lash Bounty X Wendy Walters (format laporan untuk partner)
  function wendyModel(k){
    const P = companyPL(k), R = rptCfg(), W = P.W;
    const inc = { t: "Income Report", rows: P.pCabs.map(c => ({ l: "Profit " + shortCab(c), v: incomeStmt([c], k).net })), tot: "Total Income" };
    const wl = { t: `Pendapatan Walters Lash (${P.WL.pct}% omzet treatment Walters Lash di cabang internal · 100% untuk ${R.partnerNama}, tidak dibagi)`, empty: "Belum ada treatment Walters Lash di " + P.iCabs.map(shortCab).join(" / "),
      rows: P.WL.per.filter(x => x.om).map(x => ({ l: "Walters Lash " + shortCab(x.c), v: x.fee, note: fmtQty(x.qty) + " treatment · omzet " + fA(x.om) })), tot: "Total Pendapatan Walters Lash (langsung untuk " + R.partnerNama + ")" };
    const coL = arr => arr.map(p => ({ l: p.keterangan || p.kategori, v: -(p.jumlah || 0), note: shortCab(p.unit) + (p.dana ? " · " + p.dana : "") }));
    const ce = { t: "Company Expenses", empty: "Online Advertisement belum diinput", rows: coL(P.coAds), tot: "Total Company Expenses (Ads)" };
    const oe = { t: "Office Expenses", empty: "Office + Admin Fee belum diinput", rows: coL(P.coFee), tot: "Total Office Expenses" };
    [inc, wl, ce, oe].forEach(sc => sc.T = sumOf(sc.rows, r => r.v));
    return { P, R, W, secs: [inc, wl, ce, oe], income: inc.T, wl: wl.T, exp: ce.T + oe.T, net: inc.T + ce.T + oe.T };
  }
  function wendyHtml(g, k){
    const M = wendyModel(k), P = M.P, R = M.R, ip = 100 - P.pct;
    let h = stampOf(k) + `<div class="rp-h rb"><b>Lash Bounty X ${esc(R.partnerNama)}</b><span>Global Income Statement for the ${isTok(k) ? "" : "Month Ended "}${esc(rptName(k))}</span><small>${esc(P.pCabs.map(shortCab).join(" + "))} · ${esc(perRange(k))}</small></div>`;
    const tail = `<tr class="rp-tot2"><td><b>Total Company Expenses</b></td><td class="r"><b>${fA(M.exp)}</b></td><td class="n"></td></tr><tr class="rp-gap"><td colspan="3"></td></tr>` +
      `<tr class="rp-net ${M.net < 0 ? "neg" : ""}"><td><b>Total Company Net Income</b></td><td class="r"><b>${fA(M.net)}</b></td><td class="n">Total Income − Total Company Expenses · dibagi ${P.pct}:${ip}</td></tr>`;
    h += stmtTable(M.secs, tail);
    h += `<div class="rp-h2 rb">Bagi hasil net income</div><table class="rp-t"><tbody>` +
      `<tr><td>Total Company Net Income</td><td class="r">${fA(M.net)}</td><td class="n"></td></tr>` +
      `<tr><td><span class="ind">Bagian ${esc(R.partnerNama)} (${P.pct}%)</span></td><td class="r">${fA(M.net * P.pct / 100)}</td><td class="n"></td></tr>` +
      `<tr><td><span class="ind">+ Pendapatan Walters Lash (100%)</span></td><td class="r">${fA(M.wl)}</td><td class="n">tidak dibagi</td></tr>` +
      `<tr class="rp-tot"><td><b>Total diterima ${esc(R.partnerNama)}</b></td><td class="r"><b>${fA(M.net * P.pct / 100 + M.wl)}</b></td><td class="n"></td></tr>` +
      `<tr class="rp-tot"><td><b>Bagian Lash Bounty (${ip}%)</b></td><td class="r"><b>${fA(M.net * ip / 100)}</b></td><td class="n">masuk laporan Global</td></tr></tbody></table>`;
    h += ttdBlock(k);
    // lampiran
    h += `<div class="rp-h2 rb pb">Lampiran 1 · Ringkasan per cabang</div>` + grupCols(g, k);
    if (P.WL.om) { const agg = {}; P.WL.per.forEach(x => x.its.forEach(it => { const a = agg[x.c + "|" + it.item] ||= { c: x.c, item: it.item, qty: 0, om: 0 }; a.qty += it.qty; a.om += it.total; }));
      h += `<div class="rp-h2 rb">Lampiran 2 · Rincian Walters Lash di cabang internal</div><table class="rp-t"><thead><tr><th>Cabang</th><th>Treatment</th><th class="r">Qty</th><th class="r">Omzet</th><th class="r">${P.WL.pct}% untuk ${esc(g)}</th></tr></thead><tbody>` +
        Object.values(agg).map(a => `<tr><td>${esc(shortCab(a.c))}</td><td>${esc(a.item)}</td><td class="r">${esc(fmtQty(a.qty))}</td><td class="r">${fA(a.om)}</td><td class="r">${fA(a.om * P.WL.pct / 100)}</td></tr>`).join("") +
        `<tr class="rp-tot"><td colspan="2">Total</td><td class="r">${esc(fmtQty(P.WL.qty))}</td><td class="r">${fA(P.WL.om)}</td><td class="r">${fA(P.wl)}</td></tr></tbody></table>`; }
    P.pCabs.forEach((c, i) => h += `<div class="rp-h2 rb pb">Lampiran ${P.WL.om ? 3 + i : 2 + i} · Income statement ${esc(shortCab(c))}</div>` + simpleHtml(c, k, true));
    return h + paperFoot(k);
  }
  // 2b) tabel gabungan per cabang (kolom per cabang + total grup)
  function grupCols(g, k){
    const cabs = cabsOfGrup(g), Is = cabs.map(c => incomeStmt([c], k)), IT = incomeStmt(cabs, k);
    const cols = [...Is, IT], th = [...cabs.map(shortCab), "Total " + g];
    const row = (l, f, cls = "", neg = false) => `<tr class="${cls}"><td>${l}</td>${cols.map(I => `<td class="r">${fA((neg ? -1 : 1) * f(I))}</td>`).join("")}</tr>`;
    const pr = (l, f, cls = "") => `<tr class="${cls}"><td>${l}</td>${cols.map(I => `<td class="r">${I.sales ? pct(f(I) / I.sales) : "–"}</td>`).join("")}</tr>`;
    const kat = (I, ks) => sumOf(I.B.filter(p => ks.includes(p.kategori)), p => p.jumlah);
    const sec = t => `<tr class="rp-sub"><td colspan="${cols.length + 1}">${t}</td></tr>`;
    let h = `<table class="rp-t rp-g"><thead><tr><th></th>${th.map(t => `<th class="r">${esc(t)}</th>`).join("")}</tr></thead><tbody>`;
    h += sec("Sales Report") + row("SALES (Zenwel)", I => I.zen) + (IT.man ? row("Omzet manual", I => I.man) : "") + row("<b>Total Sales</b>", I => I.sales, "rp-tot");
    h += sec("(Cost Of Good Sold)") + row(`<span class="ind">Stok bahan (HPP)</span>`, I => sumOf(I.hpp.filter(x => x.src === "bc"), x => x.v), "", true) + row(`<span class="ind">Bahan dari petty cash</span>`, I => sumOf(I.hpp.filter(x => x.src === "pc"), x => x.v), "", true);
    h += row("Total Cost of Good Sold", I => I.hppT, "rp-tot", true) + row("<b>GROSS PROFIT</b>", I => I.gross, "rp-big") + pr(`<span class="ind note">Gross margin</span>`, I => I.gross);
    h += sec("Expenses Report") + row(`<span class="ind">Salary Expenses</span>`, I => I.salT, "", true) + row(`<span class="ind">Commision Expenses</span>`, I => I.komT, "", true);
    MONTHLY.forEach(([l, ks]) => h += row(`<span class="ind">${l}</span>`, I => kat(I, ks), "", true));
    h += row(`<span class="ind">Rent & Mortgage</span>`, I => I.rentT, "", true) + row(`<span class="ind">Belanja Keperluan Cabang</span>`, I => I.other[0].v, "", true);
    ["Ads / iklan", "Office + admin fee", "Refund customer", "Biaya admin EDC & QR", "Perbaikan cabang", "Lain-lain"].forEach(c => { if (kat(IT, [c])) h += row(`<span class="ind">${esc(c)}</span>`, I => kat(I, [c]), "", true); });
    h += row("<b>Total Expenses</b>", I => I.exp, "rp-tot2", true) + row("<b>NET PROFIT</b>", I => I.net, "rp-net") + pr(`<span class="ind note">Net margin</span>`, I => I.net);
    h += `<tr><td><span class="ind note">Kontribusi ke laba grup</span></td>${cols.map(I => `<td class="r">${IT.net ? pct(I.net / IT.net) : "–"}</td>`).join("")}</tr></tbody></table>`;
    const people = [...IT.salary.map(x => x.label + "|" + x.cab), ...IT.komisi.map(x => x.label + "|" + x.cab)].filter((v, i, a) => a.indexOf(v) === i);
    if (people.length) { h += `<div class="rp-h2 rb">Rincian gaji & komisi</div><table class="rp-t"><thead><tr><th>Nama</th><th>Cabang</th><th class="r">Gaji</th><th class="r">Komisi</th><th class="r">Total</th></tr></thead><tbody>` +
      people.map(p => { const [n, c] = p.split("|"), s = IT.salary.find(x => x.label === n && x.cab === c)?.v || 0, km = IT.komisi.find(x => x.label === n && x.cab === c)?.v || 0;
        return `<tr><td>${esc(n)}</td><td>${esc(shortCab(c))}</td><td class="r">${fA(s)}</td><td class="r">${fA(km)}</td><td class="r">${fA(s + km)}</td></tr>`; }).join("") +
      `<tr class="rp-tot"><td colspan="2">Total</td><td class="r">${fA(IT.salT)}</td><td class="r">${fA(IT.komT)}</td><td class="r">${fA(IT.salT + IT.komT)}</td></tr></tbody></table>`; }
    return h;
  }
  function grupHtml(g, k){
    const BH = bhCfg(); if (g === BH.grup && cabsOfGrup(g).length) return wendyHtml(g, k);
    const cabs = cabsOfGrup(g);
    let h = stampOf(k) + `<div class="rp-h rb"><b>Lash Bounty · Cabang ${esc(g)}</b><span>Consolidated Income Statement for the ${isTok(k) ? "" : "Month Ended "}${esc(rptName(k))}</span><small>${esc(cabs.map(shortCab).join(" + "))} · ${esc(perRange(k))}</small></div>` + grupCols(g, k);
    if (BH.grup && cabsOfGrup(BH.grup).length) { const P = companyPL(k), IT = incomeStmt(cabs, k);
      h += `<div class="rp-h2 rb">Dari cabang ${esc(BH.grup)}</div><table class="rp-t"><tbody>` +
        `<tr><td>Net income Lash Bounty X ${esc(rptCfg().partnerNama)}</td><td class="r">${fA(P.wNet)}</td></tr><tr><td><span class="ind">Bagi hasil ${100 - P.pct}% untuk Internal</span></td><td class="r">${fA(P.share)}</td></tr>` +
        `<tr><td><span class="ind">Online ads & admin fee dari cabang ${esc(BH.grup)}</span></td><td class="r">${fA(P.ads + P.fee)}</td></tr><tr><td><span class="ind">Komisi Walters Lash ${P.WL.pct}% ke ${esc(BH.grup)}</span></td><td class="r">${fA(-P.wl)}</td></tr>` +
        `<tr class="rp-net"><td><b>Net profit ${esc(g)} setelah transaksi cabang ${esc(BH.grup)}</b></td><td class="r"><b>${fA(IT.net + P.share + P.ads + P.fee - P.wl)}</b></td></tr></tbody></table>` +
        `<p class="note rb" style="margin:6px 0 0">Belum termasuk beban kantor pusat dan gaji owner (lihat laporan Global).</p>`; }
    return h + ttdBlock(k) + paperFoot(k);
  }
  // 2c) Summary Global income statement (semua profit ditarik ke pusat)
  function globalModel(k){
    const P = companyPL(k), PS = P.PS, neg = arr => arr.map(x => ({ l: x.label, v: -x.v, note: x.note || "" }));
    const inc = { t: "Income Report", rows: P.iCabs.map(c => ({ l: "Profit " + shortCab(c), v: incomeStmt([c], k).net })), tot: "Total Income" };
    const oth = { t: "Other income", tot: "Total other income", rows: [
      ...(P.partner ? [{ l: `Online Advertisement & Admin fee (${P.pCabs.map(shortCab).join(" & ")})`, v: P.ads + P.fee, note: "dari laporan Lash Bounty X " + rptCfg().partnerNama },
        { l: `Bagi hasil ${100 - P.pct}% net income cabang ${P.partner}`, v: P.share, note: "net " + fA(P.wNet) }] : []),
      ...P.oi.map(s => ({ l: s.keterangan || s.kategori || "Pendapatan pusat", v: s.total || 0, note: fmtD(s.tanggal) + (s.kategori ? " · " + s.kategori : "") }))] };
    const ce = { t: "Company Expenses", tot: "Total Expenses", rows: neg(PS.sec.exp) };
    const bs = { t: "Company Board Salary", tot: "Total Company Board Salary Expenses", rows: [...P.owners.map(o => ({ l: o.nama, v: -o.v, note: P.gajiSet ? "owner" : "owner · belum diinput" })), ...neg(PS.staff)] };
    const ho = { t: "Company Head Office Expenses", tot: "Total Company HO Expenses", rows: neg(PS.sec.ho) };
    const rent = { t: "Rent & Mortgage Expenses", tot: "Total Monthly Rent Expenses", rows: neg(PS.sec.rent) };
    const ot = { t: "Other Expenses", tot: "Total Other Expenses", rows: [...neg(PS.sec.oth), ...(P.wl ? [{ l: "Komisi Walters Lash " + perName(k), v: -P.wl, note: P.WL.pct + "% × omzet " + fA(P.WL.om) + " · 100% ke " + P.partner }] : [])] };
    const secs = [inc, oth, ce, bs, ho, rent, ot]; secs.forEach(sc => sc.T = sumOf(sc.rows, r => r.v));
    const exp = ce.T + bs.T + ho.T + rent.T + ot.T;
    return { P, secs, exp, net: inc.T + oth.T + exp };
  }
  function globalHtml(k){
    const G = globalModel(k), R = rptCfg();
    let h = stampOf(k) + `<div class="rp-h rb"><b>Lash Bounty Global</b><span>Income Statement for the ${isTok(k) ? "" : "Month Ended "}${esc(rptName(k))}</span><small>Profit semua cabang ditarik ke pusat · ${esc(perRange(k))}</small></div>`;
    const tail = `<tr class="rp-tot2"><td><b>Total Company Expenses</b></td><td class="r"><b>${fA(G.exp)}</b></td><td class="n"></td></tr><tr class="rp-gap"><td colspan="3"></td></tr>` +
      `<tr class="rp-net ${G.net < 0 ? "neg" : ""}"><td><b>Total Company Net Income</b></td><td class="r"><b>${fA(G.net)}</b></td><td class="n">${G.secs[0].T ? "margin " + pct(G.net / (G.P.I.sales || 1)) + " dari omzet internal" : ""}</td></tr>`;
    h += stmtTable(G.secs, tail);
    h += ttdBlock(k);
    return h + paperFoot(k);
  }
  // 3) Expertise (laporan keuangan profesional, konsolidasi + segmen + rasio + catatan)
  function expertHtml(k){
    const cabs = cabList(), pk = prevKey(k), C = companyPL(k), CP = companyPL(pk), I = C.I, P = CP.I, IA = incomeStmt(cabs, k), PS = C.PS, PP = CP.PS;
    const netAll = C.bersih, netPrev = CP.bersih, Seg = cabs.map(c => ({ c, I: incomeStmt([c], k) }));
    const kat = (X, ks) => sumOf(X.B.filter(p => ks.includes(p.kategori)), p => p.jumlah), util = X => sumOf(MONTHLY, ([, ks]) => kat(X, ks));
    const chg = (a, b) => b ? `<span class="${a - b >= 0 ? "up-g" : "dn-r"}">${a - b >= 0 ? "+" : ""}${pct((a - b) / Math.abs(b))}</span>` : "–";
    const chgC = (a, b) => b ? `<span class="${a - b <= 0 ? "up-g" : "dn-r"}">${a - b >= 0 ? "+" : ""}${pct((a - b) / Math.abs(b))}</span>` : "–";
    const R = (l, a, b, cls = "", cost = false) => `<tr class="${cls}"><td>${l}</td><td class="r">${fAcc(cost ? -a : a)}</td><td class="r">${pctS(a, I.sales)}</td><td class="r">${fAcc(cost ? -b : b)}</td><td class="r">${cost ? chgC(a, b) : chg(a, b)}</td></tr>`;
    const cl = tokKeys(k).map(m => S.closing[m]).filter(Boolean).pop();
    let h = stampOf(k) + `<div class="rp-cover rb"><span class="rp-k">Laporan Keuangan · Tutup Buku</span><b>Lash Bounty</b><span>Laporan Laba Rugi Internal (termasuk bagi hasil cabang ${esc(C.partner || "-")}), Segmen Cabang, Analisis Rasio & Catatan</span>
      <div class="rp-meta"><div><small>Periode</small><b>${esc(mName(k))}</b><span>${esc(perRange(k))}</span></div><div><small>Pembanding</small><b>${esc(mName(pk))}</b><span>${esc(perRange(pk))}</span></div><div><small>Status</small><b>${esc(closedInfo(k))}</b><span>${cl?.closedBy ? "oleh " + esc(cl.closedBy) : "&nbsp;"}</span></div><div><small>Dicetak</small><b>${esc(printed())}</b><span>Lash Bounty ERP</span></div></div></div>`;
    // 1. ringkasan eksekutif
    const best = [...Seg].sort((a, b) => b.I.net - a.I.net)[0], worst = [...Seg].sort((a, b) => a.I.net - b.I.net)[0];
    const bigCost = [["Gaji & komisi", I.salT + I.komT], ["HPP", I.hppT], ["Sewa", I.rentT], ["Utilitas", I.monT], ["Lain-lain cabang", I.othT], ["Kantor pusat", PS.total]].sort((a, b) => b[1] - a[1])[0];
    h += `<div class="rp-h2 rb">1. Ringkasan eksekutif</div><div class="rp-kpis rb">` + [["Pendapatan", fAcc(I.sales), chg(I.sales, P.sales) + " vs lalu"], ["Laba kotor", fAcc(I.gross), "GPM " + pctS(I.gross, I.sales)], ["Total beban", fAcc(I.exp + PS.total + I.hppT + C.gajiOwner), "cabang + pusat + HPP + gaji owner"], ["Laba bersih", fAcc(netAll), "NPM " + pctS(netAll, I.sales) + " · " + chg(netAll, netPrev)]]
      .map(([l, v, s]) => `<div><small>${l}</small><b>${v}</b><span>${s}</span></div>`).join("") + `</div>`;
    h += `<ul class="rp-ul rb">${[I.sales ? `Pendapatan ${mName(k)} ${fAcc(I.sales)}, ${P.sales ? (I.sales >= P.sales ? "naik" : "turun") + " " + pct(Math.abs(I.sales - P.sales) / P.sales) + " dibanding " + mName(pk) : "belum ada pembanding periode lalu"}.` : "Belum ada pendapatan tercatat di periode ini.",
      best && Seg.length > 1 ? `Cabang dengan laba kontribusi tertinggi: ${shortCab(best.c)} (${fAcc(best.I.net)}); terendah: ${shortCab(worst.c)} (${fAcc(worst.I.net)}).` : "",
      bigCost && bigCost[1] ? `Beban terbesar: ${bigCost[0]} ${fAcc(bigCost[1])} (${pctS(bigCost[1], I.sales)} dari pendapatan).` : "",
      `Rasio gaji & komisi terhadap pendapatan ${pctS(I.salT + I.komT, I.sales)}; sewa ${pctS(I.rentT, I.sales)}.`].filter(Boolean).map(t => `<li>${esc(t)}</li>`).join("")}</ul>`;
    // 2. laba rugi konsolidasi komparatif
    h += `<div class="rp-h2 rb">2. Laporan laba rugi Internal</div><table class="rp-t rp-x"><thead><tr><th>Keterangan (Rp)</th><th class="r">${esc(mName(k))}</th><th class="r">% pendapatan</th><th class="r">${esc(mName(pk))}</th><th class="r">Perubahan</th></tr></thead><tbody>`;
    h += `<tr class="rp-sub"><td colspan="5">Pendapatan usaha</td></tr>`;
    grups().filter(g => g !== C.partner).forEach(g => { const cs = cabsOfGrup(g), a = incomeStmt(cs, k), b = incomeStmt(cs, pk); h += R(`<span class="ind">Penjualan jasa (Zenwel) · ${esc(g)}</span>`, a.zen, b.zen); });
    h += R(`<span class="ind">Pendapatan lain (manual)</span>`, I.man, P.man) + R("<b>Total pendapatan</b>", I.sales, P.sales, "rp-tot");
    h += `<tr class="rp-sub"><td colspan="5">Harga pokok penjualan</td></tr>` + R(`<span class="ind">Stok bahan</span>`, sumOf(I.hpp.filter(x => x.src === "bc"), x => x.v), sumOf(P.hpp.filter(x => x.src === "bc"), x => x.v), "", true) + R(`<span class="ind">Bahan habis pakai (petty cash)</span>`, sumOf(I.hpp.filter(x => x.src === "pc"), x => x.v), sumOf(P.hpp.filter(x => x.src === "pc"), x => x.v), "", true);
    h += R("Total HPP", I.hppT, P.hppT, "rp-tot", true) + R("<b>LABA KOTOR</b>", I.gross, P.gross, "rp-big");
    h += `<tr class="rp-sub"><td colspan="5">Beban operasional cabang</td></tr>` + R(`<span class="ind">Beban gaji</span>`, I.salT, P.salT, "", true) + R(`<span class="ind">Beban komisi</span>`, I.komT, P.komT, "", true) + R(`<span class="ind">Utilitas (IPL, listrik, air, internet)</span>`, util(I), util(P), "", true);
    h += R(`<span class="ind">Sewa & cicilan tempat</span>`, I.rentT, P.rentT, "", true) + R(`<span class="ind">Belanja keperluan cabang</span>`, I.other[0].v, P.other[0].v, "", true);
    ["Ads / iklan", "Refund customer", "Biaya admin EDC & QR", "Perbaikan cabang", "Lain-lain"].forEach(c => { const a = kat(I, [c]), b = kat(P, [c]); if (a || b) h += R(`<span class="ind">${esc(c)}</span>`, a, b, "", true); });
    h += R("Total beban operasional cabang", I.exp, P.exp, "rp-tot", true) + R("<b>LABA OPERASIONAL CABANG INTERNAL</b>", I.net, P.net, "rp-big");
    if (C.partner) h += `<tr class="rp-sub"><td colspan="5">Pendapatan dari cabang ${esc(C.partner)}</td></tr>` + R(`<span class="ind">Bagi hasil ${100 - C.pct}% × net income ${fAcc(C.wNet)}</span>`, C.share, CP.share) + R(`<span class="ind">Online advertisement & admin fee cabang ${esc(C.partner)}</span>`, C.ads + C.fee, CP.ads + CP.fee);
    if (C.othInc || CP.othInc) h += R(`<span class="ind">Pendapatan lain kantor pusat</span>`, C.othInc, CP.othInc);
    h += `<tr class="rp-sub"><td colspan="5">Beban kantor pusat</td></tr>`; PS.kat.forEach(x => { const b = PP.kat.find(y => y.label === x.label)?.v || 0; if (x.v || b) h += R(`<span class="ind">${esc(x.label)}</span>`, x.v, b, "", true); });
    h += R(`<span class="ind">Payroll pusat</span>`, PS.pr, PP.pr, "", true) + R("Total beban pusat", PS.total, PP.total, "rp-tot", true) + (C.wl || CP.wl ? R(`<span class="ind">Komisi Walters Lash ${C.WL.pct}% ke ${esc(C.partner || "partner")}</span>`, C.wl, CP.wl, "", true) : "") + R("<b>LABA SEBELUM GAJI OWNER</b>", C.sebelum, CP.sebelum, "rp-big") + C.owners.map(o => R(`<span class="ind">Gaji ${esc(o.nama)}${C.gajiSet ? "" : " (belum diinput)"}</span>`, o.v, CP.owners.find(y => y.nama === o.nama)?.v || 0, "", true)).join("") + R("<b>LABA (RUGI) BERSIH</b>", netAll, netPrev, "rp-net" + (netAll < 0 ? " neg" : "")) + `</tbody></table>`;
    // 3. segmen
    h += `<div class="rp-h2 rb">3. Laporan segmen per cabang</div><table class="rp-t rp-x"><thead><tr><th>Rp</th>${Seg.map(x => `<th class="r">${esc(shortCab(x.c))}<small>${esc(grupOf(x.c))}</small></th>`).join("")}<th class="r">Pusat</th><th class="r">Total</th></tr></thead><tbody>`;
    const segRow = (l, f, pv, cls = "") => `<tr class="${cls}"><td>${l}</td>${Seg.map(x => `<td class="r">${fAcc(f(x.I))}</td>`).join("")}<td class="r">${pv == null ? "–" : fAcc(pv)}</td><td class="r">${fAcc(f(IA) + (pv || 0))}</td></tr>`;
    h += segRow("Pendapatan", X => X.sales, null) + segRow("HPP", X => -X.hppT, null) + segRow("<b>Laba kotor</b>", X => X.gross, null, "rp-tot") + segRow("Beban gaji & komisi", X => -(X.salT + X.komT), -PS.pr) + segRow("Beban sewa & utilitas", X => -(X.rentT + X.monT), null) + segRow("Beban lain-lain", X => -X.othT, -(PS.total - PS.pr));
    h += segRow("<b>Laba kontribusi</b>", X => X.net, -PS.total, "rp-big") + `<tr><td><span class="note">Margin kontribusi</span></td>${Seg.map(x => `<td class="r">${pctS(x.I.net, x.I.sales)}</td>`).join("")}<td class="r">–</td><td class="r">${pctS(IA.net - PS.total, IA.sales)}</td></tr></tbody></table><p class="note rb" style="margin:6px 0 0">Kolom total = semua cabang 100% sebelum bagi hasil.</p>`;
    // 4. rasio
    const emp = tokKeys(k).flatMap(mk => S.prDocs[mk]?.rows || []).filter(r => cabs.includes(r.cabang)).length, empP = tokKeys(pk).flatMap(mk => S.prDocs[mk]?.rows || []).filter(r => cabs.includes(r.cabang)).length;
    const ratio = [["Gross profit margin", I.gross / I.sales, P.gross / P.sales, "laba kotor ÷ pendapatan"], ["Rasio HPP", I.hppT / I.sales, P.hppT / P.sales, "HPP ÷ pendapatan"], ["Rasio gaji & komisi", (I.salT + I.komT) / I.sales, (P.salT + P.komT) / P.sales, "beban SDM cabang ÷ pendapatan"],
      ["Rasio sewa", I.rentT / I.sales, P.rentT / P.sales, "sewa ÷ pendapatan"], ["Rasio beban operasional", I.exp / I.sales, P.exp / P.sales, "beban cabang ÷ pendapatan"], ["Net profit margin", netAll / I.sales, netPrev / P.sales, "laba bersih ÷ pendapatan"]];
    h += `<div class="rp-h2 rb">4. Analisis rasio</div><table class="rp-t"><thead><tr><th>Rasio</th><th class="r">${esc(mName(k))}</th><th class="r">${esc(mName(pk))}</th><th>Rumus</th></tr></thead><tbody>` +
      ratio.map(([l, a, b, f]) => `<tr><td>${l}</td><td class="r">${isFinite(a) ? pct(a) : "–"}</td><td class="r">${isFinite(b) ? pct(b) : "–"}</td><td class="note">${f}</td></tr>`).join("") +
      `<tr><td>Pendapatan per karyawan cabang</td><td class="r">${emp ? fAcc(I.sales / emp) : "–"}</td><td class="r">${empP ? fAcc(P.sales / empP) : "–"}</td><td class="note">pendapatan ÷ jumlah karyawan di payroll</td></tr></tbody></table>`;
    // 5. catatan
    const days = cabs.map(c => [c, elapsedDays(k) - new Set(S.sales.filter(s => s.cabang === c && s.sumber !== "Manual" && inPer(s.tanggal, k)).map(s => s.tanggal)).size]).filter(x => x[1] > 0);
    const ns = I.pc.filter(r => r.tanpaStruk), big = bigList(k).filter(x => !x.cek), selisih = cabs.map(c => [c, kartu(c, S.month).rows.filter(r => r.sel != null && r.sel !== 0).length]).filter(x => x[1]);
    const asNil = sumOf(S.aset, a => (a.qty || 0) * (a.nilai || 0)), prSt = tokKeys(k).map(mk => S.prDocs[mk] ? mName(mk) + ": " + (S.prDocs[mk].status === "final" ? "dibayar" : "draft") : mName(mk) + ": belum ada").join("; ");
    const notes = [["Dasar penyusunan", `Disusun dari data yang diinput di Lash Bounty ERP dengan basis kas. Periode tutup buku memakai cut-off tanggal 26 (27 bulan sebelumnya s/d 26 bulan berjalan). Status: ${closedInfo(k)}.`],
      ["Pengakuan pendapatan", `Pendapatan jasa berasal dari laporan harian Zenwel per cabang, ditambah pendapatan lain yang diinput manual (${fAcc(I.man)}). ${days.length ? "Laporan Zenwel belum lengkap: " + days.map(([c, n]) => shortCab(c) + " kurang " + n + " hari").join(", ") + ", sehingga pendapatan bisa lebih rendah dari aktual." : "Laporan Zenwel lengkap untuk semua cabang."}`],
      ["Harga pokok penjualan", `HPP terdiri dari stok bahan yang dicatat sebagai biaya cabang kategori "Stok bahan (HPP)" dan pembelian bahan habis pakai lewat petty cash yang diklasifikasikan HPP (${I.hpp.filter(x => x.src === "pc").length} transaksi). Persediaan akhir belum diperhitungkan sebagai pengurang HPP.`],
      ["Beban gaji & komisi", `Diambil dari lembar payroll per penempatan karyawan, termasuk insentif KPI dan potongan. Status payroll: ${prSt}.`],
      ["Transaksi tanpa bukti", ns.length ? `${ns.length} transaksi petty cash tanpa struk senilai ${fAcc(sumOf(ns, r => r.jumlah))}, dicatat dengan rincian manual.` : "Semua transaksi petty cash memiliki bukti/nota."],
      ["Pengeluaran besar", big.length ? `${big.length} pengeluaran di atas ${fAcc(hrCfg().notifMin)} belum ditandai dicek oleh owner.` : `Semua pengeluaran di atas ${fAcc(hrCfg().notifMin)} sudah dicek.`],
      ["Persediaan", selisih.length ? "Terdapat selisih stock opname: " + selisih.map(([c, n]) => shortCab(c) + " " + n + " barang").join(", ") + "." : "Tidak ada selisih stock opname yang tercatat (atau opname belum diinput)."],
      ["Aset tetap", S.aset.length ? `Tercatat ${S.aset.length} jenis aset dengan nilai perolehan ${fAcc(asNil)}. Penyusutan belum dicatat di laporan ini.` : "Daftar aset belum diisi."],
      ["Beban kantor pusat", `Beban pusat (${fAcc(PS.total)}) tidak dialokasikan ke cabang; ditampilkan terpisah di bawah laba operasional cabang.`],
      ["Bagi hasil cabang " + (C.partner || "partner"), C.partner ? `Profit cabang ${C.partner} ${fAcc(C.W.net)} dikurangi online advertisement ${fAcc(C.ads)} dan office + admin fee ${fAcc(C.fee)} = net income ${fAcc(C.wNet)}, dibagi ${C.pct}% untuk ${C.partner} dan ${100 - C.pct}% untuk Internal (${fAcc(C.share)}). Ads & admin fee dicatat sebagai pendapatan Internal. Komisi Walters Lash ${fAcc(C.wl)} (${C.WL.pct}% omzet treatment Walters Lash di cabang internal) diberikan 100% ke ${C.partner} dan dicatat sebagai beban Internal.` : "Tidak ada grup bagi hasil yang diatur."],
      ["Gaji owner", C.gajiSet ? `Gaji owner ${C.owners.map(o => o.nama + " " + fAcc(o.v)).join(", ")} (total ${fAcc(C.gajiOwner)}) diinput saat pre-final dan dikurangkan setelah laba sebelum gaji owner.` : "Gaji owner belum diinput; laba bersih masih sebelum gaji owner."]];
    h += `<div class="rp-h2 rb">5. Catatan atas laporan keuangan</div>` + notes.map(([t, d], i) => `<div class="rp-note rb"><b>5.${i + 1} ${esc(t)}</b><p>${esc(d)}</p></div>`).join("");
    // lampiran
    h += `<div class="rp-h2 rb">Lampiran A. Rincian beban cabang per kategori</div><table class="rp-t rp-x"><thead><tr><th>Kategori</th>${cabs.map(c => `<th class="r">${esc(shortCab(c))}</th>`).join("")}<th class="r">Total</th></tr></thead><tbody>` +
      [["Petty cash · bahan (HPP)", X => sumOf(X.hpp.filter(x => x.src === "pc"), x => x.v)], ["Petty cash · keperluan cabang", X => X.other[0].v], ...CAB_KAT_ALL.map(c => [c, X => kat(X, [c])]), ["Gaji", X => X.salT], ["Komisi", X => X.komT]]
        .filter(([, f]) => f(IA)).map(([l, f]) => `<tr><td>${esc(l)}</td>${Seg.map(x => `<td class="r">${fAcc(f(x.I))}</td>`).join("")}<td class="r">${fAcc(f(IA))}</td></tr>`).join("") + `</tbody></table>`;
    if (ns.length) h += `<div class="rp-h2 rb">Lampiran B. Transaksi petty cash tanpa struk</div><table class="rp-t"><thead><tr><th>Tanggal</th><th>Cabang</th><th>Keterangan</th><th>Diisi oleh</th><th class="r">Jumlah</th></tr></thead><tbody>` +
      ns.slice(0, 30).map(r => `<tr><td>${esc(fmtDate(r.tanggal))}</td><td>${esc(shortCab(r.cabang))}</td><td>${esc(r.keterangan)}</td><td>${esc(r.pengisi || "–")}</td><td class="r">${fAcc(r.jumlah)}</td></tr>`).join("") + `</tbody></table>`;
    h += ttdBlock(k);
    return h + paperFoot(k);
  }
  const RPT_KINDS = ["acc/tutup/simple","acc/tutup/wendy","acc/tutup/global","acc/tutup/expert"];
  function renderRpt(){
    const t = S.leaf; if (!RPT_KINDS.includes(t)) return;
    if (!adminGate("tbBody", "tbRO")) return;
    const k = S.rk, kind = t.split("/")[2];
    const cabs = cabList(); fillSelect($("rpCab"), cabs, $("rpCab").value || ls.get("lb-rpcab") || cabs[0]);
    const G = grups(), BH = bhCfg(); fillSelect($("rpGrup"), G, $("rpGrup").value || (G.includes(BH.grup) ? BH.grup : G[0]));
    $("rpCab").hidden = kind !== "simple"; $("rpGrup").hidden = kind !== "wendy";
    const c = $("rpCab").value, g = $("rpGrup").value, isP = g === BH.grup, R = rptCfg();
    $("rpEyebrow").textContent = "Tutup buku · " + { simple:"Simple", wendy:"Cabang " + (g || "Wendy"), global:"Global", expert:"Expertise" }[kind];
    $("rpTitle").textContent = { simple:"Income statement " + shortCab(c || ""), wendy: isP ? "Lash Bounty X " + R.partnerNama : "Laporan gabungan cabang " + (g || ""), global:"Summary Global income statement", expert:"Laporan keuangan lengkap" }[kind] + " · " + mName(k);
    $("rpNote").textContent = { simple:"Format sama dengan laporan bulanan per cabang: Sales → COGS → Gross Profit → Expenses → Net Profit. Biaya ditulis minus.",
      wendy: isP ? `Laporan untuk partner: profit ${cabsOfGrup(g).map(shortCab).join(" + ")}, pendapatan Walters Lash ${R.wlPct}% dari cabang internal (100% untuk partner, tidak dibagi), lalu Company Expenses (ads) & Office Expenses (admin fee); net income dibagi ${BH.pct}:${100 - BH.pct}. Lampiran berisi income statement tiap cabang.` : "Gabungan " + cabsOfGrup(g).map(shortCab).join(" + ") + " dengan kolom per cabang dan total grup.",
      global:"Profit cabang internal ditarik ke pusat, ditambah other income (ads & admin fee + bagi hasil Wendy + pendapatan pusat), dikurangi beban pusat, gaji owner & board, dan komisi Walters Lash = net income sesungguhnya.",
      expert:"Konsolidasi semua cabang + pusat, dibandingkan dengan " + mName(prevKey(k)) + ", lengkap dengan laporan segmen, rasio, catatan, lampiran, dan kolom tanda tangan." }[kind] + " " + closedInfo(k) + ".";
    if (S.db && (!S.rowsLoaded || !S.salesLoaded || !S.psLoaded)) { $("paper").innerHTML = `<div class="empty">Memuat data…</div>`; return; }
    $("paper").innerHTML = logoHtml() + (kind === "simple" ? (c ? simpleHtml(c, k) : `<div class="empty">Belum ada cabang.</div>`) : kind === "wendy" ? (g ? grupHtml(g, k) : `<div class="empty">Belum ada grup cabang.</div>`) : kind === "global" ? globalHtml(k) : expertHtml(k));
    $("hppPanel").hidden = kind === "global";
    // klasifikasi petty cash
    const pcs = S.rows.filter(r => inPer(r.tanggal, k) && (kind !== "simple" || r.cabang === c) && (kind !== "wendy" || grupOf(r.cabang) === g)).sort((a, b) => (a.tanggal || "").localeCompare(b.tanggal || ""));
    $("hppHint").textContent = pcs.length ? pcs.filter(isHpp).length + " HPP · " + pcs.filter(r => !isHpp(r)).length + " keperluan cabang" : "";
    $("hppTable").innerHTML = pcs.length ? `<thead><tr><th>Tanggal</th><th>Cabang</th><th>Keterangan</th><th class="r">Jumlah</th><th>Masuk ke</th></tr></thead><tbody>` +
      pcs.map(r => { const h = isHpp(r), auto = r.hpp == null; return `<tr><td class="num">${esc(fmtDate(r.tanggal))}</td><td>${esc(shortCab(r.cabang))}</td><td class="k">${esc(r.keterangan)}</td><td class="r num">${fmt(r.jumlah)}</td>
        <td><div class="seg2"><button type="button" data-hpp="${esc(r.id)}|1" aria-pressed="${h}">HPP${h && auto ? "*" : ""}</button><button type="button" data-hpp="${esc(r.id)}|0" aria-pressed="${!h}">Keperluan${!h && auto ? "*" : ""}</button></div></td></tr>`; }).join("") + `</tbody>`
      : `<tr><td class="empty">Tidak ada petty cash di periode ini.</td></tr>`;
  }
  ["rpCab","rpGrup"].forEach(id => $(id).addEventListener("change", e => { if (id === "rpCab") ls.set("lb-rpcab", e.target.value); renderRpt(); }));
  $("hppTable").addEventListener("click", async e => { const b = e.target.closest("[data-hpp]"); if (!b || !S.db) return; const [id, v] = b.dataset.hpp.split("|"), r = S.rows.find(x => x.id === id);
    const lk = r ? lockOf(r.tanggal) : ""; if (lk) { toast(lk); return; }
    try { await S.db.doc("expenses/" + id).update({ hpp: v === "1" }); } catch { toast("Gagal menyimpan klasifikasi"); } });
  let jsPdfP = null;
  const loadJsPdf = () => jsPdfP ||= new Promise((res, rej) => { if (window.jspdf) return res(window.jspdf); const sc = document.createElement("script");
    sc.charset = "utf-8"; sc.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; sc.onload = () => res(window.jspdf); sc.onerror = () => { jsPdfP = null; rej(new Error("load")); }; document.head.appendChild(sc); });
  $("rpPdf").addEventListener("click", async () => {
    if (!S.dl) { toast("Download tidak tersedia di tampilan ini"); return; }
    const el = $("paper"), btn = $("rpPdf"); btn.disabled = true; btn.textContent = "Membuat PDF…";
    try {
      const [h2c, J] = await Promise.all([loadH2C(), loadJsPdf()]), scale = 2;
      const canvas = await h2c(el, { scale, backgroundColor: "#ffffff", useCORS: true, logging: false });
      const top0 = el.getBoundingClientRect().top, forced = [...el.querySelectorAll(".pb")].map(n => Math.round((n.getBoundingClientRect().top - top0) * scale) - 8), cuts = [...el.querySelectorAll("tr, .rb")].map(n => Math.round((n.getBoundingClientRect().bottom - top0) * scale)).sort((a, b) => a - b);
      const pdf = new J.jsPDF({ unit: "mm", format: "a4" }), pw = 210, ph = 297, m = 10, cw = pw - 2 * m, pxmm = canvas.width / cw, pageH = Math.floor((ph - 2 * m - 6) * pxmm);
      let y = 0, page = 0;
      while (y < canvas.height - 4) {
        let end = Math.min(y + pageH, canvas.height);
        const fb = forced.find(v => v > y + 60 && v < end);
        if (fb) end = fb; else if (end < canvas.height) { const c = cuts.filter(v => v > y + 60 && v <= end); if (c.length) end = c[c.length - 1]; }
        const sl = document.createElement("canvas"); sl.width = canvas.width; sl.height = end - y;
        const cx = sl.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, sl.width, sl.height); cx.drawImage(canvas, 0, y, canvas.width, end - y, 0, 0, canvas.width, end - y);
        if (page) pdf.addPage(); pdf.addImage(sl.toDataURL("image/jpeg", 0.92), "JPEG", m, m, cw, (end - y) / pxmm);
        pdf.setFontSize(8); pdf.setTextColor(130); pdf.text("Lash Bounty ERP · " + $("rpTitle").textContent, m, ph - 6); pdf.text("Halaman " + (page + 1), pw - m, ph - 6, { align: "right" });
        y = end; page++;
      }
      const name = "Tutup Buku " + $("rpEyebrow").textContent.replace("Tutup buku · ", "") + " " + ($("rpCab").hidden ? "" : shortCab($("rpCab").value) + " ") + mName(S.rk) + ".pdf";
      await S.dl.save({ filename: name, data: pdf.output("blob") }); toast("PDF disimpan"); void rpFileName;
    } catch (err) { if (err?.code !== "declined") toast("Gagal membuat PDF. Coba lagi."); }
    finally { btn.disabled = false; btn.textContent = "Export PDF"; }
  });

  /* ---------- Ask Me! ---------- */
  const GUIDE = `Kamu adalah "Ask Me!", asisten bantuan di aplikasi Lash Bounty ERP (salon lash & nail multi-cabang: Gading Serpong & Pluit = grup Internal, Tebet & Bekasi = grup Wendy). Jawab dalam bahasa Indonesia santai, singkat, langkah demi langkah. Sebut menu dengan format "Menu → Sub menu → Halaman". Kalau tidak tahu atau fitur belum ada, bilang terus terang dan sarankan hubungi admin. Jangan mengarang fitur. Jangan pakai judul markdown; boleh pakai daftar bernomor atau "- ".

STRUKTUR MENU (kolom utama → sekunder → tersier):
- [Baru v1.1] Dashboard → Mobile (preview iPhone/Android + QR & cara pasang aplikasi di HP).
- [Baru v1.1] Accounting → Import → CSV / Excel / PDF (template; PDF & foto dibaca AI) dan Import AI (chat) untuk memasukkan tutup buku / omzet bulan-bulan sebelumnya: upload file, jawab pertanyaan AI, cek tabel usulan, klik Masukkan ke sistem.
- [Baru v1.1] Accounting → Refund: ajukan refund (garansi, salah transfer, lebih transfer, transaksi dobel, lainnya) → Owner menyetujui/menolak → admin Tandai ditransfer (opsional catat biaya Refund customer).
- [Baru v1.1] Accounting → Tutup Buku → Edit & Penyesuaian (Talk to AI mengusulkan perubahan, atau edit manual / tambah penyesuaian; hanya periode yang belum final) dan Riwayat (buka & download PDF laporan per periode). Laporan final ditandatangani: Dibuat oleh (Head of admin) & Diketahui oleh (Owner) dari tombol di atas laporan; tanda tangan dibuat di Pengaturan → Akun saya. Tombol Kirim… mengirim laporan PDF lewat email / WA.
- [Baru v1.1] Banking → Tabungan Sewa: setoran 10 jt/bulan Tebet & Bekasi ke rekening pribadi Kevin, otomatis jadi biaya "Biaya sewa tempat (ditabung)" di cabang; penarikan saat bayar sewa tahunan.
- [Baru v1.1] Persediaan → Permintaan Barang (cabang minta ke pusat → Head of admin proses: menunggu pesanan / dikirim + estimasi → cabang klik Sudah diterima, stok bertambah, tidak memengaruhi HPP; lewat 3 hari owner dinotifikasi). Persediaan → Stok Barang → Grafik Pemakaian. Persediaan → Aset: tombol Musnahkan untuk unit rusak + Berita Acara Pemusnahan; piutang kasbon karyawan.
- [Baru v1.1] HRD → Kasbon (catat kasbon dari rekening pusat & pengembalian; potongan gaji di Payroll kolom Pot. kasbon), HRD → Pengumuman (email + Telegram + daftar WA). Data Karyawan → Lengkapi (alamat, KTP, HP, email, kontak darurat, bank, rekening).
- [Baru v1.1] Pengaturan → Integrasi & logo (Telegram, email, Google Sheet, backup jam 02:00, upload logo) dan Pengaturan → Akun saya (ganti password, tanda tangan). Tombol tema terang/gelap di header. Setiap link khusus punya tombol QR.
- Dashboard → Ringkasan (omzet per grup & per tanggal, promo & layanan terlaris, top therapist [butuh export Zenwel per staff], pengeluaran cabang s/d hari ini, perlu perhatian, ringkasan AI), Notifikasi (pengeluaran di atas batas, tombol Tandai dicek), Bandingkan bulan (pilih 2–6 bulan).
- Accounting → Jurnal Pengeluaran → Input Pengeluaran (form petty cash cabang: tanggal, jumlah, keterangan, no nota, nama pengisi; centang "Tidak ada struk" untuk isi rincian barang manual; tombol Scan nota pakai AI).
- Accounting → Jurnal Pengeluaran → Biaya Cabang (halaman terpisah, khusus admin: biaya cabang di luar petty cash dengan kategori Stok bahan (HPP), Sewa/mortgage, IPL, Listrik, PAM/air, Internet & telepon, Perbaikan cabang, Refund customer, Biaya admin EDC & QR, Ads / iklan, Lain-lain + "Dibayar dari"; ada scan nota, ringkasan per kategori per cabang, dan jurnalnya).
- Accounting → Jurnal Pengeluaran → Report Pengeluaran (tabel per cabang per kelompok biaya, petty cash perlu dicek, ringkasan AI, jurnal bernomor JP-, filter, Download CSV, tombol Hapus untuk admin).
- Accounting → Jurnal Pengeluaran → Pengeluaran Pusat (khusus admin; input biaya pusat + scan nota; kategori Petty cash pusat, Sewa, Listrik, Kendaraan & leasing, Marketing, Lain-lain; payroll penempatan Pusat otomatis masuk).
- Accounting → Omzet → Input Omzet (import CSV Zenwel "Sales by item" per cabang per hari; input omzet manual di luar Zenwel) dan Report Omzet (KPI, omzet vs petty cash, jurnal masuk, layanan terlaris).
- Accounting → Tutup Buku → Checklist & kunci (cek kelengkapan, laba rugi Internal, lalu 3 langkah: 1) Hitung pre-final = semua dihitung sebelum gaji owner dan bisa dilihat di preview laporan berstempel PRE-FINAL, 2) Head of admin (Yuli) input Gaji owner bulan itu, 3) Tutup buku final: data periode terkunci; bisa Buka kembali), Simple (income statement per cabang persis format laporan bulanan: Sales, COGS, Gross Profit, Salary, Commision, Monthly, Rent & Mortgage, Other, Net Profit), Cabang Wendy (gabungan Tebet + Bekasi dengan kolom per cabang; di akhir net profit dibagi 50% Wendy : 50% Internal; bagian Internal dicatat sebagai "Pendapatan cabang Wendy" dan biaya Ads cabang Wendy dicatat sebagai "Pendapatan ads cabang Wendy" di laporan Internal; porsi bisa diubah di Pengaturan → Notifikasi & absensi), Expertise (laporan profesional: konsolidasi komparatif, segmen, rasio, catatan, lampiran, tanda tangan). Semua laporan punya tombol Export PDF. Di bawah laporan ada Klasifikasi petty cash: tandai HPP (bahan) atau Keperluan cabang.
- Accounting → Import CSV (pilih jenis data, Download template, isi di Excel/Google Sheet, upload, cek, Import; jenis: petty cash, biaya cabang, pengeluaran pusat, omzet manual, absensi, aset).
- Persediaan → Stok Barang → Input Stok (opening stock, masuk/keluar, stock opname; bisa isi dari foto lembar stok), Kartu Stok (opening + masuk − keluar = saldo vs opname = selisih), Posisi Stok (stok terakhir semua cabang, merah = di bawah minimum), Riwayat. Persediaan → Aset (aset per lokasi cabang & pusat, unit rusak, nilai).
- HRD → Data Karyawan (master nama, jabatan, penempatan, aktif), Absensi (grid per tanggal H/T/I/S/C/A/L, klik kotak untuk koreksi pusat, link check-in per cabang), Payroll (absensi, gaji pokok, tunjangan, bonus, komisi, KPI otomatis, potongan, no WA; tombol Isi absensi otomatis, Ambil dari data karyawan, Salin dari periode lalu, Simpan, Tandai sudah dibayar, Slip), KPI (25 poin, poin dihitung kalau MOD, Trainer, Owner semua centang; 1 poin Rp 36.000, minimal 13 poin; komplain Low/Medium/High mengurangi; Google review +Rp 30.000; komentar 3 atasan muncul di slip), Cek Slip (riwayat slip per karyawan, lihat, download gambar, salin teks, kirim via WA).
- Ask Me! (halaman ini). Pengaturan → Cabang & link (daftar cabang + grup Internal/Wendy, link khusus cabang & link check-in absensi), Barang stok, Notifikasi & absensi (no WA owner, batas notif default Rp 500.000, jam masuk & toleransi telat), Role & akses (akun login username & password dibuat oleh Owner atau Head of admin; role Owner, Head of admin, Admin keuangan, HRD, Manager cabang, Staff cabang; level Tidak/Lihat/Edit per menu; permintaan lupa password disetujui Owner), Riwayat perubahan (audit siapa ubah apa kapan), Data & backup (download Excel semua data untuk dibuka di Google Sheets; hapus data contoh).
- TAMBAHAN v15: Accounting → Tutup Buku → Global = Summary Global income statement: Profit tiap cabang internal → Total Income; Other income (Online Advertisement & Admin fee dari Tebet & Bekasi, bagi hasil 50% net income Wendy, pendapatan lain Kantor Pusat); Company Expenses (Marketing/Ads IG pusat); Company Board Salary (Gaji Kevin & Gaji Reyza + payroll karyawan Kantor Pusat); Company Head Office Expenses; Rent & Mortgage; Other Expenses (petty cash pusat, operasional trainer, penyesuaian kas, Komisi Walters Lash) → Total Company Net Income, tanda tangan Approved by Kevin / Prepared by Yulianti.
- Cabang Wendy = laporan "Lash Bounty X Wendy Walters": Profit Tebet + Profit Bekasi, Pendapatan Walters Lash (30% omzet treatment Walters Lash di cabang internal GS & Pluit; Tebet & Bekasi tidak dipotong; 100% untuk Wendy, TIDAK ikut dibagi 50:50), Company Expenses (biaya kategori "Ads / iklan" cabang Wendy), Office Expenses (kategori "Office + admin fee"), Total Company Net Income (= Total Income − expenses) dibagi 50:50, lalu Total diterima Wendy = 50% + Walters Lash; lampiran income statement tiap cabang. Ads & office fee cabang Wendy diinput di Biaya Cabang.
- Gaji owner diisi terpisah: Gaji Kevin dan Gaji Reyza (nama owner bisa diubah di Pengaturan → Notifikasi & absensi). Saat pre-final, di bawah tombol muncul daftar detail "Yang belum beres sebelum final" (tanggal Zenwel yang belum diupload, cabang tanpa petty cash, payroll, KPI, pengeluaran besar, ads/fee Wendy, temuan mutasi) dengan tombol Buka.
- Revisi setelah final: Owner atau Head of admin isi "Alasan revisi" lalu klik "Buka untuk revisi" → periode terbuka lagi (stempel REVISI), perbaiki data, Hitung ulang pre-final, simpan gaji owner, Tutup buku final lagi. Riwayat revisi (siapa, kapan, alasan, laba sebelum & sesudah) tersimpan dan laporan menulis "revisi ke-N".
- Kantor Pusat ada di dropdown cabang: Data Karyawan & Payroll (karyawan pusat → Company Board Salary), Biaya Cabang (kategori pusat), dan Input omzet manual (pendapatan lain pusat → Other income Global).
- Accounting → Omzet → Input Omzet: tabel "Metode pembayaran harian" per cabang (Cash, EDC BCA, EDC Mandiri, QRIS Maspion, Transfer/lain; tersimpan otomatis; bisa import CSV export pembayaran Zenwel, metode dipetakan otomatis ke kolom) dan "Kas cabang & setoran ke bank" (cash masuk − dipakai dana "cash toko" − disetor = kas belum disetor; catat setoran ke rekening).
- Banking (khusus Owner & Head of admin): Crosscheck Mutasi (uang masuk di mutasi bank vs POS per rekening per hari, tanggal POS digeser sesuai jeda dana cair; temuan Kurang/Lebih/uang masuk tanpa POS/transaksi dobel → badge & notifikasi owner, tombol Kirim temuan ke Owner (WA), Tandai dicek), Upload Mutasi (foto/screenshot dibaca AI, CSV export internet banking, atau input manual untuk EDC Pluit; cek dulu lalu Simpan), Saldo Bank (by catatan vs by reality; set saldo awal & saldo reality), Rekening (EDC Tebet·Bekasi·GS, QRIS Maspion semua cabang, EDC Pluit manual, EDC Mandiri Tebet·GS; cabang, jeda cair, toleransi). Banking murni untuk cek, tidak masuk accounting.
- Customer → Database (cari nama/HP, kunjungan, total belanja, layanan favorit, rating bintang, label, catatan) dan Transaksi & Import (input manual atau import CSV transaksi Zenwel/template). Omzet manual juga bisa diisi nama & HP customer.
- Ask Me! → Ask Me! (AI, halaman ini) dan Ask Boss: karyawan kirim pertanyaan ke owner (topik: cara isi data, penempatan/jadwal, konseling kerja), owner dapat badge notifikasi + bisa dikabari lewat WA, owner membalas langsung dan menandai selesai.

ATURAN PENTING: periode tutup buku tanggal 27 s/d 26 bulan berikutnya, dinamai bulan akhirnya; pilihan Periode di kanan atas bisa Bulanan, 3 bulan, 6 bulan, Tahunan. Link cabang (contoh ...#gading-serpong) membuka Input Pengeluaran, Stock opname, Absensi tanpa menu lain; link check-in (...#absen-gading-serpong) langsung ke absensi. Pengeluaran di atas batas memunculkan tombol "Kirim ke Owner (WA)" (WA terbuka berisi pesan, tinggal tekan kirim; tidak otomatis). Data sensitif (pusat, payroll, KPI, aset, riwayat) hanya untuk role admin (Owner, Head of admin, Admin keuangan, HRD). Setiap user wajib login dengan username & password (link check-in absensi tidak perlu login). Lupa password: klik "Lupa password?" di halaman login, isi username & password baru, lalu tunggu Owner menyetujui di Pengaturan → Role & akses. Akun hanya bisa dibuat Owner dan Head of admin. Tombol nama di kanan atas untuk keluar. Data tersimpan di server Lash Bounty ERP milik sendiri (bukan claude.ai); setiap perubahan tercatat di Riwayat perubahan. Hak akses mengikuti role akun: Owner, Head of admin, Admin keuangan dan HRD = akses admin; Manager & Staff cabang = input saja. Banking khusus Owner & Head of admin. Kalau owner lupa password, admin server menjalankan perintah reset password di komputer server.`;
  S.ask = []; S.askCtl = null;
  const ASK_CHIPS = ["Cara input petty cash tanpa struk?", "Langkah tutup buku bulan ini?", "Cara kirim slip gaji lewat WA?", "Cara import data dari CSV?", "Di mana link check-in absensi?", "Bedanya role Lihat dan Edit?"];
  function renderAsk(){
    if (S.leaf !== "ask/ai") return;
    $("askLog").innerHTML = S.ask.length ? S.ask.map((m, i) => `<div class="msg ${m.role}"><div class="bub" id="askB${i}"></div></div>`).join("") : `<div class="ask-empty"><b>Halo! Mau tanya apa soal Lash Bounty ERP?</b><span>Pilih contoh di bawah atau ketik pertanyaan sendiri.</span></div>`;
    S.ask.forEach((m, i) => { $("askB" + i).textContent = m.content || "…"; });
    $("askChips").innerHTML = S.ask.length ? "" : ASK_CHIPS.map(q => `<button type="button" class="chip" data-ask="${esc(q)}">${esc(q)}</button>`).join("");
    $("askLog").scrollTop = $("askLog").scrollHeight;
    if (!S.sample && S.booted) { $("askBtn").disabled = true; $("askNote").textContent = "Ask Me! butuh AI aktif di server (isi ANTHROPIC_API_KEY di file .env, lalu restart server)."; }
  }
  async function askSend(q){
    q = String(q || "").trim(); if (!q || !S.sample || S.askBusy) return;
    S.askBusy = true; $("askBtn").disabled = true; $("askIn").value = "";
    S.ask.push({ role: "user", content: q }); S.ask.push({ role: "assistant", content: "" }); renderAsk();
    const ctx = `\n\nKonteks: pengguna ber-role ${roleLabel(myRole())}${myCab() ? " (cabang " + myCab() + ")" : ""}, periode aktif ${perName(S.month)}.`;
    const msgs = S.ask.slice(0, -1).map((m, i) => ({ role: m.role, content: i === 0 ? GUIDE + ctx + "\n\n---\nPertanyaan: " + m.content : m.content }));
    S.askCtl?.abort(); S.askCtl = new AbortController(); const idx = S.ask.length - 1;
    try { const out = await S.sample(msgs, { signal: S.askCtl.signal, cache: false, onText: ({ text }) => { S.ask[idx].content = text; const el = $("askB" + idx); if (el) { el.textContent = text; $("askLog").scrollTop = $("askLog").scrollHeight; } } });
      S.ask[idx].content = out?.text || S.ask[idx].content || "Maaf, belum ada jawaban."; }
    catch (err) { S.ask[idx].content = err?.code === "rate_limited" ? "Batas pemakaian tercapai. Coba lagi beberapa menit lagi." : ["not_granted","sampling_disabled","not_declared","capability_disabled","capability_removed"].includes(err?.code) ? "Ask Me! tidak tersedia di tampilan ini." : (err?.text ? err.text + "\n\n(terputus)" : "Gagal menjawab. Coba lagi."); }
    finally { S.askBusy = false; $("askBtn").disabled = false; renderAsk(); }
  }
  $("askForm").addEventListener("submit", e => { e.preventDefault(); askSend($("askIn").value); });
  $("askIn").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askSend($("askIn").value); } });
  $("askChips").addEventListener("click", e => { const b = e.target.closest("[data-ask]"); if (b) askSend(b.dataset.ask); });

  /* ---------- pengaturan ---------- */
  let edit = null, editItems = null;
  function renderAtur(){
    if (!edit || !S.cfgDirty) edit = { cabang: cabCfg().map(c=>({ nama:c.nama, grup:c.grup||"" })) };
    const ro = !S.admin;
    $("aturRO").hidden = !ro || !S.db || ["set/akun", "set/integrasi"].includes(S.leaf);
    $("cabEdit").innerHTML = `<datalist id="grupList"><option>Internal</option><option>Wendy</option></datalist>` + (edit.cabang.length ? edit.cabang.map((c,i)=>`<div class="cfg-row g">
        <input type="text" id="cabN${i}" data-i="${i}" data-f="nama" value="${esc(c.nama)}" placeholder="Nama cabang" ${ro?"disabled":""} aria-label="Nama cabang">
        <input type="text" data-i="${i}" data-f="grup" value="${esc(c.grup||"")}" placeholder="Grup (Internal/Wendy)" list="grupList" ${ro?"disabled":""} aria-label="Grup cabang">
        ${ro?"<span></span>":`<button class="btn ghost danger" data-rmcab="${i}" type="button" aria-label="Hapus cabang">✕</button>`}</div>`).join("")
      : `<p class="note" style="margin:0 0 10px">Belum ada cabang.</p>`);
    ["addCab","saveCfg"].forEach(id=>$(id).disabled = ro || !S.db);
    if (!editItems || !S.itemsDirty) editItems = itemList().map(it => ({ nama: it.nama, satuan: it.satuan || "", min: it.min > 0 ? String(it.min).replace(".", ",") : "" }));
    $("itemEdit").innerHTML = editItems.length ? editItems.map((it,i)=>`<div class="cfg-row" style="grid-template-columns:minmax(0,1fr) 84px 72px auto">
        <input type="text" id="itN${i}" data-ii="${i}" data-f="nama" value="${esc(it.nama)}" placeholder="Nama barang" ${ro?"disabled":""} aria-label="Nama barang">
        <input type="text" id="itS${i}" data-ii="${i}" data-f="satuan" value="${esc(it.satuan)}" placeholder="Satuan" ${ro?"disabled":""} aria-label="Satuan">
        <input type="text" inputmode="decimal" id="itM${i}" data-ii="${i}" data-f="min" value="${esc(it.min)}" placeholder="Min" ${ro?"disabled":""} aria-label="Batas minimum">
        ${ro?"<span></span>":`<button class="btn ghost danger" data-rmit="${i}" type="button" aria-label="Hapus barang">✕</button>`}</div>`).join("")
      : `<p class="note" style="margin:0 0 10px">Belum ada barang.</p>`;
    ["addItem","saveItems"].forEach(id=>$(id).disabled = ro || !S.db);
    $("sampleBox").hidden = !(S.admin && (S.rows.some(r=>r.contoh) || S.opn.some(o=>o.contoh) || S.sales.some(s=>s.contoh) || S.ps.some(p=>p.contoh) || !!S.prDoc?.contoh || Object.values(S.kpiAll).some(x=>x.contoh) || S.aset.some(a=>a.contoh) || S.abs.some(a=>a.contoh)));
    const linkRows = [["Admin & owner", ARTIFACT_URL + "#dash"], ...cabList().flatMap(c=>[[c, ARTIFACT_URL + "#" + slug(c)], [c + " · check-in absensi", ARTIFACT_URL + "#absen-" + slug(c)]])];
    $("links").innerHTML = cabList().length ? linkRows.map(([n,u],i)=>`<div class="links-row"><b>${esc(n)}</b><code id="lk${i}">${esc(u)}</code><button class="btn" type="button" data-copy="${i}">Salin</button>${qrBtn(u, n)}</div>`).join("")
      : `<p class="note" style="margin:0">Tambahkan cabang dulu, link-nya muncul di sini.</p>`;
  }
  $("cabEdit").addEventListener("input", e => { const t=e.target; if (t.dataset.i===undefined) return; S.cfgDirty=true; edit.cabang[t.dataset.i][t.dataset.f||"nama"]=t.value; });
  $("cabEdit").addEventListener("click", e => { const b=e.target.closest("[data-rmcab]"); if(!b) return; S.cfgDirty=true; edit.cabang.splice(+b.dataset.rmcab,1); renderAtur(); });
  $("addCab").addEventListener("click", () => { S.cfgDirty=true; edit.cabang.push({nama:"Cabang ", grup:""}); renderAtur(); const el=$("cabN"+(edit.cabang.length-1)); el?.focus(); el?.setSelectionRange(el.value.length, el.value.length); });
  $("saveCfg").addEventListener("click", async () => {
    const cabang = edit.cabang.map(c=>({ nama:c.nama.trim(), grup:String(c.grup||"").trim() })).filter(c=>c.nama && c.nama.toLowerCase()!=="cabang");
    const names = cabang.map(c=>c.nama.toLowerCase());
    if (new Set(names).size !== names.length) { $("cfgMsg").textContent="Ada nama cabang yang sama. Bedakan dulu."; return; }
    $("saveCfg").disabled=true; $("cfgMsg").textContent="Menyimpan…";
    try { await S.db.doc("settings/main").set({ cabang }); S.cfgDirty=false; $("cfgMsg").textContent=""; toast("Daftar cabang tersimpan"); }
    catch (err) { $("cfgMsg").textContent = err?.code==="invalid_argument" ? "Hanya role admin yang bisa menyimpan pengaturan." : "Gagal menyimpan, coba lagi."; }
    finally { $("saveCfg").disabled=false; }
  });
  $("itemEdit").addEventListener("input", e => { const t=e.target; if (t.dataset.ii===undefined) return; S.itemsDirty=true; editItems[t.dataset.ii][t.dataset.f]=t.value; });
  $("itemEdit").addEventListener("click", e => { const b=e.target.closest("[data-rmit]"); if(!b) return; S.itemsDirty=true; editItems.splice(+b.dataset.rmit,1); renderAtur(); });
  $("addItem").addEventListener("click", () => { S.itemsDirty=true; editItems.push({ nama:"", satuan:"pcs", min:"" }); renderAtur(); $("itN"+(editItems.length-1))?.focus(); });
  $("saveItems").addEventListener("click", async () => {
    const items = editItems.map(it => { const m = parseQty(it.min); return { nama:String(it.nama).trim(), satuan:String(it.satuan).trim(), min:(m==null || Number.isNaN(m)) ? 0 : m }; }).filter(it => it.nama);
    const names = items.map(i => i.nama.toLowerCase());
    if (new Set(names).size !== names.length) { $("itemMsg").textContent = "Ada nama barang yang sama. Bedakan dulu."; return; }
    $("saveItems").disabled=true; $("itemMsg").textContent="Menyimpan…";
    try { await S.db.doc("settings/stok").set({ items }); S.itemsDirty=false; $("itemMsg").textContent=""; toast("Daftar barang tersimpan"); }
    catch (err) { $("itemMsg").textContent = err?.code==="invalid_argument" ? "Hanya role admin yang bisa menyimpan daftar barang." : "Gagal menyimpan, coba lagi."; }
    finally { $("saveItems").disabled=false; }
  });
  $("links").addEventListener("click", async e => {
    const b=e.target.closest("[data-copy]"); if(!b) return; const el=$("lk"+b.dataset.copy);
    try { await navigator.clipboard.writeText(el.textContent); b.textContent="Tersalin"; setTimeout(()=>b.textContent="Salin",1800); }
    catch { const r=document.createRange(); r.selectNodeContents(el); const s=getSelection(); s.removeAllRanges(); s.addRange(r); toast("Teks link sudah dipilih, tinggal copy"); }
  });
  $("clearSample").addEventListener("click", async e => {
    const b=e.currentTarget;
    if (b.dataset.armed!=="1") { b.dataset.armed="1"; b.textContent="Klik sekali lagi untuk hapus"; setTimeout(()=>{ b.dataset.armed=""; b.textContent="Hapus semua data contoh"; },4000); return; }
    b.disabled=true; $("clearMsg").textContent=" Menghapus…";
    try { const snap = await S.db.collection("expenses").where("contoh","==",true).limit(1000).get();
      const snap2 = await S.db.collection("opname").where("contoh","==",true).limit(1000).get();
      const snap3 = await S.db.collection("sales").where("contoh","==",true).limit(1000).get();
      const snap4 = await S.db.collection("pusat").where("contoh","==",true).limit(1000).get();
      const snap5 = await S.db.collection("payroll").where("contoh","==",true).limit(100).get();
      const snap6 = await S.db.collection("kpi").where("contoh","==",true).limit(500).get();
      const snap7 = await S.db.collection("absen").where("contoh","==",true).limit(1000).get();
      const snap8 = await S.db.collection("aset").where("contoh","==",true).limit(1000).get();
      const all = snap.docs.map(d=>"expenses/"+d.id).concat(snap2.docs.map(d=>"opname/"+d.id), snap3.docs.map(d=>"sales/"+d.id), snap4.docs.map(d=>"pusat/"+d.id), snap5.docs.map(d=>"payroll/"+d.id), snap6.docs.map(d=>"kpi/"+d.id), snap7.docs.map(d=>"absen/"+d.id), snap8.docs.map(d=>"aset/"+d.id));
      let n=0; for (const p of all) { await S.db.doc(p).delete(); n++; $("clearMsg").textContent=` Menghapus… ${n}/${all.length}`; }
      $("clearMsg").textContent=""; toast(n+" data contoh dihapus"); }
    catch { $("clearMsg").textContent=" Gagal menghapus sebagian. Coba lagi."; }
    finally { b.disabled=false; b.dataset.armed=""; b.textContent="Hapus semua data contoh"; }
  });


  /* ---------- Banking: rekening, mutasi, crosscheck POS, saldo (khusus Owner & Head of admin) ---------- */
  S.bkCfg = null; S.bkCfgLoaded = false; S.mut = []; S.mutLoaded = false; S.bayar = []; S.bayarLoaded = false; S.kas = []; S.kasLoaded = false; S.bkFlags = {};
  S.unsubBk = []; S.bkKeys = ""; S.muPrev = []; S.muMode = "img"; S.rkEdit = null; S.rkDirty = false; S.byDirty = {};
  const canBank = () => !!S.db && S.admin && (!S.appUser ? S.isOwner : ["owner","head"].includes(myRole()));
  const addDays = (iso, n) => { const d = new Date(iso + "T00:00"); d.setDate(d.getDate() + n); return isoOf(d); };
  const REK_TIPE = ["EDC", "QR", "Transfer"];
  function rekDefault(){ const cs = cabList(), f = rx => cs.filter(c => rx.test(c));
    return [{ id: "edc1", nama: "EDC Tebet · Bekasi · GS", bank: "Bank BCA", tipe: "EDC", cabang: f(/tebet|bekasi|gading|serpong/i), lag: 1, tol: 1 },
      { id: "qr", nama: "QRIS semua cabang", bank: "Bank Maspion", tipe: "QR", cabang: cs, lag: 0, tol: 1, setor: true },
      { id: "edcpl", nama: "EDC Pluit", bank: "", tipe: "EDC", cabang: f(/pluit/i), lag: 1, tol: 1, manual: true },
      { id: "mdr", nama: "EDC Mandiri Tebet · GS", bank: "Bank Mandiri", tipe: "EDC", cabang: f(/tebet|gading|serpong/i), lag: 1, tol: 1 }]; }
  const rekList = () => (Array.isArray(S.bkCfg?.rekening) && S.bkCfg.rekening.length ? S.bkCfg.rekening : rekDefault()).filter(r => r && r.id);
  const rekOf = id => rekList().find(r => r.id === id);
  const rekName = r => r ? r.nama + (r.bank ? " · " + r.bank : "") : "–";
  const chanOf = c => rekList().filter(r => (r.cabang || []).includes(c));
  const numAny = v => { let s = String(v ?? "").replace(/[^\d,.\-]/g, ""); if (!s) return 0; const neg = s.startsWith("-"); s = s.replace(/-/g, "");
    const lc = s.lastIndexOf(","), ld = s.lastIndexOf(".");
    if (lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    else if (lc > -1) s = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
    else if (ld > -1) s = /\.\d{1,2}$/.test(s) && (s.match(/\./g) || []).length === 1 ? s : s.replace(/\./g, "");
    const n = Math.round(parseFloat(s) || 0); return neg ? -n : n; };
  const normTx = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const txKey = x => [x.tanggal || "", x.jam || "", x.jumlah, normTx(x.ket).slice(0, 40)].join("|");
  const monthsBetween = (a, b) => { const out = []; let [y, m] = a.split("-").map(Number); const [y2, m2] = b.split("-").map(Number); while ((y < y2 || (y === y2 && m <= m2)) && out.length < 15) { out.push(y + "-" + String(m).padStart(2, "0")); m++; if (m > 12) { m = 1; y++; } } return out; };
  function bkMonths(){ const set = new Set(perBulans(S.rk)), t = todayISO().slice(0, 7);
    rekList().forEach(r => { if (r.saldoTgl) monthsBetween(r.saldoTgl.slice(0, 7), t).forEach(x => set.add(x)); }); return [...set].sort(); }
  function subscribeBank(){
    if (!S.db || !S.admin) return; const ms = bkMonths(), key = ms.join(",") + "|" + canBank();
    if (key === S.bkKeys) return; S.bkKeys = key; S.unsubBk.forEach(u => u && u()); S.unsubBk = [];
    S.unsubBk.push(subMany("bayar", "bulan", ms, d => { S.bayar = d; S.bayarLoaded = true; renderAll(); }, () => { S.bayarLoaded = true; renderAll(); }));
    S.unsubBk.push(subMany("kas", "bulan", ms, d => { S.kas = d; S.kasLoaded = true; renderAll(); }, () => { S.kasLoaded = true; renderAll(); }));
    if (canBank()) S.unsubBk.push(subMany("mutasi", "bulan", ms, d => { S.mut = d; S.mutLoaded = true; renderAll(); }, () => { S.mutLoaded = true; renderAll(); }));
  }
  const bayarOf = (c, d) => S.bayar.find(b => b.cabang === c && b.tanggal === d);
  // ---- crosscheck per rekening per hari
  function bkModel(k){
    const R = rekList(), t = todayISO(), rows = [], odd = [];
    R.forEach(r => perDays(k).forEach(d => { if (d >= t) return;
      const src = addDays(d, -(+r.lag || 0)), cabs = r.cabang || [];
      const pos = sumOf(cabs, c => +(bayarOf(c, src)?.m?.[r.id] || 0)), posIn = cabs.some(c => bayarOf(c, src));
      const setor = sumOf(S.kas.filter(x => x.rek === r.id && x.tanggal === d), x => x.jumlah);
      const md = S.mut.find(m => m.rek === r.id && m.tanggal === d), tx = md?.tx || [];
      const cr = sumOf(tx.filter(x => x.jumlah > 0), x => x.jumlah), db = -sumOf(tx.filter(x => x.jumlah < 0), x => x.jumlah), exp = pos + setor;
      if (!exp && !cr && !md) return;
      const tol = Math.max(1000, exp * (r.tol ?? 1) / 100), diff = cr - exp; let st, ty;
      if (!md) { st = "Mutasi belum diupload"; ty = "warn"; }
      else if (!posIn && !setor && cr) { st = "Metode bayar POS " + fmtD(src) + " belum diinput"; ty = "warn"; }
      else if (Math.abs(diff) <= tol) { st = diff < -1 ? "Cocok · selisih " + rp(-diff) + " (kemungkinan potongan MDR)" : "Cocok"; ty = "ok"; }
      else if (diff < 0) { st = "Kurang " + rp(-diff) + " dari POS"; ty = "no"; }
      else { st = exp ? "Lebih " + rp(diff) + " · ada uang masuk tidak tercatat di POS" : "Uang masuk tanpa transaksi POS"; ty = "no"; }
      const key = r.id + "_" + d; rows.push({ key, r, d, src, pos, setor, exp, cr, db, diff, st, ty, md, n: tx.filter(x => x.jumlah > 0).length, flag: S.bkFlags[key] || null }); }));
    S.mut.filter(m => inPer(m.tanggal, k)).forEach(m => { const seen = {}; (m.tx || []).forEach(x => { if (!(x.jumlah > 0) || !x.jam) return; const kk = x.jam + "|" + x.jumlah + "|" + normTx(x.ket);
      if (seen[kk]) { const key = "dup_" + m.rek + "_" + m.tanggal + "_" + x.jam.replace(/\D/g, "") + "_" + x.jumlah; odd.push({ key, r: rekOf(m.rek), d: m.tanggal, st: "Transaksi dobel: " + rp(x.jumlah) + " jam " + x.jam + " (" + (x.ket || "–") + ")", flag: S.bkFlags[key] || null }); } seen[kk] = 1; }); });
    const findings = [...rows.filter(x => x.ty === "no"), ...odd];
    return { rows, odd, findings, open: findings.filter(f => !f.flag), pend: rows.filter(x => x.ty === "warn") };
  }
  function bankCheck(k){ if (!canBank() || !S.mutLoaded) return null; const M = bkModel(k); if (!M.rows.length && !S.mut.length) return null;
    return [!M.open.length && !M.pend.length, M.open.length ? M.open.length + " temuan crosscheck mutasi belum dicek" : M.pend.length ? M.pend.length + " hari mutasi / metode bayar belum lengkap" : "Crosscheck mutasi beres", "bank/cocok",
      [...M.open.slice(0, 10).map(f => fmtD(f.d) + " · " + (f.r?.nama || "") + " · " + f.st), ...M.pend.slice(0, 8).map(f => fmtD(f.d) + " · " + f.r.nama + " · " + f.st)]]; }
  const bankOpen = () => { try { return canBank() && S.mutLoaded ? bkModel(S.month).open.length : 0; } catch { return 0; } };
  function bankWaText(M, k){ return ["🏦 *Crosscheck mutasi " + perName(k) + "*", M.open.length + " temuan belum dicek:", ...M.open.slice(0, 15).map(f => "• " + fmtD(f.d) + " · " + (f.r?.nama || "") + ": " + f.st), M.open.length > 15 ? "+" + (M.open.length - 15) + " lainnya" : "", "", "Cek: " + ARTIFACT_URL + "#bank"].filter(Boolean).join("\n"); }
  function renderBank(){
    if (!S.leaf.startsWith("bank")) return;
    const ok = canBank(); $("bkRO").hidden = ok || !S.booted; $("bkBody").hidden = !ok; if (!ok) return;
    subscribeBank();
    const k = S.rk, M = bkModel(k), R = rekList(), sub = S.leaf.split("/")[1];
    { const kp = $("bkRek").value; $("bkRek").innerHTML = `<option value="">Semua rekening</option>` + R.map(r => `<option value="${esc(r.id)}">${esc(rekName(r))}</option>`).join(""); $("bkRek").value = R.some(r => r.id === kp) ? kp : ""; }
    { const kp = $("muRek").value; $("muRek").innerHTML = R.map(r => `<option value="${esc(r.id)}">${esc(rekName(r))}${r.manual ? " (input manual)" : ""}</option>`).join(""); if (R.some(r => r.id === kp)) $("muRek").value = kp; }
    { const kp = $("bsRek").value; $("bsRek").innerHTML = R.map(r => `<option value="${esc(r.id)}">${esc(rekName(r))}</option>`).join(""); if (R.some(r => r.id === kp)) $("bsRek").value = kp; }
    const sumCr = sumOf(M.rows, x => x.cr), sumExp = sumOf(M.rows, x => x.exp);
    $("bkKpis").innerHTML = [["Uang masuk menurut POS", rpShort(sumExp), "non-cash + setoran · " + perName(k)], ["Uang masuk di mutasi", rpShort(sumCr), sumOf(M.rows, x => x.n) + " transaksi"], ["Selisih", rpShort(sumCr - sumExp), sumCr - sumExp < 0 ? "mutasi lebih kecil dari POS" : "mutasi ≥ POS"], ["Temuan belum dicek", String(M.open.length), M.pend.length + " hari data belum lengkap"]]
      .map(([l, v, s2], i) => `<div class="kpi"><span class="l">${l}</span><span class="v num ${i === 3 && M.open.length ? "up" : ""}">${v}</span><span class="s">${s2}</span></div>`).join("");
    if (sub === "cocok" || !sub) {
      const fr = $("bkRek").value, only = $("bkOnly").checked, L = M.rows.filter(x => (!fr || x.r.id === fr) && (!only || x.ty !== "ok"));
      $("bkTitle").textContent = "Crosscheck mutasi · " + perName(k);
      $("bkSum").innerHTML = `<div class="scroll"><table><thead><tr><th>Rekening</th><th>Cabang</th><th class="r">POS (expected)</th><th class="r">Mutasi masuk</th><th class="r">Selisih</th><th>Status</th></tr></thead><tbody>` +
        R.map(r => { const X = M.rows.filter(x => x.r.id === r.id), e = sumOf(X, x => x.exp), c = sumOf(X, x => x.cr), bad = X.filter(x => x.ty === "no" && !x.flag).length, pd = X.filter(x => x.ty === "warn").length;
          return `<tr><td><b>${esc(r.nama)}</b><small>${esc(r.bank || "bank belum diisi")} · ${esc(r.tipe)}${r.lag ? " · cair H+" + r.lag : ""}</small></td><td>${esc((r.cabang || []).map(shortCab).join(", ") || "–")}</td><td class="r num">${fmtOrDash(e)}</td><td class="r num">${fmtOrDash(c)}</td><td class="r num ${c - e < -1000 ? "up" : ""}">${fmtOrDash(c - e)}</td><td>${bad ? `<span class="pill no">${bad} temuan</span>` : pd ? `<span class="pill warn">${pd} belum lengkap</span>` : X.length ? `<span class="pill ok">Cocok</span>` : `<span class="note">belum ada data</span>`}</td></tr>`; }).join("") + `</tbody></table></div>`;
      $("bkTable").innerHTML = L.length ? `<thead><tr><th>Tanggal mutasi</th><th>Rekening</th><th class="r">POS</th><th class="r">Setoran cash</th><th class="r">Mutasi masuk</th><th class="r">Selisih</th><th>Status</th><th></th></tr></thead><tbody>` +
        L.map(x => `<tr class="${x.ty === "no" && !x.flag ? "bk-bad" : ""}"><td class="num">${esc(fmtDate(x.d))}${x.src !== x.d ? `<small>POS ${esc(fmtD(x.src))}</small>` : ""}</td><td>${esc(x.r.nama)}</td><td class="r num">${fmtOrDash(x.pos)}</td><td class="r num">${fmtOrDash(x.setor)}</td><td class="r num">${fmtOrDash(x.cr)}${x.n ? `<small>${x.n} trx</small>` : ""}</td><td class="r num ${x.diff < -1000 ? "up" : ""}">${x.md ? fmt(x.diff) : "–"}</td>
          <td><span class="pill ${x.flag ? "ok" : x.ty}">${x.flag ? "Dicek" : x.ty === "ok" ? "OK" : x.ty === "no" ? "Temuan" : "Cek"}</span> <span class="k">${esc(x.st)}</span>${x.flag ? `<small>${esc(x.flag.by || "")}: ${esc(x.flag.note || "sudah dicek")}</small>` : ""}</td>
          <td class="r">${x.ty === "no" ? `<button class="btn ghost" type="button" data-bkflag="${esc(x.key)}">${x.flag ? "Batal" : "Tandai dicek"}</button>` : x.ty === "warn" && !x.md ? `<button class="btn ghost" type="button" data-nav="bank/mutasi">Upload</button>` : x.ty === "warn" ? `<button class="btn ghost" type="button" data-goto="acc/omzet/input">Isi POS</button>` : ""}</td></tr>`).join("") + `</tbody>`
        : `<tr><td class="empty">${M.rows.length ? "Tidak ada temuan. Semua cocok." : "Belum ada data. Isi metode bayar harian di Omzet → Input Omzet dan upload mutasi di Banking → Upload Mutasi."}</td></tr>`;
      $("bkOdd").innerHTML = M.odd.length ? M.odd.map(o => `<div class="alert"><span class="pill ${o.flag ? "ok" : "no"}">${o.flag ? "Dicek" : "Janggal"}</span><div style="flex:1;min-width:0"><b>${esc(fmtDate(o.d))} · ${esc(o.r?.nama || "")}</b><div class="note">${esc(o.st)}</div></div><button class="btn ghost" type="button" data-bkflag="${esc(o.key)}">${o.flag ? "Batal" : "Tandai dicek"}</button></div>`).join("") : `<p class="note" style="margin:0">Tidak ada transaksi dobel / janggal di mutasi periode ini.</p>`;
      const num = waNum(hrCfg().ownerWa); $("bkWa").hidden = !M.open.length || !num; if (num && M.open.length) $("bkWa").href = waLink(num, bankWaText(M, k));
    }
    if (sub === "mutasi") renderMutasi(k);
    if (sub === "saldo") renderSaldo();
    if (sub === "rekening") renderRek();
  }
  $("bkRek").addEventListener("change", renderBank); $("bkOnly").addEventListener("change", renderBank);
  document.addEventListener("click", async e => { const b = e.target.closest("[data-bkflag]"); if (!b || !S.db) return; const key = b.dataset.bkflag;
    try { if (S.bkFlags[key]) await S.db.doc("bankflag/" + key).delete(); else await S.db.doc("bankflag/" + key).set({ key, status: "dicek", note: "sudah dicek", by: actorName(), at: new Date().toISOString() }); }
    catch { toast("Gagal menyimpan. Hanya Owner / Head of admin."); } });
  // ---- upload mutasi
  document.querySelectorAll("#muMode [data-m]").forEach(b => b.addEventListener("click", () => { S.muMode = b.dataset.m; document.querySelectorAll("#muMode [data-m]").forEach(x => x.setAttribute("aria-pressed", x === b)); ["muImg","muCsv","muMan"].forEach(id => $(id).hidden = id !== { img: "muImg", csv: "muCsv", man: "muMan" }[S.muMode]); }));
  $("muTgl").value = todayISO();
  // baris dari file yang sama tidak di-dedupe (2 pembayaran identik bisa terjadi); dedupe hanya terhadap mutasi yang sudah tersimpan saat Simpan
  function muAdd(rows, src){ let n = 0;
    rows.forEach(x => { if (!validISO(x.tanggal) || !x.jumlah) return; S.muPrev.push({ ...x, src, on: true }); n++; });
    S.muPrev.sort((a, b) => (a.tanggal + (a.jam || "")).localeCompare(b.tanggal + (b.jam || ""))); renderMuPrev(); return n; }
  function renderMuPrev(){
    const L = S.muPrev, on = L.filter(x => x.on), rek = rekOf($("muRek").value);
    $("muPrev").innerHTML = L.length ? `<div class="sec-h" style="margin:14px 0 8px"><h3>Cek dulu sebelum simpan · ${esc(rekName(rek))}</h3><span class="hint">${on.length} dari ${L.length} baris · masuk ${rp(sumOf(on.filter(x => x.jumlah > 0), x => x.jumlah))} · keluar ${rp(-sumOf(on.filter(x => x.jumlah < 0), x => x.jumlah))}</span></div>
      <div class="scroll"><table><thead><tr><th></th><th>Tanggal</th><th>Jam</th><th>Keterangan</th><th class="r">Masuk</th><th class="r">Keluar</th><th class="r">Saldo</th><th>Sumber</th></tr></thead><tbody>` +
      L.map((x, i) => `<tr class="${x.on ? "" : "muted"}"><td><input type="checkbox" data-mui="${i}" ${x.on ? "checked" : ""} aria-label="Pakai baris"></td><td class="num">${esc(fmtDate(x.tanggal))}</td><td class="num">${esc(x.jam || "–")}</td><td class="k">${esc(x.ket || "")}</td><td class="r num">${x.jumlah > 0 ? fmt(x.jumlah) : ""}</td><td class="r num">${x.jumlah < 0 ? fmt(-x.jumlah) : ""}</td><td class="r num">${x.saldo != null ? fmt(x.saldo) : "–"}</td><td>${esc(x.src)}</td></tr>`).join("") + `</tbody></table></div>
      <div class="fields fields-3 cfg-f" style="margin-top:10px"><div class="field"><label for="muSaldo">Saldo akhir rekening (opsional)</label><div class="rp"><span>Rp</span><input type="text" id="muSaldo" inputmode="numeric" value="${S.muSaldo ? fmt(S.muSaldo.v) : ""}"></div></div>
        <div class="field"><label for="muSaldoTgl">Per tanggal</label><input type="date" id="muSaldoTgl" value="${S.muSaldo?.tgl || (L.length ? L[L.length - 1].tanggal : todayISO())}"></div></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px"><button class="btn primary" type="button" id="muSave">Simpan ${on.length} transaksi</button><button class="btn ghost" type="button" id="muClear">Batal</button></div>` : "";
  }
  $("muPrev").addEventListener("change", e => { const c = e.target.closest("[data-mui]"); if (c) { S.muPrev[+c.dataset.mui].on = c.checked; renderMuPrev(); } });
  $("muPrev").addEventListener("input", e => { if (e.target.id === "muSaldo") { const n = parseRp(e.target.value); e.target.value = n ? fmt(n) : ""; } });
  $("muPrev").addEventListener("click", async e => {
    if (e.target.id === "muClear") { S.muPrev = []; S.muSaldo = null; renderMuPrev(); $("muMsg").textContent = ""; return; }
    if (e.target.id !== "muSave") return; const b = e.target, rek = $("muRek").value, on = S.muPrev.filter(x => x.on);
    const sv = $("muSaldo").value.trim() ? { v: parseRp($("muSaldo").value), tgl: $("muSaldoTgl").value } : null;
    if (!rek || (!on.length && !sv)) return; b.disabled = true; $("muMsg").textContent = "Menyimpan…";
    const byD = {}; on.forEach(x => (byD[x.tanggal] ||= []).push(x)); if (sv && validISO(sv.tgl)) byD[sv.tgl] ||= [];
    let nNew = 0, nDup = 0;
    try { for (const [d, xs] of Object.entries(byD)) { const ref = S.db.doc("mutasi/" + rek + "_" + d), snap = await ref.get(), old = snap.exists ? snap.data() : null, tx = [...(old?.tx || [])], have = {}; tx.forEach(x => { const k3 = txKey({ ...x, tanggal: d }); have[k3] = (have[k3] || 0) + 1; });
        xs.forEach(x => { const k2 = txKey(x); if ((have[k2] || 0) > 0) { have[k2]--; nDup++; return; } tx.push({ id: newId(), jam: x.jam || "", ket: String(x.ket || "").slice(0, 120), jumlah: x.jumlah, saldo: x.saldo ?? null, src: x.src }); nNew++; });
        const doc = { rek, tanggal: d, bulan: d.slice(0, 7), tx, by: S.uid || null, at: new Date().toISOString(), pengisi: actorName() }; if (sv && sv.tgl === d) doc.saldoAkhir = sv.v; else if (old?.saldoAkhir != null) doc.saldoAkhir = old.saldoAkhir;
        await ref.set(doc); }
      S.muPrev = []; S.muSaldo = null; renderMuPrev(); $("muMsg").textContent = ""; toast(nNew + " transaksi mutasi tersimpan" + (nDup ? " · " + nDup + " dobel dilewati" : "")); go("bank/cocok"); }
    catch (err) { $("muMsg").textContent = err?.code === "invalid_argument" || err?.code === "permission_denied" ? "Hanya Owner / Head of admin yang bisa menyimpan mutasi." : "Gagal menyimpan sebagian. Coba lagi."; }
    finally { b.disabled = false; } });
  $("muFile").addEventListener("change", async e => { const files = [...(e.target.files || [])]; e.target.value = ""; if (!files.length) return;
    if (!S.sample) { $("muMsg").textContent = "Baca gambar butuh fitur AI yang aktif di tampilan ini."; return; }
    const y = todayISO().slice(0, 4); let n = 0;
    for (const [i, f] of files.entries()) { $("muMsg").textContent = `Membaca gambar ${i + 1} dari ${files.length}…`;
      try { const out = await S.sample.json(`Gambar ini adalah screenshot/foto mutasi rekening bank di Indonesia (mobile banking, internet banking, atau rekening koran). Ambil SEMUA baris transaksi yang terlihat.
Balas hanya JSON: {"rows":[{"tanggal":"YYYY-MM-DD","jam":"HH:MM atau null","keterangan":"teks transaksi ringkas, maks 80 huruf","jumlah":angka rupiah positif tanpa titik,"tipe":"CR untuk uang masuk/kredit, DB untuk uang keluar/debit","saldo":angka atau null}],"saldoAkhir":angka atau null,"tanggalSaldo":"YYYY-MM-DD atau null"}.
Tanggal Indonesia ditulis hari/bulan. Kalau tahun tidak terlihat, pakai tahun ${y}. Tanda + / CR / Kredit / hijau = uang masuk; - / DB / Debit / merah = uang keluar. Jangan menebak baris yang tidak terbaca.`, { images: [f], modelTier: "default" });
        const rows = (Array.isArray(out?.rows) ? out.rows : []).map(r => ({ tanggal: String(r?.tanggal || ""), jam: /^\d{1,2}[:.]\d{2}/.test(String(r?.jam || "")) ? String(r.jam).replace(".", ":").slice(0, 5) : "", ket: String(r?.keterangan || "").slice(0, 120), jumlah: Math.abs(Math.round(+r?.jumlah || 0)) * (/^d/i.test(String(r?.tipe || "")) ? -1 : 1), saldo: +r?.saldo > 0 ? Math.round(+r.saldo) : null }));
        n += muAdd(rows, "foto"); if (+out?.saldoAkhir > 0) S.muSaldo = { v: Math.round(+out.saldoAkhir), tgl: validISO(out?.tanggalSaldo) ? out.tanggalSaldo : rows.at(-1)?.tanggal || todayISO() }; renderMuPrev(); }
      catch (err) { if (["not_granted","sampling_disabled","not_declared","capability_disabled","capability_removed","images_unavailable"].includes(err?.code)) { $("muMsg").textContent = "Baca gambar tidak tersedia di tampilan ini. Pakai CSV atau manual."; return; }
        if (err?.code === "rate_limited") { $("muMsg").textContent = "Terlalu banyak permintaan. Coba lagi beberapa menit lagi."; return; } }
    }
    $("muMsg").textContent = n ? n + " transaksi terbaca. Cek angka & tanda masuk/keluar, lalu Simpan." : "Tidak ada transaksi terbaca. Coba foto lebih jelas, CSV, atau input manual.";
  });
  function parseMutasiCsv(text){
    const rows = parseCSV(text), hi = rows.findIndex(r => r.some(c => /tanggal|date|tgl/i.test(c)) && r.some(c => /ket|desc|uraian|remark|transaksi/i.test(c))); if (hi < 0) throw new Error("Kolom tanggal & keterangan tidak ketemu.");
    const H = rows[hi].map(normH), col = (...ks) => H.findIndex(h => ks.some(k2 => h.includes(k2)));
    const cT = col("tanggal","date","tgl"), cJ = col("jam","time","waktu"), cK = col("keterangan","deskripsi","description","uraian","remark","transaksi"), cD = col("debit","debet","keluar","db"), cC = col("kredit","credit","masuk","cr"), cN = col("jumlah","nominal","amount","mutasi"), cS = col("saldo","balance"), cTy = H.findIndex(h => /^(cr|db|crdb|dbcr|tipe|type|jenis)$/.test(h));
    const out = []; rows.slice(hi + 1).forEach(r => { const t = parseTgl(String(r[cT] || "").split(" ")[0]); if (!t) return;
      let j = 0; if (cC > -1 || cD > -1) j = (cC > -1 ? Math.abs(numAny(r[cC])) : 0) - (cD > -1 && cD !== cC ? Math.abs(numAny(r[cD])) : 0);
      if (!j && cN > -1) { const raw = String(r[cN] || ""), ty = cTy > -1 ? String(r[cTy] || "") : raw; j = Math.abs(numAny(raw)) * (/\bdb\b|debit|debet|-/i.test(ty) && !/\bcr\b|kredit|credit/i.test(ty) ? -1 : 1); }
      if (!j) return; const jm = cJ > -1 ? String(r[cJ] || "") : (String(r[cT] || "").split(" ")[1] || "");
      out.push({ tanggal: t, jam: /^\d{1,2}[:.]\d{2}/.test(jm) ? jm.replace(".", ":").slice(0, 5) : "", ket: String(r[cK] || "").slice(0, 120), jumlah: j, saldo: cS > -1 && numAny(r[cS]) ? numAny(r[cS]) : null }); });
    return out; }
  $("muCsvF").addEventListener("change", async e => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    try { const rows = parseMutasiCsv(await f.text()), n = muAdd(rows, "CSV"); $("muMsg").textContent = n ? n + " transaksi dari " + f.name + ". Cek lalu Simpan." : "Tidak ada transaksi baru di file ini."; }
    catch (err) { $("muMsg").textContent = "File tidak terbaca: " + (err?.message || "format tidak dikenal") + " Pakai template."; } });
  $("muTpl").addEventListener("click", async () => { if (!S.dl) return; try { await S.dl.save({ filename: "Template mutasi rekening.csv", data: "﻿Tanggal,Jam,Keterangan,Kredit,Debit,Saldo\n2026-10-05,10:21,QRIS TEBET 0012,250000,,12500000\n2026-10-05,14:02,Biaya admin,,6500,12493500\n" }); } catch {} });
  $("muJml").addEventListener("input", e => { const n = parseRp(e.target.value); e.target.value = n ? fmt(n) : ""; });
  $("muMan").addEventListener("submit", e => { e.preventDefault(); const j = parseRp($("muJml").value);
    if (!validISO($("muTgl").value) || !j) { $("muMsg").textContent = "Isi tanggal dan jumlah."; return; }
    muAdd([{ tanggal: $("muTgl").value, jam: $("muJam").value || "", ket: $("muKet").value.trim() || ($("muTipe").value === "CR" ? "Transaksi masuk" : "Transaksi keluar"), jumlah: j * ($("muTipe").value === "DB" ? -1 : 1), saldo: null }], "manual");
    $("muJml").value = ""; $("muKet").value = ""; $("muMsg").textContent = "Ditambahkan ke daftar. Klik Simpan kalau sudah semua."; });
  $("muRek").addEventListener("change", renderMuPrev);
  function renderMutasi(k){
    const R = rekList(), L = S.mut.filter(m => inPer(m.tanggal, k)).sort((a, b) => (b.tanggal + a.rek).localeCompare(a.tanggal + b.rek));
    $("muListTitle").textContent = "Mutasi tersimpan · " + perName(k);
    $("muList").innerHTML = !S.mutLoaded ? `<tr><td class="empty">Memuat…</td></tr>` : L.length ? `<thead><tr><th>Tanggal</th><th>Rekening</th><th class="r">Transaksi</th><th class="r">Masuk</th><th class="r">Keluar</th><th class="r">Saldo akhir</th><th>Diinput</th><th></th></tr></thead><tbody>` +
      L.map(m => { const tx = m.tx || []; return `<tr><td class="num">${esc(fmtDate(m.tanggal))}</td><td>${esc(rekOf(m.rek)?.nama || m.rek)}</td><td class="r num">${tx.length}</td><td class="r num">${fmtOrDash(sumOf(tx.filter(x => x.jumlah > 0), x => x.jumlah))}</td><td class="r num">${fmtOrDash(-sumOf(tx.filter(x => x.jumlah < 0), x => x.jumlah))}</td><td class="r num">${m.saldoAkhir != null ? fmt(m.saldoAkhir) : "–"}</td><td>${esc(m.pengisi || "")}<small>${esc([...new Set(tx.map(x => x.src))].join(", "))}</small></td><td class="r"><button class="btn ghost danger" type="button" data-delmut="${esc(m.id)}">Hapus</button></td></tr>`; }).join("") + `</tbody>`
      : `<tr><td class="empty">Belum ada mutasi di ${esc(perName(k))}.</td></tr>`;
    void R;
  }
  $("muList").addEventListener("click", async e => { const b = e.target.closest("[data-delmut]"); if (!b) return;
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Yakin?"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Hapus"; }, 3000); return; }
    try { await S.db.doc("mutasi/" + b.dataset.delmut).delete(); toast("Mutasi hari itu dihapus"); } catch { toast("Gagal menghapus"); } });
  // ---- saldo bank: catatan vs reality
  function saldoModel(){
    const t = todayISO();
    return rekList().map(r => {
      const ms = S.mut.filter(m => m.rek === r.id).sort((a, b) => a.tanggal.localeCompare(b.tanggal)); let real = null;
      for (let i = ms.length - 1; i >= 0 && !real; i--) { const m = ms[i]; if (m.saldoAkhir != null) real = { v: m.saldoAkhir, tgl: m.tanggal, src: "input saldo" }; else { const s2 = (m.tx || []).filter(x => x.saldo != null); if (s2.length) real = { v: s2[s2.length - 1].saldo, tgl: m.tanggal, src: "saldo di mutasi" }; } }
      const s0 = r.saldoTgl && r.saldoAwal != null ? { tgl: r.saldoTgl, v: +r.saldoAwal } : null; let masuk = 0, keluar = 0, cat = null; const end = real?.tgl || t;
      if (s0) { for (let d = addDays(s0.tgl, 1); d <= end; d = addDays(d, 1)) { const src = addDays(d, -(+r.lag || 0)); masuk += sumOf(r.cabang || [], c => +(bayarOf(c, src)?.m?.[r.id] || 0)) + sumOf(S.kas.filter(x => x.rek === r.id && x.tanggal === d), x => x.jumlah); }
        keluar = -sumOf(ms.filter(m => m.tanggal > s0.tgl && m.tanggal <= end).flatMap(m => m.tx || []).filter(x => x.jumlah < 0), x => x.jumlah); cat = s0.v + masuk - keluar; }
      return { r, s0, real, masuk, keluar, cat, end, sel: real && cat != null ? real.v - cat : null };
    });
  }
  const saldoHtml = (L, compact) => `<thead><tr><th>Rekening</th>${compact ? "" : `<th class="r">Saldo awal</th><th class="r">+ Masuk (POS & setoran)</th><th class="r">− Keluar (mutasi)</th>`}<th class="r">By catatan</th><th class="r">By reality</th><th class="r">Selisih</th></tr></thead><tbody>` +
    L.map(x => `<tr><td><b>${esc(x.r.nama)}</b><small>${esc(x.r.bank || "bank belum diisi")}</small></td>${compact ? "" : `<td class="r num">${x.s0 ? fmt(x.s0.v) + `<small>${esc(fmtDate(x.s0.tgl))}</small>` : "<span class=note>belum diisi</span>"}</td><td class="r num">${x.s0 ? fmt(x.masuk) : "–"}</td><td class="r num">${x.s0 ? fmt(x.keluar) : "–"}</td>`}
      <td class="r num">${x.cat != null ? fmt(x.cat) : "–"}${x.cat != null ? `<small>s/d ${esc(fmtD(x.end))}</small>` : ""}</td><td class="r num">${x.real ? fmt(x.real.v) + `<small>${esc(fmtD(x.real.tgl))} · ${esc(x.real.src)}</small>` : "<span class=note>belum ada</span>"}</td>
      <td class="r num ${x.sel != null && Math.abs(x.sel) > 1000 ? "up" : ""}">${x.sel != null ? (x.sel > 0 ? "+" : "") + fmt(x.sel) : "–"}</td></tr>`).join("") + `</tbody>`;
  function renderSaldo(){ $("bsTable").innerHTML = saldoHtml(saldoModel(), false); }
  $("bsJml").addEventListener("input", e => { const n = parseRp(e.target.value); e.target.value = n ? fmt(n) : ""; });
  $("bsTgl").value = todayISO();
  $("bsForm").addEventListener("submit", async e => { e.preventDefault(); const rek = $("bsRek").value, d = $("bsTgl").value, v = parseRp($("bsJml").value), mode = e.submitter?.dataset.mode || "real";
    if (!rek || !validISO(d) || !$("bsJml").value.trim()) { $("bsMsg").textContent = "Pilih rekening, tanggal, dan isi saldo."; return; }
    try { if (mode === "awal") { const list = rekList().map(r => r.id === rek ? { ...r, saldoAwal: v, saldoTgl: d } : r); await saveRek(list); toast("Saldo awal " + rekOf(rek).nama + " diset " + rp(v)); }
      else { const ref = S.db.doc("mutasi/" + rek + "_" + d), snap = await ref.get(); if (snap.exists) await ref.update({ saldoAkhir: v }); else await ref.set({ rek, tanggal: d, bulan: d.slice(0, 7), tx: [], saldoAkhir: v, by: S.uid || null, at: new Date().toISOString(), pengisi: actorName() }); toast("Saldo reality tersimpan"); }
      $("bsJml").value = ""; $("bsMsg").textContent = ""; }
    catch { $("bsMsg").textContent = "Gagal menyimpan. Hanya role admin yang bisa menyimpan ini."; } });
  // ---- rekening
  async function saveRek(list){ const doc = { rekening: list.map(r => ({ id: r.id, nama: String(r.nama || "").trim() || "Rekening", bank: String(r.bank || "").trim(), tipe: REK_TIPE.includes(r.tipe) ? r.tipe : "EDC", cabang: (r.cabang || []).filter(c => cabList().includes(c)), lag: Math.max(0, Math.min(7, parseInt(r.lag, 10) || 0)), tol: Math.max(0, Math.min(10, parseFloat(String(r.tol).replace(",", ".")) || 0)), manual: !!r.manual, setor: !!r.setor, noRek: String(r.noRek || "").replace(/[^\d]/g, "").slice(-4), ...(r.saldoTgl ? { saldoTgl: r.saldoTgl, saldoAwal: +r.saldoAwal || 0 } : {}) })) };
    if (S.bkCfg) await S.db.doc("bankcfg/main").update(doc); else await S.db.doc("bankcfg/main").set(doc); }
  function renderRek(){
    if (!S.rkDirty || !S.rkEdit) S.rkEdit = rekList().map(r => ({ ...r, cabang: [...(r.cabang || [])] }));
    const cs = cabList();
    $("rkEdit").innerHTML = S.rkEdit.map((r, i) => `<div class="rk-card"><div class="fields fields-3 cfg-f">
        <div class="field"><label>Nama rekening</label><input type="text" data-rk="${i}|nama" value="${esc(r.nama || "")}" maxlength="50"></div>
        <div class="field"><label>Bank</label><input type="text" data-rk="${i}|bank" value="${esc(r.bank || "")}" maxlength="40" placeholder="contoh: BCA"></div>
        <div class="field"><label>4 digit akhir no. rekening</label><input type="text" data-rk="${i}|noRek" value="${esc(r.noRek || "")}" inputmode="numeric" maxlength="4" placeholder="opsional"></div>
        <div class="field"><label>Jenis</label><select data-rk="${i}|tipe">${REK_TIPE.map(t => `<option ${t === r.tipe ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <div class="field"><label>Dana cair (hari setelah transaksi)</label><input type="text" data-rk="${i}|lag" value="${esc(String(r.lag ?? 0))}" inputmode="numeric"></div>
        <div class="field"><label>Toleransi selisih (%)</label><input type="text" data-rk="${i}|tol" value="${esc(String(r.tol ?? 1))}" inputmode="decimal"></div></div>
      <div class="rk-cabs"><span class="note">Dipakai di cabang:</span>${cs.map(c => `<label class="chk sm"><input type="checkbox" data-rkc="${i}|${esc(c)}" ${(r.cabang || []).includes(c) ? "checked" : ""}> ${esc(shortCab(c))}</label>`).join("")}
        <label class="chk sm"><input type="checkbox" data-rk="${i}|manual" ${r.manual ? "checked" : ""}> Mutasi diinput manual</label><label class="chk sm"><input type="checkbox" data-rk="${i}|setor" ${r.setor ? "checked" : ""}> Tujuan setoran cash</label>
        <button class="btn ghost danger" type="button" data-rkdel="${i}">Hapus</button></div></div>`).join("");
  }
  $("rkEdit").addEventListener("input", e => { const el = e.target.closest("[data-rk]"); if (!el) return; const [i, f] = el.dataset.rk.split("|"); S.rkDirty = true; S.rkEdit[+i][f] = el.type === "checkbox" ? el.checked : el.value; });
  $("rkEdit").addEventListener("change", e => { const el = e.target.closest("[data-rkc],[data-rk]"); if (!el) return; S.rkDirty = true;
    if (el.dataset.rkc) { const [i, c] = el.dataset.rkc.split("|"), r = S.rkEdit[+i]; r.cabang = el.checked ? [...new Set([...(r.cabang || []), c])] : (r.cabang || []).filter(x => x !== c); }
    else { const [i, f] = el.dataset.rk.split("|"); S.rkEdit[+i][f] = el.type === "checkbox" ? el.checked : el.value; } });
  $("rkEdit").addEventListener("click", e => { const b = e.target.closest("[data-rkdel]"); if (!b) return; S.rkDirty = true; S.rkEdit.splice(+b.dataset.rkdel, 1); renderRek(); });
  $("rkAdd").addEventListener("click", () => { if (!S.rkEdit) renderRek(); S.rkDirty = true; S.rkEdit.push({ id: "r" + newId(), nama: "", bank: "", tipe: "EDC", cabang: [], lag: 1, tol: 1 }); renderRek(); });
  $("rkSave").addEventListener("click", async () => { if (!S.rkEdit) return; $("rkMsg").textContent = "Menyimpan…";
    try { await saveRek(S.rkEdit); S.rkDirty = false; $("rkMsg").textContent = ""; toast("Rekening tersimpan"); } catch { $("rkMsg").textContent = "Gagal menyimpan. Hanya role admin yang bisa menyimpan ini."; } });

  /* ---------- Omzet: metode bayar harian + kas cabang & setoran ---------- */
  const byCabSel = () => $("byCabang").value || cabList()[0] || "";
  function renderBayar(){
    if (S.leaf !== "acc/omzet/input" || document.body.classList.contains("staff")) return;
    if (!S.admin) { $("byPanel").hidden = true; $("kcPanel").hidden = true; return; } $("byPanel").hidden = false; $("kcPanel").hidden = false;
    fillSelect($("byCabang"), cabList(), $("byCabang").value || cabList()[0]); fillSelect($("kcCabang"), cabList(), $("kcCabang").value || cabList()[0]);
    { const kp = $("kcRek").value, R = rekList(); $("kcRek").innerHTML = R.map(r => `<option value="${esc(r.id)}">${esc(rekName(r))}</option>`).join(""); $("kcRek").value = R.some(r => r.id === kp) ? kp : (R.find(r => r.setor)?.id || R[0]?.id || ""); }
    const c = byCabSel(), k = S.rk, ch = chanOf(c), t = todayISO(), days = perDays(k).filter(d => d <= t);
    $("byTitle").textContent = "Metode pembayaran · " + shortCab(c) + " · " + perName(k);
    if (!$("byGrid").contains(document.activeElement)) {
      const cols = [["cash", "Cash"], ...ch.map(r => [r.id, r.tipe === "QR" ? "QRIS" + (r.bank ? " " + r.bank.replace(/^bank\s+/i, "") : "") : r.nama.replace(/\s*·.*$/, "") + (r.bank ? " " + r.bank.replace(/^bank\s+/i, "") : "")]), ["lain", "Transfer / lain"]];
      $("byGrid").innerHTML = `<thead><tr><th>Tanggal</th><th class="r">POS (Zenwel + manual)</th>${cols.map(([, l]) => `<th class="r">${esc(l)}</th>`).join("")}<th class="r">Selisih</th></tr></thead><tbody>` +
        days.map(d => { const B = bayarOf(c, d), pos = sumOf(S.sales.filter(s => s.cabang === c && s.tanggal === d), s => s.total), tot = B ? sumOf(Object.values(B.m || {}), v => +v || 0) : 0, df = B ? tot - pos : null;
          return `<tr data-byd="${d}"><td class="num">${esc(fmtD(d))}<small>${esc(HARI[new Date(d + "T00:00").getDay()])}</small></td><td class="r num">${fmtOrDash(pos)}</td>${cols.map(([id]) => `<td class="r"><input class="by-in num" type="text" inputmode="numeric" data-byc="${esc(id)}" value="${B?.m?.[id] ? fmt(B.m[id]) : ""}" placeholder="0" aria-label="${esc(id)} ${d}"></td>`).join("")}
            <td class="r num ${df != null && Math.abs(df) > 1000 ? "up" : ""}">${df == null ? "<span class=note>belum</span>" : Math.abs(df) <= 1000 ? "✓" : fmt(df)}</td></tr>`; }).join("") + `</tbody>`; }
    const B = S.bayar.filter(b => b.cabang === c && inPer(b.tanggal, k)), filled = B.length;
    $("byHint").textContent = filled + " dari " + days.length + " hari terisi";
    // kas cabang
    const rowsK = cabList().map(cb => { const cash = sumOf(S.bayar.filter(b => b.cabang === cb && inPer(b.tanggal, k)), b => +(b.m?.cash || 0)), setor = sumOf(S.kas.filter(x => x.cabang === cb && inPer(x.tanggal, k)), x => x.jumlah);
      const toko = sumOf([...S.rows.filter(r => r.cabang === cb && inPer(r.tanggal, k) && /cash ?toko/i.test(r.dana || "")), ...biayaPer(k).filter(p => p.unit === cb && /cash ?toko/i.test(p.dana || ""))], x => x.jumlah);
      return { cb, cash, setor, toko, sisa: cash - setor - toko }; });
    $("kcTable").innerHTML = `<thead><tr><th>Cabang</th><th class="r">Cash masuk</th><th class="r">Dipakai (dana "cash toko")</th><th class="r">Disetor ke bank</th><th class="r">Kas belum disetor</th></tr></thead><tbody>` +
      rowsK.map(x => `<tr><td><b>${esc(shortCab(x.cb))}</b></td><td class="r num">${fmtOrDash(x.cash)}</td><td class="r num">${fmtOrDash(x.toko)}</td><td class="r num">${fmtOrDash(x.setor)}</td><td class="r num ${x.sisa > 0 ? "warn-t" : ""}"><b>${fmt(x.sisa)}</b></td></tr>`).join("") +
      `<tr class="total"><td>Total</td><td class="r num">${fmt(sumOf(rowsK, x => x.cash))}</td><td class="r num">${fmt(sumOf(rowsK, x => x.toko))}</td><td class="r num">${fmt(sumOf(rowsK, x => x.setor))}</td><td class="r num">${fmt(sumOf(rowsK, x => x.sisa))}</td></tr></tbody>`;
    const KL = S.kas.filter(x => inPer(x.tanggal, k)).sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || ""));
    $("kcList").innerHTML = KL.length ? `<thead><tr><th>Tanggal setor</th><th>Cabang</th><th>Ke rekening</th><th>Keterangan</th><th class="r">Jumlah</th><th></th></tr></thead><tbody>` +
      KL.map(x => `<tr><td class="num">${esc(fmtDate(x.tanggal))}</td><td>${esc(shortCab(x.cabang))}</td><td>${esc(rekOf(x.rek)?.nama || "–")}</td><td class="k">${esc(x.ket || "")}${x.pengisi ? `<small>${esc(x.pengisi)}</small>` : ""}</td><td class="r num">${fmt(x.jumlah)}</td><td class="r"><button class="btn ghost danger" type="button" data-delkas="${esc(x.id)}">Hapus</button></td></tr>`).join("") + `</tbody>`
      : `<tr><td class="empty">Belum ada setoran cash di ${esc(perName(k))}.</td></tr>`;
  }
  $("byCabang").addEventListener("change", () => { $("byGrid").innerHTML = ""; renderBayar(); });
  $("byGrid").addEventListener("input", e => { const i = e.target.closest("[data-byc]"); if (!i) return; const n = parseRp(i.value); i.value = n ? fmt(n) : ""; });
  $("byGrid").addEventListener("change", async e => { const i = e.target.closest("[data-byc]"); if (!i || !S.db) return; const tr = i.closest("[data-byd]"), d = tr.dataset.byd, c = byCabSel();
    const lk = lockOf(d); if (lk) { toast(lk); return; }
    const m = {}; tr.querySelectorAll("[data-byc]").forEach(x => { const v = parseRp(x.value); if (v) m[x.dataset.byc] = v; });
    const id = slug(c) + "_" + d, doc = { cabang: c, tanggal: d, bulan: d.slice(0, 7), m, by: S.uid || null, at: new Date().toISOString(), pengisi: actorName() };
    try { if (!Object.keys(m).length && bayarOf(c, d)) await S.db.doc("bayar/" + id).delete(); else await S.db.doc("bayar/" + id).set(doc); i.classList.add("saved"); setTimeout(() => i.classList.remove("saved"), 900); }
    catch { toast("Gagal menyimpan metode bayar. Perlu akses Editor."); } });
  $("kcJml").addEventListener("input", e => { const n = parseRp(e.target.value); e.target.value = n ? fmt(n) : ""; });
  $("kcTgl").value = todayISO();
  $("kcForm").addEventListener("submit", async e => { e.preventDefault(); const doc = { cabang: $("kcCabang").value, tanggal: $("kcTgl").value, rek: $("kcRek").value, jumlah: parseRp($("kcJml").value), ket: $("kcKet").value.trim(), tipe: "setor" };
    if (!doc.cabang || !validISO(doc.tanggal) || !(doc.jumlah > 0)) { $("kcMsg").textContent = "Isi cabang, tanggal setor, dan jumlah."; return; }
    const lk = lockOf(doc.tanggal); if (lk) { $("kcMsg").textContent = lk; return; }
    try { await S.db.collection("kas").add({ ...doc, bulan: doc.tanggal.slice(0, 7), pengisi: actorName(), by: S.uid || null, at: new Date().toISOString() }); $("kcJml").value = ""; $("kcKet").value = ""; $("kcMsg").textContent = ""; toast("Setoran " + rp(doc.jumlah) + " tercatat"); }
    catch { $("kcMsg").textContent = "Gagal menyimpan. Hanya role admin yang bisa menyimpan ini."; } });
  $("kcList").addEventListener("click", async e => { const b = e.target.closest("[data-delkas]"); if (!b) return; const x = S.kas.find(y => y.id === b.dataset.delkas), lk = x ? lockOf(x.tanggal) : ""; if (lk) { toast(lk); return; }
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Yakin?"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Hapus"; }, 3000); return; }
    try { await S.db.doc("kas/" + b.dataset.delkas).delete(); toast("Setoran dihapus"); } catch { toast("Gagal menghapus"); } });

  /* ---------- import CSV metode pembayaran (Zenwel) ---------- */
  S.byImp = null;
  function payChan(name, c){ const n = String(name || "").toLowerCase(), ch = chanOf(c), edc = ch.filter(r => r.tipe === "EDC");
    if (/cash|tunai|kas\b/.test(n)) return "cash";
    if (/qr/.test(n)) return ch.find(r => r.tipe === "QR")?.id || "lain";
    if (/mandiri/.test(n)) return edc.find(r => /mandiri/i.test(r.bank + " " + r.nama))?.id || edc[0]?.id || "lain";
    if (/bca/.test(n)) return edc.find(r => /bca/i.test(r.bank + " " + r.nama))?.id || edc[0]?.id || "lain";
    if (/edc|debit|debet|credit|kredit|kartu|card|visa|master|gpn/.test(n)) return (edc.find(r => !/mandiri/i.test(r.bank + " " + r.nama)) || edc[0])?.id || "lain";
    return "lain"; }
  function parsePayCsv(text){
    const rows = parseCSV(text); const isM = c => /payment|pembayaran|metode|method|tipe bayar|jenis bayar|bayar/i.test(c), isA = c => /total|amount|jumlah|nominal|collected|net|paid|nilai/i.test(c);
    const hi = rows.findIndex(r => r.some(isM) && r.some(isA)); if (hi < 0) throw new Error("Kolom metode pembayaran & jumlah tidak ketemu.");
    const H = rows[hi], cM = H.findIndex(isM), cD = H.findIndex(c => /tanggal|date|tgl|waktu|time/i.test(c));
    const amtCols = H.map((c, i) => i).filter(i => i !== cM && isA(H[i]) && !/transaksi|transaction|count|qty/i.test(H[i])), cA = amtCols.find(i => /total|amount|collected|paid/i.test(H[i])) ?? amtCols[0], cN = H.findIndex(c => /transaksi|transaction|count|qty/i.test(c));
    const out = {}; let n = 0;
    rows.slice(hi + 1).forEach(r => { const m = String(r[cM] ?? "").trim(); if (!m || /^(grand )?total$/i.test(m)) return; const v = numAny(r[cA]); if (!v) return;
      const d = cD > -1 ? parseTgl(String(r[cD] || "").trim().split(/[ T]/)[0]) : ""; const key = (d || "_") + "|" + m; (out[key] ||= { tanggal: d, metode: m, v: 0, n: 0 }); out[key].v += v; out[key].n += cN > -1 ? (parseInt(String(r[cN]).replace(/[^\d]/g, ""), 10) || 1) : 1; n++; });
    if (!n) throw new Error("Tidak ada baris pembayaran di file ini.");
    return Object.values(out); }
  function renderByImp(){
    const P = S.byImp; if (!P) { $("byImpPrev").innerHTML = ""; return; } const c = byCabSel(), ch = chanOf(c);
    const opts = [["cash", "Cash"], ...ch.map(r => [r.id, r.nama + (r.bank ? " · " + r.bank : "")]), ["lain", "Transfer / lain"]];
    const dates = [...new Set(P.rows.map(x => x.tanggal || P.tgl))].sort();
    $("byImpPrev").innerHTML = `<div class="scroll" style="margin-top:10px"><table><thead><tr><th>Tanggal</th><th>Metode di file</th><th class="r">Transaksi</th><th class="r">Jumlah</th><th>Masuk ke kolom</th></tr></thead><tbody>` +
      P.rows.map((x, i) => `<tr><td class="num">${esc(fmtDate(x.tanggal || P.tgl))}</td><td>${esc(x.metode)}</td><td class="r num">${x.n}</td><td class="r num">${fmt(x.v)}</td><td><select data-byimp="${i}">${opts.map(([id, l]) => `<option value="${esc(id)}" ${id === x.ch ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></td></tr>`).join("") +
      `</tbody></table></div><div class="form-foot"><span class="note">${esc(P.file)} · ${esc(shortCab(c))} · ${dates.length} hari. Data metode bayar hari itu akan diganti dengan isi file.</span><button class="btn primary" type="button" id="byImpGo">Simpan ke metode bayar</button></div>`; }
  $("byImpF").addEventListener("change", async e => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const c = byCabSel();
    try { const rows = parsePayCsv(await f.text()), fm = f.name.match(/(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})/), tgl = fm && fm[1] === fm[2] ? fm[1] : $("byImpTgl").value;
      if (rows.some(x => !x.tanggal) && !validISO(tgl)) { $("byImpPrev").innerHTML = `<p class="warn-t">File tidak punya kolom tanggal. Isi tanggalnya dulu di atas, lalu pilih file lagi.</p>`; return; }
      rows.forEach(x => x.ch = payChan(x.metode, c)); S.byImp = { rows, tgl, file: f.name }; renderByImp(); }
    catch (err) { S.byImp = null; $("byImpPrev").innerHTML = `<p class="warn-t">File tidak terbaca: ${esc(err?.message || "format tidak dikenal")}</p>`; } });
  $("byImpPrev").addEventListener("change", e => { const s2 = e.target.closest("[data-byimp]"); if (s2 && S.byImp) S.byImp.rows[+s2.dataset.byimp].ch = s2.value; });
  $("byImpPrev").addEventListener("click", async e => { if (e.target.id !== "byImpGo" || !S.byImp) return; const b = e.target, c = byCabSel(), P = S.byImp, byD = {};
    P.rows.forEach(x => { const d = x.tanggal || P.tgl; (byD[d] ||= {}); byD[d][x.ch] = (byD[d][x.ch] || 0) + Math.round(x.v); });
    const locked = Object.keys(byD).filter(d => lockOf(d)); if (locked.length) { toast(lockOf(locked[0])); return; }
    b.disabled = true; b.textContent = "Menyimpan…";
    try { for (const [d, m] of Object.entries(byD)) await S.db.doc("bayar/" + slug(c) + "_" + d).set({ cabang: c, tanggal: d, bulan: d.slice(0, 7), m, sumber: "CSV", file: P.file, by: S.uid || null, at: new Date().toISOString(), pengisi: actorName() });
      S.byImp = null; renderByImp(); $("byGrid").innerHTML = ""; toast(Object.keys(byD).length + " hari metode bayar tersimpan"); renderBayar(); }
    catch { b.disabled = false; b.textContent = "Simpan ke metode bayar"; toast("Gagal menyimpan. Hanya role admin yang bisa menyimpan ini."); } });

  /* ---------- Ask Boss: karyawan tanya owner, owner balas langsung ---------- */
  S.abDoc = null; S.abAll = []; S.abAllLoaded = false; S.abOpen = ""; S.abSentWa = null;
  const AB_TOPIK = ["Cara isi data di aplikasi", "Penempatan / jadwal kerja", "Konseling kerja", "Lainnya"];
  const isBoss = () => S.appUser ? myRole() === "owner" : !!S.isOwner;
  const abWhen = at => { const d = new Date(at); return isNaN(d) ? "" : fmtDate(isoOf(d)) + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  const abMe = () => S.appUser?.id || "";
  const abThreadsAll = () => S.abAll.flatMap(d => (d.threads || []).map(t => ({ ...t, doc: d.id })));
  const abMine = () => (S.abDoc?.threads || []).filter(t => !abMe() || t.from === abMe()).map(t => ({ ...t, doc: S.uid }));
  const abUnreadBoss = () => isBoss() ? abThreadsAll().filter(t => !t.bossSeen).length : 0;
  const abUnreadMe = () => abMine().filter(t => !t.userSeen).length;
  const abUnread = () => isBoss() ? abUnreadBoss() : abUnreadMe();
  function abWaText(t){ return ["💬 *Ask Boss* dari " + (t.nama || t.from) + (t.cabang ? " (" + shortCab(t.cabang) + ")" : ""), "Topik: " + t.topik, "", t.pesan, "", "Balas di: " + ARTIFACT_URL + "#ask"].join("\n"); }
  async function abWrite(docId, fn){
    const ref = S.db.doc("askboss/" + docId), snap = await ref.get(), cur = snap.exists ? snap.data() : { uid: docId, threads: [] };
    const threads = fn([...(cur.threads || [])]); const doc = { uid: cur.uid || docId, threads, updatedAt: new Date().toISOString() };
    if (snap.exists) await ref.update(doc); else await ref.set(doc); }
  function abThreadHtml(t, boss){
    const msgs = [{ nama: t.nama || t.from, at: t.at, text: t.pesan, boss: false }, ...(t.replies || [])];
    return `<div class="ab-t ${t.status === "selesai" ? "done" : ""}" data-abt="${esc(t.doc)}|${esc(t.id)}">
      <div class="ab-h"><div style="min-width:0"><b>${esc(t.topik)}</b><small>${esc(t.nama || t.from)}${t.role ? " · " + esc(roleLabel(t.role)) : ""}${t.cabang ? " · " + esc(shortCab(t.cabang)) : ""} · ${esc(abWhen(t.at))}</small></div>
        <span class="pill ${t.status === "selesai" ? "ok" : (boss ? !t.bossSeen : !t.userSeen) ? "no" : (t.replies || []).some(r => r.boss) ? "ok" : "warn"}">${t.status === "selesai" ? "Selesai" : (boss ? !t.bossSeen : !t.userSeen) ? "Baru" : (t.replies || []).some(r => r.boss) ? "Dibalas" : "Menunggu"}</span></div>
      ${S.abOpen === t.doc + "|" + t.id ? `<div class="ab-msgs">${msgs.map(m => `<div class="msg ${m.boss ? "assistant" : "user"} ${boss ? "flip" : ""}"><div class="bub"><small>${esc(m.boss ? "Owner · " + (m.nama || "") : m.nama || "")} · ${esc(abWhen(m.at))}</small>${esc(m.text)}</div></div>`).join("")}</div>
        ${t.status === "selesai" ? `<p class="note" style="margin:6px 0 0">Percakapan ditandai selesai.</p>` : `<form class="ab-reply" data-abform="${esc(t.doc)}|${esc(t.id)}"><textarea rows="2" maxlength="1000" placeholder="${boss ? "Tulis balasan untuk " + esc(t.nama || t.from) : "Tambah pesan"}" aria-label="Balasan"></textarea><button class="btn primary" type="submit">${boss ? "Balas" : "Kirim"}</button></form>`}
        <div class="ab-act">${boss && t.status !== "selesai" ? `<button class="btn ghost" type="button" data-abdone="${esc(t.doc)}|${esc(t.id)}">Tandai selesai</button>` : ""}<button class="btn ghost" type="button" data-abtog="${esc(t.doc)}|${esc(t.id)}">Tutup</button></div>`
      : `<p class="ab-prev">${esc(String(msgs[msgs.length - 1].text).slice(0, 140))}</p><button class="btn ghost" type="button" data-abtog="${esc(t.doc)}|${esc(t.id)}">Buka${(t.replies || []).length ? " · " + t.replies.length + " balasan" : ""}</button>`}</div>`;
  }
  function renderBoss(){
    if (S.leaf !== "ask/boss") return;
    const boss = isBoss(), on = !!S.db && !!S.uid;
    $("axForm").hidden = boss || !on; $("axInbox").hidden = !boss; $("axMineWrap").hidden = boss;
    $("axNote").textContent = !on ? "Ask Boss butuh login dan koneksi ke server." : boss ? "Pertanyaan dari karyawan masuk ke sini. Balasan kamu langsung muncul di halaman Ask Boss karyawan." : "Bingung cara isi data, soal penempatan, atau perlu ngobrol soal kerjaan? Tanya langsung ke owner. Balasan owner muncul di bawah.";
    if (!$("axTopik").options.length) $("axTopik").innerHTML = optList(AB_TOPIK);
    if (boss) { const L = abThreadsAll().sort((a, b) => (a.status === "selesai") - (b.status === "selesai") || (+!!a.bossSeen) - (+!!b.bossSeen) || String(b.lastAt || b.at).localeCompare(String(a.lastAt || a.at)));
      $("axInboxHint").textContent = abUnreadBoss() + " baru · " + L.filter(t => t.status !== "selesai").length + " terbuka";
      $("axList").innerHTML = !S.abAllLoaded ? `<div class="empty">Memuat…</div>` : L.length ? L.map(t => abThreadHtml(t, true)).join("") : `<div class="empty">Belum ada pertanyaan dari karyawan.</div>`; }
    else { const L = abMine().sort((a, b) => String(b.lastAt || b.at).localeCompare(String(a.lastAt || a.at)));
      $("axMine").innerHTML = L.length ? L.map(t => abThreadHtml(t, false)).join("") : `<div class="empty">Belum ada pertanyaan.</div>`;
      const num = waNum(hrCfg().ownerWa); $("axWa").hidden = !S.abSentWa || !num; if (S.abSentWa && num) $("axWa").href = waLink(num, abWaText(S.abSentWa)); }
    // tandai sudah dibaca saat thread dibuka
    if (S.abOpen) { const [d, id] = S.abOpen.split("|"), t = (boss ? abThreadsAll() : abMine()).find(x => x.doc === d && x.id === id);
      if (t && (boss ? !t.bossSeen : !t.userSeen) && !S.abMarking) { S.abMarking = true; abWrite(d, th => th.map(x => x.id === id ? { ...x, [boss ? "bossSeen" : "userSeen"]: true } : x)).catch(() => {}).finally(() => { S.abMarking = false; }); } }
  }
  $("axForm").addEventListener("submit", async e => { e.preventDefault(); const msg = $("axMsg"), pesan = $("axPesan").value.trim();
    if (pesan.length < 5) { msg.textContent = "Tulis pertanyaannya dulu."; return; } if (!S.db || !S.uid) { msg.textContent = "Penyimpanan belum tersambung."; return; }
    const t = { id: newId(), from: abMe() || "tamu", nama: S.appUser?.nama || actorName(), role: myRole(), cabang: S.appUser?.cabang || S.staff || "", topik: $("axTopik").value, pesan, at: new Date().toISOString(), lastAt: new Date().toISOString(), status: "baru", replies: [], bossSeen: false, userSeen: true };
    msg.textContent = "Mengirim…";
    try { await abWrite(S.uid, th => [...th, t]); $("axPesan").value = ""; msg.textContent = ""; S.abSentWa = t; S.abOpen = S.uid + "|" + t.id; toast("Terkirim ke owner"); renderBoss(); }
    catch (err) { msg.textContent = err?.code === "invalid_argument" || err?.code === "permission_denied" ? "Gagal mengirim. Coba login ulang." : "Gagal mengirim, coba lagi."; } });
  document.addEventListener("click", async e => {
    const tg = e.target.closest("[data-abtog]"); if (tg) { S.abOpen = S.abOpen === tg.dataset.abtog ? "" : tg.dataset.abtog; renderBoss(); return; }
    const dn = e.target.closest("[data-abdone]"); if (dn) { const [d, id] = dn.dataset.abdone.split("|"); try { await abWrite(d, th => th.map(x => x.id === id ? { ...x, status: "selesai", userSeen: false, lastAt: new Date().toISOString() } : x)); toast("Ditandai selesai"); } catch { toast("Gagal menyimpan"); } } });
  document.addEventListener("submit", async e => { const f = e.target.closest("[data-abform]"); if (!f) return; e.preventDefault(); const ta = f.querySelector("textarea"), text = ta.value.trim(); if (!text) return;
    const [d, id] = f.dataset.abform.split("|"), boss = isBoss(), at = new Date().toISOString(), btn = f.querySelector("button"); btn.disabled = true;
    try { await abWrite(d, th => th.map(x => x.id === id ? { ...x, replies: [...(x.replies || []), { at, nama: S.appUser?.nama || actorName(), boss, text }], lastAt: at, status: boss ? "dibalas" : "baru", bossSeen: boss, userSeen: !boss } : x));
      ta.value = ""; toast(boss ? "Balasan terkirim" : "Pesan terkirim"); }
    catch { toast("Gagal mengirim"); } finally { btn.disabled = false; } });

  /* ---------- Database customer ---------- */
  S.cust = {}; S.custLoaded = false; S.ctx = []; S.ctxLoaded = false; S.unsubCtx = null; S.ctxKeys = ""; S.cuSel = ""; S.cuParsed = null;
  const hpNorm = s => { let d = String(s || "").replace(/[^\d]/g, ""); if (!d) return ""; if (d.startsWith("0")) d = "62" + d.slice(1); else if (d.startsWith("8")) d = "62" + d; return d.length >= 9 ? d : ""; };
  const hpShow = h => h ? "0" + String(h).replace(/^62/, "").replace(/(\d{3})(\d{4})(\d+)/, "$1-$2-$3") : "–";
  const strHash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  const custKey = (nama, hp) => { const h = hpNorm(hp); return h ? h : "n-" + slug(nama).slice(0, 40); };
  const custBucket = key => /^\d+$/.test(key) ? "b" + key.slice(-2) : "b" + String(strHash(key) % 100).padStart(2, "0");
  const custMonths = () => { const r = $("cuRange")?.value || "per"; if (r === "per") return perBulans(S.rk); const t = todayISO().slice(0, 7), [y, m] = t.split("-").map(Number), from = (m === 12 ? y : y - 1) + "-" + String(m === 12 ? 1 : m + 1).padStart(2, "0"); return monthsBetween(prevMonth(from), t); };
  function subscribeCust(){ if (!S.db || !S.admin) return; const ms = custMonths(), key = ms.join(","); if (key === S.ctxKeys) return; S.ctxKeys = key; S.unsubCtx?.(); S.ctxLoaded = false;
    S.unsubCtx = subMany("custtx", "bulan", ms, d => { S.ctx = d; S.ctxLoaded = true; renderAll(); }, () => { S.ctxLoaded = true; renderAll(); }); }
  const custInRange = () => { const r = $("cuRange")?.value || "per"; if (r === "per") return x => inPer(x.tanggal, S.rk); const from = addDays(todayISO(), -365); return x => x.tanggal >= from; };
  function custModel(){
    const inR = custInRange(), tx = S.ctx.filter(inR).flatMap(d => (d.tx || []).map(x => ({ ...x, tanggal: d.tanggal, cabang: d.cabang, doc: d.id }))), by = {};
    Object.values(S.cust).forEach(b => Object.entries(b.list || {}).forEach(([key, c]) => by[key] = { key, nama: c.nama, hp: c.hp, catatan: c.catatan || "", rating: c.rating || 0, tag: c.tag || "", cabang: c.cabang || "", tx: [], doc: true }));
    tx.forEach(x => { const key = x.key || custKey(x.nama, x.hp); const c = by[key] ||= { key, nama: x.nama, hp: hpNorm(x.hp), catatan: "", rating: 0, tag: "", cabang: x.cabang, tx: [] }; c.tx.push(x); if (!c.nama && x.nama) c.nama = x.nama; });
    return Object.values(by).map(c => { const lay = {}; c.tx.forEach(x => (x.layanan || "").split(/\s*[,;+]\s*/).filter(Boolean).forEach(l => lay[l] = (lay[l] || 0) + 1));
      const cabs = {}; c.tx.forEach(x => cabs[x.cabang] = (cabs[x.cabang] || 0) + 1);
      return { ...c, n: c.tx.length, total: sumOf(c.tx, x => x.total), last: c.tx.map(x => x.tanggal).sort().pop() || "", fav: Object.entries(lay).sort((a, b) => b[1] - a[1])[0]?.[0] || "", cab: Object.entries(cabs).sort((a, b) => b[1] - a[1])[0]?.[0] || c.cabang }; });
  }
  const stars = n => n ? "★".repeat(n) + "☆".repeat(5 - n) : "–";
  function renderCust(){
    if (!S.leaf.startsWith("cust")) { if (!$("cuSheet").hidden) { $("cuSheet").hidden = true; S.cuSel = ""; } return; } if (!adminGate("cuBody", "cuRO")) return; subscribeCust();
    const sub = S.leaf.split("/")[1], M = custModel(), cabs = cabList();
    { const kp = $("cuCab").value; $("cuCab").innerHTML = `<option value="">Semua cabang</option>` + optList(cabs, kp); }
    fillSelect($("ctCabang"), cabs, $("ctCabang").value || cabs[0]); fillSelect($("caCab"), cabs, $("caCab").value); fillSelect($("cuImpCab"), cabs, $("cuImpCab").value);
    const act = M.filter(c => c.n), rpt = act.filter(c => c.n > 1);
    $("cuKpis").innerHTML = [["Customer", String(M.length), act.length + " datang di rentang ini"], ["Customer kembali", String(rpt.length), act.length ? pct(rpt.length / act.length) + " dari yang datang" : "–"], ["Total transaksi", String(sumOf(act, c => c.n)), rpShort(sumOf(act, c => c.total))], ["Rata-rata per kunjungan", act.length ? rpShort(sumOf(act, c => c.total) / Math.max(1, sumOf(act, c => c.n))) : "–", "dari transaksi tercatat"]]
      .map(([l, v, s2]) => `<div class="kpi"><span class="l">${l}</span><span class="v num">${v}</span><span class="s">${s2}</span></div>`).join("");
    if (sub === "db" || !sub) {
      const q = $("cuQ").value.trim().toLowerCase(), qd = q.replace(/[^\d]/g, ""), fc = $("cuCab").value, so = $("cuSort").value;
      let L = M.filter(c => (!fc || c.cab === fc) && (!q || (c.nama || "").toLowerCase().includes(q) || (qd.length >= 3 && String(c.hp || "").includes(qd.replace(/^0/, "")))));
      L.sort(so === "total" ? (a, b) => b.total - a.total : so === "n" ? (a, b) => b.n - a.n : so === "rating" ? (a, b) => b.rating - a.rating : so === "nama" ? (a, b) => (a.nama || "").localeCompare(b.nama || "") : (a, b) => (b.last || "").localeCompare(a.last || ""));
      $("cuHint").textContent = L.length + " customer";
      $("cuTable").innerHTML = !S.custLoaded || !S.ctxLoaded ? `<tr><td class="empty">Memuat…</td></tr>` : L.length ? `<thead><tr><th>Customer</th><th>No. HP</th><th>Cabang</th><th class="r">Kunjungan</th><th class="r">Total belanja</th><th>Terakhir</th><th>Layanan favorit</th><th>Rating</th><th>Catatan</th></tr></thead><tbody>` +
        L.slice(0, 300).map(c => `<tr class="cu-row" data-cu="${esc(c.key)}"><td><b>${esc(c.nama || "(tanpa nama)")}</b>${c.tag ? ` <span class="tag cu-tag ${c.tag === "Perhatian" ? "warnt" : ""}">${esc(c.tag)}</span>` : ""}</td><td class="num">${c.hp ? `<a href="https://wa.me/${esc(c.hp)}" target="_blank" rel="noopener">${esc(hpShow(c.hp))}</a>` : "–"}</td><td>${esc(shortCab(c.cab || ""))}</td><td class="r num">${c.n}</td><td class="r num">${fmtOrDash(c.total)}</td><td class="num">${c.last ? esc(fmtDate(c.last)) : "–"}</td><td>${esc(c.fav || "–")}</td><td class="stars">${stars(c.rating)}</td><td class="k">${esc((c.catatan || "").slice(0, 60))}</td></tr>`).join("") + `</tbody>` + (L.length > 300 ? `<caption class="note">Menampilkan 300 dari ${L.length}. Pakai pencarian.</caption>` : "")
        : `<tr><td class="empty">${M.length ? "Tidak ada yang cocok." : "Belum ada data customer. Import transaksi Zenwel atau input manual di tab Transaksi."}</td></tr>`;
      renderCuSheet(M);
    }
    if (sub === "tx") {
      const k = S.rk, L = S.ctx.filter(d => inPer(d.tanggal, k)).flatMap(d => (d.tx || []).map(x => ({ ...x, tanggal: d.tanggal, cabang: d.cabang, doc: d.id }))).sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || ""));
      $("ctListTitle").textContent = "Transaksi customer · " + perName(k);
      $("ctList").innerHTML = L.length ? `<thead><tr><th>Tanggal</th><th>Cabang</th><th>Customer</th><th>No. HP</th><th>Layanan</th><th>Metode</th><th>Therapist</th><th class="r">Total</th><th></th></tr></thead><tbody>` +
        L.slice(0, 500).map(x => `<tr><td class="num">${esc(fmtDate(x.tanggal))}</td><td>${esc(shortCab(x.cabang))}</td><td><b>${esc(x.nama || "–")}</b>${x.inv ? `<small>${esc(x.inv)}</small>` : ""}</td><td class="num">${esc(hpShow(hpNorm(x.hp)))}</td><td class="k">${esc(x.layanan || "–")}</td><td>${esc(x.metode || "–")}</td><td>${esc(x.therapist || "–")}</td><td class="r num">${fmt(x.total || 0)}</td><td class="r"><button class="btn ghost danger" type="button" data-delct="${esc(x.doc)}|${esc(x.id)}">Hapus</button></td></tr>`).join("") +
        `<tr class="total"><td colspan="7">Total · ${L.length} transaksi</td><td class="r num">${fmt(sumOf(L, x => x.total))}</td><td></td></tr></tbody>`
        : `<tr><td class="empty">Belum ada transaksi customer di ${esc(perName(k))}.</td></tr>`;
    }
  }
  function renderCuSheet(M){
    const c = S.cuSel && (M || custModel()).find(x => x.key === S.cuSel); $("cuSheet").hidden = !c; if (!c) return;
    if ($("cuSheet").dataset.key !== c.key) { $("cuSheet").dataset.key = c.key; $("cuNama").value = c.nama || ""; $("cuHp").value = c.hp ? hpShow(c.hp).replace(/-/g, "") : ""; $("cuCat").value = c.catatan || ""; $("cuTag").value = c.tag || ""; S.cuRate = c.rating || 0; }
    $("cuRate").innerHTML = [1, 2, 3, 4, 5].map(n => `<button type="button" data-rate="${n}" aria-pressed="${n <= S.cuRate}" aria-label="${n} bintang">★</button>`).join("");
    $("cuSheetTitle").textContent = c.nama || "Customer";
    $("cuSheetSub").textContent = (c.hp ? hpShow(c.hp) + " · " : "") + c.n + " kunjungan · " + rp(c.total);
    $("cuHist").innerHTML = c.tx.length ? `<thead><tr><th>Tanggal</th><th>Cabang</th><th>Layanan</th><th>Therapist</th><th class="r">Total</th></tr></thead><tbody>` + [...c.tx].sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || "")).map(x => `<tr><td class="num">${esc(fmtDate(x.tanggal))}</td><td>${esc(shortCab(x.cabang))}</td><td class="k">${esc(x.layanan || "–")}</td><td>${esc(x.therapist || "–")}</td><td class="r num">${fmt(x.total || 0)}</td></tr>`).join("") + `</tbody>` : `<tr><td class="empty">Belum ada transaksi di rentang ini.</td></tr>`;
  }
  ["cuQ"].forEach(id => $(id).addEventListener("input", renderCust)); ["cuCab","cuSort"].forEach(id => $(id).addEventListener("change", renderCust));
  $("cuRange").addEventListener("change", () => { subscribeCust(); renderCust(); });
  $("cuTable").addEventListener("click", e => { const r = e.target.closest("[data-cu]"); if (!r || e.target.closest("a")) return; S.cuSel = r.dataset.cu; $("cuSheet").dataset.key = ""; renderCust(); });
  $("cuClose").addEventListener("click", () => { S.cuSel = ""; renderCust(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("cuSheet").hidden) { S.cuSel = ""; renderCust(); } });
  $("cuSheet").addEventListener("click", e => { if (e.target === $("cuSheet")) { S.cuSel = ""; renderCust(); } const b = e.target.closest("[data-rate]"); if (b) { S.cuRate = +b.dataset.rate === S.cuRate ? 0 : +b.dataset.rate; renderCuSheet(); } });
  async function custSave(key, data){ const b = custBucket(key), ref = S.db.doc("cust/" + b), cur = S.cust[b];
    const list = { ...(cur?.list || {}) }; list[key] = { ...(list[key] || {}), ...data, at: new Date().toISOString() };
    if (cur) await ref.update({ list }); else await ref.set({ list }); }
  $("cuSave").addEventListener("click", async () => { const old = S.cuSel; if (!old) return; const nama = $("cuNama").value.trim(), hp = hpNorm($("cuHp").value);
    if (!nama) { $("cuMsg").textContent = "Isi nama customer."; return; } const key = hp || old;
    $("cuMsg").textContent = "Menyimpan…";
    try { await custSave(key, { nama, hp, catatan: $("cuCat").value.trim(), rating: S.cuRate || 0, tag: $("cuTag").value, cabang: custModel().find(x => x.key === old)?.cab || "" });
      if (key !== old && S.cust[custBucket(old)]?.list?.[old]) { const b = custBucket(old), list = { ...S.cust[b].list }; delete list[old]; await S.db.doc("cust/" + b).update({ list }); }
      S.cuSel = key; $("cuSheet").dataset.key = ""; $("cuMsg").textContent = ""; toast("Data customer tersimpan"); }
    catch { $("cuMsg").textContent = "Gagal menyimpan. Hanya role admin yang bisa menyimpan ini."; } });
  $("cuAddBtn").addEventListener("click", () => { $("cuAdd").hidden = !$("cuAdd").hidden; });
  $("cuAdd").addEventListener("submit", async e => { e.preventDefault(); const nama = $("caNama").value.trim(), hp = hpNorm($("caHp").value);
    if (!nama) { $("caMsg").textContent = "Isi nama."; return; } if ($("caHp").value.trim() && !hp) { $("caMsg").textContent = "Nomor HP belum benar."; return; }
    const key = custKey(nama, hp); if (custModel().some(c => c.key === key && c.doc)) { $("caMsg").textContent = "Customer dengan nomor ini sudah ada."; return; }
    try { await custSave(key, { nama, hp, catatan: $("caCat").value.trim(), rating: 0, tag: "", cabang: $("caCab").value || "", dibuat: new Date().toISOString() }); $("cuAdd").reset(); $("cuAdd").hidden = true; $("caMsg").textContent = ""; toast("Customer ditambahkan"); }
    catch { $("caMsg").textContent = "Gagal menyimpan. Hanya role admin yang bisa menyimpan ini."; } });
  // ---- transaksi customer: manual & import CSV
  async function ctAdd(rows){ const byD = {}; rows.forEach(x => (byD[slug(x.cabang) + "_" + x.tanggal] ||= { cabang: x.cabang, tanggal: x.tanggal, xs: [] }).xs.push(x)); let n = 0, dup = 0;
    for (const [id, g] of Object.entries(byD)) { const ref = S.db.doc("custtx/" + id), snap = await ref.get(), old = snap.exists ? snap.data() : null, tx = [...(old?.tx || [])];
      const have = new Set(tx.map(x => (x.inv || "") + "|" + (x.key || "") + "|" + x.total + "|" + normTx(x.layanan)));
      g.xs.forEach(x => { const key = custKey(x.nama, x.hp), t = { id: newId(), nama: String(x.nama || "").slice(0, 60), hp: hpNorm(x.hp), key, layanan: String(x.layanan || "").slice(0, 120), total: Math.round(+x.total || 0), metode: String(x.metode || "").slice(0, 30), therapist: String(x.therapist || "").slice(0, 40), inv: String(x.inv || "").slice(0, 40), src: x.src || "manual" };
        const kk = t.inv + "|" + t.key + "|" + t.total + "|" + normTx(t.layanan); if (have.has(kk)) { dup++; return; } have.add(kk); tx.push(t); n++; });
      const doc = { cabang: g.cabang, tanggal: g.tanggal, bulan: g.tanggal.slice(0, 7), tx, by: S.uid || null, at: new Date().toISOString() }; await ref.set(doc); }
    return { n, dup }; }
  $("ctTgl").value = todayISO();
  $("ctJml").addEventListener("input", e => { const n = parseRp(e.target.value); e.target.value = n ? fmt(n) : ""; });
  $("ctForm").addEventListener("submit", async e => { e.preventDefault(); const x = { tanggal: $("ctTgl").value, cabang: $("ctCabang").value, nama: $("ctNama").value.trim(), hp: $("ctHp").value, layanan: $("ctLay").value.trim(), total: parseRp($("ctJml").value), metode: $("ctMet").value, therapist: $("ctTer").value.trim(), inv: $("ctInv").value.trim(), src: "manual" };
    if (!validISO(x.tanggal) || !x.cabang || !x.nama) { $("ctMsg").textContent = "Isi tanggal, cabang, dan nama customer."; return; }
    if ($("ctHp").value.trim() && !hpNorm(x.hp)) { $("ctMsg").textContent = "Nomor HP belum benar."; return; }
    $("ctMsg").textContent = "Menyimpan…";
    try { const r = await ctAdd([x]); $("ctMsg").textContent = ""; toast(r.n ? "Transaksi customer tersimpan" : "Transaksi ini sudah ada"); ["ctNama","ctHp","ctLay","ctJml","ctTer","ctInv"].forEach(id => $(id).value = ""); }
    catch { $("ctMsg").textContent = "Gagal menyimpan. Hanya role admin yang bisa menyimpan ini."; } });
  function parseCustCsv(text){
    const rows = parseCSV(text), hi = rows.findIndex(r => r.some(c => /nama|name|customer|pelanggan|client/i.test(c)) && r.some(c => /tanggal|date|tgl|waktu/i.test(c))); if (hi < 0) throw new Error("Kolom tanggal & nama customer tidak ketemu.");
    const H = rows[hi].map(normH), col = (...ks) => H.findIndex(h => ks.some(k2 => h.includes(k2)));
    const c = { t: col("tanggal","date","tgl","waktu"), cab: col("cabang","outlet","branch","lokasi","store"), n: col("namacustomer","customername","customer","pelanggan","client","nama","name"), hp: col("hp","phone","telp","telepon","whatsapp","wa","mobile","nomor"),
      l: col("layanan","service","item","treatment","produk","product"), tot: col("total","grandtotal","amount","jumlah","nominal"), m: col("metode","payment","pembayaran","bayar"), th: col("therapist","staff","terapis","karyawan","beautician"), inv: col("invoice","nota","noinv","receipt","order") };
    const out = [], skip = []; rows.slice(hi + 1).forEach((r, i) => { const t = parseTgl(String(r[c.t] || "").trim().split(/[ T]/)[0]); const nama = String(r[c.n] ?? "").trim();
      if (!t || !nama) { if (r.some(v => String(v).trim())) skip.push(i + hi + 2); return; }
      const cab = c.cab > -1 ? findCab(r[c.cab]) : $("cuImpCab").value; if (!cab) { skip.push(i + hi + 2); return; }
      out.push({ tanggal: t, cabang: cab, nama, hp: c.hp > -1 ? r[c.hp] : "", layanan: c.l > -1 ? r[c.l] : "", total: c.tot > -1 ? numAny(r[c.tot]) : 0, metode: c.m > -1 ? r[c.m] : "", therapist: c.th > -1 ? r[c.th] : "", inv: c.inv > -1 ? r[c.inv] : "", src: "CSV" }); });
    return { out, skip, cols: Object.entries(c).filter(([, v]) => v > -1).map(([k2]) => k2) }; }
  $("cuImpF").addEventListener("change", async e => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    try { S.cuParsed = parseCustCsv(await f.text()); S.cuParsed.file = f.name; const P = S.cuParsed;
      $("cuImpPrev").innerHTML = `<div class="alert"><span class="pill ${P.out.length ? "ok" : "warn"}">${P.out.length} baris</span><div style="flex:1;min-width:0"><b>${esc(f.name)}</b><div class="note">${P.out.length} transaksi siap diimport, ${new Set(P.out.map(x => custKey(x.nama, x.hp))).size} customer${P.skip.length ? " · " + P.skip.length + " baris dilewati (tanggal/nama/cabang kosong): baris " + listCap(P.skip.map(String), 8) : ""}</div></div><button class="btn primary" type="button" id="cuImpGo" ${P.out.length ? "" : "disabled"}>Import</button></div>`; }
    catch (err) { S.cuParsed = null; $("cuImpPrev").innerHTML = `<p class="warn-t">File tidak terbaca: ${esc(err?.message || "format tidak dikenal")} Coba pakai template.</p>`; } });
  $("cuImpPrev").addEventListener("click", async e => { if (e.target.id !== "cuImpGo" || !S.cuParsed) return; const b = e.target; b.disabled = true; b.textContent = "Mengimport…";
    try { const r = await ctAdd(S.cuParsed.out); S.cuParsed = null; $("cuImpPrev").innerHTML = ""; toast(r.n + " transaksi diimport" + (r.dup ? " · " + r.dup + " sudah ada" : "")); }
    catch { b.disabled = false; b.textContent = "Import"; toast("Gagal import sebagian. Coba lagi."); } });
  $("cuTpl").addEventListener("click", async () => { if (!S.dl) return; try { await S.dl.save({ filename: "Template transaksi customer.csv", data: "﻿Tanggal,Cabang,Nama Customer,No HP,Layanan,Total,Metode Bayar,Therapist,No Invoice\n2026-10-05,Tebet,Rina Ayu,081234567890,Eyelash Extension Classic,250000,QRIS,Hapni,INV-0012\n" }); } catch {} });
  $("ctList").addEventListener("click", async e => { const b = e.target.closest("[data-delct]"); if (!b) return; const [d, id] = b.dataset.delct.split("|");
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Yakin?"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Hapus"; }, 3000); return; }
    try { const doc = S.ctx.find(x => x.id === d); const tx = (doc?.tx || []).filter(x => x.id !== id); if (tx.length) await S.db.doc("custtx/" + d).update({ tx }); else await S.db.doc("custtx/" + d).delete(); toast("Transaksi dihapus"); } catch { toast("Gagal menghapus"); } });

  /* ---------- v15: penghubung ---------- */
  document.addEventListener("click", e => { const b = e.target.closest("[data-nav]"); if (!b || b.closest("#secNav,#terNav,#tbPrev")) return; go(b.dataset.nav); window.scrollTo({ top: 0 }); });
  function bcKatSync(){ const p = $("bcCabang").value === "Pusat", want = p ? "p" : "c"; if ($("bcKat").dataset.set === want) return; const keep = $("bcKat").value;
    $("bcKat").innerHTML = optList(p ? PST_KAT : CAB_KAT, keep); $("bcKat").dataset.set = want; $("bcKatNote").hidden = !p; }
  $("bcCabang").addEventListener("change", bcKatSync);
  function renderDashV15(){
    if (!S.leaf.startsWith("dash")) return;
    const ok = canBank(); $("dBankPanel").hidden = !ok; if (ok) $("dBank").innerHTML = saldoHtml(saldoModel(), true);
    const extra = [];
    if (isBoss()) { const n = abUnreadBoss(); if (n) extra.push(["no", n + " pertanyaan Ask Boss belum dibaca", "dari karyawan · balas langsung di Ask Me! → Ask Boss", "ask/boss"]); }
    if (ok) { const n = bankOpen(); if (n) extra.push(["no", n + " temuan crosscheck mutasi", "uang masuk di bank tidak cocok dengan POS", "bank/cocok"]); }
    const box = $("dAlerts"); box.querySelectorAll(".alert.v15").forEach(x => x.remove());
    if (extra.length) { box.querySelector(".empty")?.remove(); box.insertAdjacentHTML("afterbegin", extra.map(([ty, a, b, g]) => `<div class="alert v15"><span class="pill ${ty}">Penting</span><div style="flex:1;min-width:0"><b>${esc(a)}</b><div class="note">${esc(b)}</div></div><button class="btn ghost" type="button" data-nav="${g}">Buka</button></div>`).join("")); }
  }
  function renderV15(){
    try { bcKatSync(); subscribeBank(); renderBank(); renderBayar(); renderBoss(); renderCust(); renderDashV15(); }
    catch (err) { if (S.booted) console.error("render v15", err); }
  }


  /* ===================== v1.1 · komponen inti ===================== */
  function isTrainer(){ return myRole() === "trainer"; }
  function canKpi(){ return !!S.admin || isTrainer(); }
  const srv = (p, body, opts) => SA.api(p, body, opts);
  function me(){ return S.appUser || null; }
  const fullDate = iso => { const [y, m, d] = String(iso || "").split("-"); return d ? `${+d} ${BLN[+m - 1]} ${y}` : ""; };
  let sheetZ = 30;
  const sheetOpen = id => { const el = $(id); el.style.zIndex = String(++sheetZ); el.hidden = false; document.body.classList.add("modal-open"); };
  const sheetClose = id => { $(id).hidden = true; if (![...document.querySelectorAll(".sheet")].some(x => !x.hidden)) document.body.classList.remove("modal-open"); };
  document.addEventListener("click", e => { const s = e.target.classList?.contains("sheet") ? e.target : null; if (s && s.dataset.dismiss !== "no") sheetClose(s.id); const c = e.target.closest("[data-close]"); if (c) sheetClose(c.dataset.close); });
  document.addEventListener("keydown", e => { if (e.key !== "Escape") return; const open = [...document.querySelectorAll(".sheet")].filter(x => !x.hidden).sort((a, b) => (+a.style.zIndex || 0) - (+b.style.zIndex || 0)).pop(); if (open && open.dataset.dismiss !== "no") sheetClose(open.id); });

  // ---- tema terang / gelap
  const THEMES = [["auto", "Tema otomatis"], ["light", "Tema terang"], ["dark", "Tema gelap"]];
  function applyTheme(t){ const r = document.documentElement; if (t === "light" || t === "dark") r.dataset.theme = t; else delete r.dataset.theme;
    const b = $("themeBtn"); if (b) { b.dataset.t = t; b.title = THEMES.find(x => x[0] === t)[1] + " (klik untuk ganti)"; b.setAttribute("aria-label", b.title); } }
  applyTheme(ls.get("lb-theme") || "auto");
  $("themeBtn").addEventListener("click", () => { const cur = ls.get("lb-theme") || "auto", nx = THEMES[(THEMES.findIndex(x => x[0] === cur) + 1) % 3][0]; ls.set("lb-theme", nx); applyTheme(nx); toast(THEMES.find(x => x[0] === nx)[1]); });

  // ---- PDF dari elemen (dipakai laporan, berita acara, dll.)
  async function elToPdf(el, footer){
    const [h2c, J] = await Promise.all([loadH2C(), loadJsPdf()]), scale = 2;
    const canvas = await h2c(el, { scale, backgroundColor: "#ffffff", useCORS: true, logging: false });
    const top0 = el.getBoundingClientRect().top, forced = [...el.querySelectorAll(".pb")].map(n => Math.round((n.getBoundingClientRect().top - top0) * scale) - 8), cuts = [...el.querySelectorAll("tr, .rb")].map(n => Math.round((n.getBoundingClientRect().bottom - top0) * scale)).sort((a, b) => a - b);
    const pdf = new J.jsPDF({ unit: "mm", format: "a4" }), pw = 210, ph = 297, m = 10, cw = pw - 2 * m, pxmm = canvas.width / cw, pageH = Math.floor((ph - 2 * m - 6) * pxmm);
    let y = 0, page = 0;
    while (y < canvas.height - 4) {
      let end = Math.min(y + pageH, canvas.height);
      const fb = forced.find(v => v > y + 60 && v < end);
      if (fb) end = fb; else if (end < canvas.height) { const c = cuts.filter(v => v > y + 60 && v <= end); if (c.length) end = c[c.length - 1]; }
      const sl = document.createElement("canvas"); sl.width = canvas.width; sl.height = end - y;
      const cx = sl.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, sl.width, sl.height); cx.drawImage(canvas, 0, y, canvas.width, end - y, 0, 0, canvas.width, end - y);
      if (page) pdf.addPage(); pdf.addImage(sl.toDataURL("image/jpeg", 0.92), "JPEG", m, m, cw, (end - y) / pxmm);
      pdf.setFontSize(8); pdf.setTextColor(130); pdf.text("Lash Bounty ERP · " + footer, m, ph - 6); pdf.text("Halaman " + (page + 1), pw - m, ph - 6, { align: "right" });
      y = end; page++;
    }
    return pdf.output("blob");
  }
  // render HTML laporan di luar layar lalu jadikan PDF
  async function htmlToPdf(html, footer){
    const host = document.createElement("div"); host.className = "paper-wrap pdf-host"; host.innerHTML = `<div class="paper">${html}</div>`;
    document.body.appendChild(host);
    try { await new Promise(r => setTimeout(r, 60)); return await elToPdf(host.firstElementChild, footer); } finally { host.remove(); }
  }

  // ---- template email (sopan, bisa diedit, bisa disimpan sebagai template)
  const MAIL_TPL = {
    laporan: { subject: "Laporan {jenis} Lash Bounty — {periode}", body: "Yth. Bapak/Ibu {kepada},\n\nDengan hormat,\n\nBersama email ini kami sampaikan {jenis} Lash Bounty untuk periode {periode} ({rentang}). Laporan terlampir dalam format PDF dan telah melalui proses pemeriksaan serta penandatanganan.\n\nApabila terdapat hal yang perlu dikonfirmasi atau dikoreksi, mohon berkenan menghubungi kami. Kami dengan senang hati akan membantu.\n\nAtas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.\n\nHormat kami,\n{pengirim}\nLash Bounty" },
    slip: { subject: "Slip Gaji {nama} — {periode}", body: "Yth. {nama},\n\nDengan hormat,\n\nBersama email ini kami sampaikan slip gaji Anda untuk periode {periode}. Rincian lengkap tercantum di bawah ini.\n\n{isi}\n\nApabila terdapat pertanyaan mengenai rincian di atas, silakan menghubungi bagian HRD.\n\nTerima kasih atas dedikasi dan kerja keras Anda.\n\nHormat kami,\n{pengirim}\nLash Bounty" },
    ba: { subject: "Berita Acara Pemusnahan Aset — {tanggal}", body: "Yth. Bapak/Ibu {kepada},\n\nDengan hormat,\n\nBersama email ini kami sampaikan Berita Acara Pemusnahan Aset Lash Bounty tertanggal {tanggal} untuk {aset}. Dokumen terlampir dalam format PDF sebagai arsip resmi.\n\nAtas perhatian Bapak/Ibu, kami ucapkan terima kasih.\n\nHormat kami,\n{pengirim}\nLash Bounty" },
    umum: { subject: "{judul}", body: "Yth. Bapak/Ibu {kepada},\n\nDengan hormat,\n\n{isi}\n\nAtas perhatian dan kerja samanya, kami ucapkan terima kasih.\n\nHormat kami,\n{pengirim}\nLash Bounty" },
  };
  S.mailTpl = null;
  const fillVars = (s, v) => String(s || "").replace(/\{(\w+)\}/g, (m, k) => v[k] != null && v[k] !== "" ? String(v[k]) : k === "kepada" ? "Bapak/Ibu" : m);
  function tplOf(kind){ return { ...(MAIL_TPL[kind] || MAIL_TPL.umum), ...(S.mailTpl?.[kind] || {}) }; }

  // ---- dialog kirim: WhatsApp / Email / Salin pesan
  S.sd = null;
  function openSend(o){
    S.sd = o; const v = { pengirim: me()?.nama || "Admin Lash Bounty", ...(o.vars || {}) }, T = tplOf(o.kind || "umum");
    $("sdTitle").textContent = o.title || "Kirim"; $("sdSub").textContent = o.sub || "";
    $("sdWaTo").value = o.waTo || ""; $("sdWaText").value = o.text || "";
    $("sdTo").value = (o.emailTo || []).join(", "); $("sdCc").value = (o.emailCc || []).join(", ");
    $("sdSubject").value = fillVars(o.subject || T.subject, v); $("sdBody").value = fillVars(o.body || T.body, { isi: o.text || "", ...v });
    $("sdSaveTpl").checked = false; $("sdTplRow").hidden = !o.kind || !S.admin; $("sdMsg").textContent = "";
    $("sdCopyText").value = o.text || "";
    $("sdAtt").innerHTML = o.attach ? `<span class="pill">📎 ${esc(o.attachName || "lampiran PDF")}</span>` : `<span class="note">Tanpa lampiran</span>`;
    sdTab(o.tab || (o.waTo || !o.attach ? "wa" : "email")); sdWaLink(); sheetOpen("sdSheet");
  }
  function sdTab(t){ document.querySelectorAll("#sdTabs [data-sd]").forEach(b => b.setAttribute("aria-pressed", b.dataset.sd === t)); ["wa", "email", "copy"].forEach(x => $("sd_" + x).hidden = x !== t); }
  function sdWaLink(){ const n = waNum($("sdWaTo").value), t = $("sdWaText").value; $("sdWaGo").href = n ? waLink(n, t) : "https://wa.me/?text=" + encodeURIComponent(t); $("sdWaHint").textContent = $("sdWaTo").value.trim() && !n ? "Nomor belum benar (contoh 0812xxxxxxx). Tanpa nomor, WhatsApp akan minta pilih kontak." : ""; }
  document.querySelectorAll("#sdTabs [data-sd]").forEach(b => b.addEventListener("click", () => sdTab(b.dataset.sd)));
  ["sdWaTo", "sdWaText"].forEach(id => $(id).addEventListener("input", sdWaLink));
  $("sdWaGo").addEventListener("click", () => { S.sd?.onSent?.("wa"); setTimeout(() => sheetClose("sdSheet"), 300); });
  $("sdCopyBtn").addEventListener("click", async () => { const t = $("sdCopyText").value; try { await navigator.clipboard.writeText(t); toast("Pesan disalin"); } catch { $("sdCopyText").select(); toast("Teks sudah dipilih, tinggal copy"); } S.sd?.onSent?.("copy"); });
  $("sdSend").addEventListener("click", async () => {
    const to = $("sdTo").value.split(/[,;\s]+/).filter(Boolean), cc = $("sdCc").value.split(/[,;\s]+/).filter(Boolean), b = $("sdSend");
    if (!to.length) { $("sdMsg").textContent = "Isi alamat email penerima."; $("sdTo").focus(); return; }
    b.disabled = true; $("sdMsg").textContent = S.sd?.attach ? "Menyiapkan lampiran…" : "Mengirim…";
    try {
      const atts = []; if (S.sd?.attach) { for (const a of await S.sd.attach()) atts.push({ filename: a.filename, contentType: a.blob.type || "application/pdf", data: await SA.blobB64(a.blob) }); }
      $("sdMsg").textContent = "Mengirim email…";
      const r = await srv("email", { to, cc, subject: $("sdSubject").value, text: $("sdBody").value, attachments: atts });
      if ($("sdSaveTpl").checked && S.sd?.kind) { const cur = S.mailTpl || {}; const raw = S.sd.rawTpl || tplOf(S.sd.kind);
        try { await S.db.doc("settings/emailtpl").set({ ...cur, [S.sd.kind]: { subject: S.sd.vars ? untpl($("sdSubject").value, S.sd.vars) : $("sdSubject").value, body: S.sd.vars ? untpl($("sdBody").value, { isi: S.sd.text, ...S.sd.vars }) : $("sdBody").value } }); } catch {} void raw; }
      toast("Email terkirim ke " + r.to + " penerima"); S.sd?.onSent?.("email"); sheetClose("sdSheet");
    } catch (err) { $("sdMsg").textContent = err?.code === "not_configured" ? "Email belum diatur di server. Isi SMTP di file .env (lihat Pengaturan → Integrasi)." : err?.message || "Gagal mengirim email."; }
    finally { b.disabled = false; }
  });
  // simpan template: kembalikan nilai variabel ke {placeholder}
  const untpl = (s, v) => Object.entries(v || {}).filter(([, x]) => x != null && String(x).length > 2).sort((a, b) => String(b[1]).length - String(a[1]).length).reduce((t, [k, x]) => t.split(String(x)).join("{" + k + "}"), String(s));

  // ---- QR untuk setiap link khusus
  let qrP = null;
  const loadQr = () => qrP ||= new Promise((res, rej) => { if (window.qrcode) return res(window.qrcode); const sc = document.createElement("script"); sc.charset = "utf-8"; sc.src = "vendor/qrcode-generator-1.4.4.js"; sc.onload = () => res(window.qrcode); sc.onerror = () => { qrP = null; rej(new Error("load")); }; document.head.appendChild(sc); });
  document.addEventListener("click", async e => { const b = e.target.closest("[data-qr]"); if (!b) return;
    const url = b.dataset.qr, title = b.dataset.qrt || "Link";
    try { const qrcode = await loadQr(), q = qrcode(0, "M"); q.addData(url); q.make();
      $("qrTitle").textContent = title; $("qrLink").textContent = url; $("qrBox").innerHTML = q.createSvgTag({ cellSize: 7, margin: 3, scalable: true });
      $("qrBox").dataset.url = url; $("qrBox").dataset.title = title; sheetOpen("qrSheet"); }
    catch { toast("QR tidak bisa dibuat"); } });
  $("qrCopy").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("qrBox").dataset.url); toast("Link disalin"); } catch { toast("Gagal menyalin"); } });
  $("qrPng").addEventListener("click", async () => { const svg = $("qrBox").querySelector("svg"); if (!svg) return;
    const img = new Image(), src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    img.onload = async () => { const c = document.createElement("canvas"); c.width = c.height = 720; const cx = c.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, 720, 720); cx.drawImage(img, 0, 0, 720, 720);
      c.toBlob(async bl => { try { await S.dl.save({ filename: "QR " + $("qrBox").dataset.title + ".png", data: bl }); } catch {} }, "image/png"); };
    img.src = src; });
  function qrBtn(url, title){ return `<button class="btn" type="button" data-qr="${esc(url)}" data-qrt="${esc(title)}" title="Tampilkan QR">QR</button>`; }

  // ---- notifikasi ke owner/head lewat server (Telegram + Email); diam kalau belum diatur
  const notifySrv = (to, subject, text, event) => srv("notify", { to, subject, text, event }).catch(() => null);

  /* ---------- v1.1 · akun saya: ganti password & tanda tangan ---------- */
  S.tgchats = []; S.ttdDirty = false;
  function renderAkun(){
    if (S.leaf !== "set/akun") return; const u = me();
    $("akInfo").innerHTML = u ? `<b>${esc(u.nama)}</b><span class="note"> · ${esc(u.id)} · ${esc(roleLabel(u.role))}${u.cabang ? " · " + esc(shortCab(u.cabang)) : ""}</span>` : "";
    const cur = (S.users.find(x => x.id === u?.id) || u || {}).ttd;
    $("akTtdNow").innerHTML = cur ? `<img src="${esc(cur)}" alt="Tanda tangan tersimpan">` : `<span class="note">Belum ada tanda tangan tersimpan.</span>`;
  }
  $("akPwForm").addEventListener("submit", async e => { e.preventDefault(); const u = me(), msg = $("akPwMsg"); if (!u) return;
    const o = $("akPwOld").value, p1 = $("akPw1").value, p2 = $("akPw2").value, er = pwErr(p1);
    if (!o) { msg.textContent = "Isi password lama."; return; } if (er) { msg.textContent = er; return; } if (p1 !== p2) { msg.textContent = "Ulangi password belum sama."; return; }
    msg.textContent = "Memeriksa…";
    try { await srv("login", { username: u.id, password: o }); } catch { msg.textContent = "Password lama salah."; return; }
    try { const salt = newSalt(); await S.db.doc("users/" + u.id).update({ salt, hash: await pwHash(p1, salt), iter: 150000, pwAt: new Date().toISOString(), mustChange: false });
      await SA.login(u.id, p1, !!ls.get("lb-token")); toast("Password diganti"); setTimeout(() => location.reload(), 600); }
    catch { msg.textContent = "Gagal mengganti password, coba lagi."; } });
  // pad tanda tangan
  (() => { const cv = $("akPad"), cx = cv.getContext("2d"); let down = false, last = null;
    const fit = () => { const r = cv.getBoundingClientRect(); if (!r.width) return; const d = window.devicePixelRatio || 1; if (cv.width === Math.round(r.width * d)) return; cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); cx.scale(d, d); cx.lineWidth = 2.4; cx.lineCap = "round"; cx.lineJoin = "round"; cx.strokeStyle = "#10233a"; };
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener("pointerdown", e => { fit(); down = true; last = pos(e); cv.setPointerCapture(e.pointerId); S.ttdDirty = true; });
    cv.addEventListener("pointermove", e => { if (!down) return; const p = pos(e); cx.beginPath(); cx.moveTo(...last); cx.lineTo(...p); cx.stroke(); last = p; });
    ["pointerup", "pointercancel"].forEach(ev => cv.addEventListener(ev, () => { down = false; }));
    $("akPadClear").addEventListener("click", () => { cx.clearRect(0, 0, cv.width, cv.height); S.ttdDirty = false; });
    $("akTtdFile").addEventListener("change", async e => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const bmp = await createImageBitmap(f).catch(() => null); if (!bmp) { toast("Gambar tidak terbaca"); return; }
      fit(); const r = cv.getBoundingClientRect(), sc = Math.min(r.width / bmp.width, r.height / bmp.height); cx.clearRect(0, 0, cv.width, cv.height); cx.drawImage(bmp, (r.width - bmp.width * sc) / 2, (r.height - bmp.height * sc) / 2, bmp.width * sc, bmp.height * sc); S.ttdDirty = true; });
    $("akTtdSave").addEventListener("click", async () => { const u = me(); if (!u) return; if (!S.ttdDirty) { $("akTtdMsg").textContent = "Gambar tanda tangan dulu di kotak."; return; }
      // potong area kosong lalu perkecil supaya ringan
      const W = cv.width, H = cv.height, d = cx.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 <= x0) { $("akTtdMsg").textContent = "Kotak masih kosong."; return; }
      const pad = 8, w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2, sc = Math.min(1, 520 / w, 200 / h), out = document.createElement("canvas"); out.width = Math.round(w * sc); out.height = Math.round(h * sc);
      out.getContext("2d").drawImage(cv, x0 - pad, y0 - pad, w, h, 0, 0, out.width, out.height);
      try { await S.db.doc("users/" + u.id).update({ ttd: out.toDataURL("image/png"), ttdAt: new Date().toISOString() }); S.ttdDirty = false; cx.clearRect(0, 0, cv.width, cv.height); $("akTtdMsg").textContent = ""; toast("Tanda tangan tersimpan"); }
      catch { $("akTtdMsg").textContent = "Gagal menyimpan tanda tangan."; } });
  })();
  const ttdOf = uid => S.users.find(x => x.id === uid)?.ttd || (me()?.id === uid ? me()?.ttd : "") || "";

  /* ---------- v1.1 · data karyawan lengkap ---------- */
  const KY_FIELDS = [["hp", "No. HP / WhatsApp", "tel"], ["email", "Email", "email"], ["alamat", "Alamat", "text"], ["ktp", "No. KTP", "numeric"], ["tglMasuk", "Tanggal masuk kerja", "date"],
    ["daruratNama", "Kontak darurat (nama & hubungan)", "text"], ["daruratHp", "No. kontak darurat", "tel"], ["bank", "Bank", "text"], ["norek", "No. rekening", "numeric"], ["an", "Atas nama rekening", "text"], ["tgChat", "Telegram chat ID", "text"]];
  S.kyDet = null;
  document.addEventListener("click", e => { const b = e.target.closest("[data-kydet]"); if (!b) return; const i = +b.dataset.kydet, x = kyEdit?.[i]; if (!x) return;
    S.kyDet = i; $("kdTitle").textContent = x.nama || "Karyawan baru"; $("kdSub").textContent = [x.jabatan, shortCab(x.cabang || "Pusat")].filter(Boolean).join(" · ");
    $("kdFields").innerHTML = KY_FIELDS.map(([f, l, t]) => `<div class="field ${f === "alamat" ? "full" : ""}"><label for="kd_${f}">${l}</label>${f === "tgChat" ? `<input type="text" id="kd_${f}" list="tgList" value="${esc(x[f] || "")}" placeholder="pilih dari chat yang menyapa bot">`
      : `<input type="${t === "numeric" || t === "tel" ? "text" : t}" id="kd_${f}" ${t === "numeric" ? 'inputmode="numeric"' : t === "tel" ? 'inputmode="tel"' : ""} value="${esc(x[f] || "")}" maxlength="${f === "alamat" ? 200 : 60}">`}</div>`).join("");
    $("kdMsg").textContent = ""; sheetOpen("kdSheet"); });
  $("kdOk").addEventListener("click", () => { const x = kyEdit?.[S.kyDet]; if (!x) return;
    const v = Object.fromEntries(KY_FIELDS.map(([f]) => [f, $("kd_" + f).value.trim()]));
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) { $("kdMsg").textContent = "Format email belum benar."; return; }
    if (v.hp && !waNum(v.hp)) { $("kdMsg").textContent = "No. HP belum benar (contoh 0812xxxxxxx)."; return; }
    if (v.ktp && !/^\d{16}$/.test(v.ktp.replace(/\D/g, ""))) { $("kdMsg").textContent = "No. KTP harus 16 digit."; return; }
    Object.assign(x, v, { ktp: v.ktp.replace(/\D/g, ""), norek: v.norek.replace(/[^\d-]/g, "") }); S.kyDirty = true; sheetClose("kdSheet"); renderKaryawan(); $("kyMsg").textContent = "Detail diubah. Klik Simpan data karyawan."; });
  const kyRec = id => kyList().find(x => x.id === id) || null;

  /* ---------- v1.1 · kasbon karyawan ---------- */
  S.kasbon = []; S.kasbonLoaded = false;
  function kbSaldo(empId){
    const give = S.kasbon.filter(k => k.empId === empId && k.tipe === "pinjam"), pay = S.kasbon.filter(k => k.empId === empId && k.tipe === "bayar");
    const viaPr = Object.entries(S.prAll || {}).filter(([, P]) => P.status === "final").flatMap(([mk, P]) => (P.rows || []).filter(r => r.id === empId && (r.potKasbon || 0) > 0).map(r => ({ mk, v: r.potKasbon, tgl: P.tglBayar || perEnd(mk) })));
    const pinjam = sumOf(give, k => k.jumlah), bayar = sumOf(pay, k => k.jumlah) + sumOf(viaPr, x => x.v);
    return { pinjam, bayar, saldo: pinjam - bayar, give, pay, viaPr };
  }
  const kbAll = () => { const ids = [...new Set(S.kasbon.map(k => k.empId))]; return ids.map(id => ({ id, nama: kyRec(id)?.nama || S.kasbon.find(k => k.empId === id)?.nama || id, cabang: kyRec(id)?.cabang || "", ...kbSaldo(id) })); };
  const piutangKasbon = () => sumOf(kbAll(), x => Math.max(0, x.saldo));
  function renderKasbon(){
    if (S.leaf !== "hrd/kasbon") return; if (!adminGate("kbBody", "kbRO")) return;
    fillSelect($("kbEmp"), kyActive().map(x => x.id), $("kbEmp").value); [...$("kbEmp").options].forEach(o => o.textContent = kyRec(o.value)?.nama + " · " + shortCab(kyRec(o.value)?.cabang || "Pusat"));
    { const R = rekList(); const kp = $("kbRek").value; $("kbRek").innerHTML = `<option value="Rekening pusat">Rekening pusat</option>` + R.map(r => `<option value="${esc(rekName(r))}">${esc(rekName(r))}</option>`).join(""); if (kp) $("kbRek").value = kp; }
    const L = kbAll().sort((a, b) => b.saldo - a.saldo);
    $("kbKpis").innerHTML = [["Kasbon berjalan", rpShort(sumOf(L, x => Math.max(0, x.saldo))), L.filter(x => x.saldo > 0).length + " karyawan · dicatat sebagai aset (piutang)"], ["Total dipinjamkan", rpShort(sumOf(L, x => x.pinjam)), "dari rekening pusat"], ["Sudah kembali", rpShort(sumOf(L, x => x.bayar)), "potongan gaji + bayar langsung"]]
      .map(([l, v, s2]) => `<div class="kpi"><span class="l">${l}</span><span class="v num">${v}</span><span class="s">${s2}</span></div>`).join("");
    $("kbTable").innerHTML = !S.kasbonLoaded ? `<tr><td class="empty">Memuat…</td></tr>` : L.length ? `<thead><tr><th>Karyawan</th><th class="r">Dipinjam</th><th class="r">Sudah dibayar</th><th class="r">Sisa kasbon</th><th>Riwayat</th><th></th></tr></thead><tbody>` +
      L.map(x => `<tr><td><b>${esc(x.nama)}</b><small>${esc(shortCab(x.cabang || "Pusat"))}</small></td><td class="r num">${fmt(x.pinjam)}</td><td class="r num">${fmtOrDash(x.bayar)}</td><td class="r num ${x.saldo > 0 ? "warn-t" : ""}"><b>${fmt(x.saldo)}</b></td>
        <td class="k">${[...x.give.map(k => `+${fmt(k.jumlah)} ${fmtD(k.tanggal)}`), ...x.pay.map(k => `−${fmt(k.jumlah)} ${fmtD(k.tanggal)}`), ...x.viaPr.map(p => `−${fmt(p.v)} gaji ${mName(p.mk)}`)].slice(-6).join(" · ")}</td>
        <td class="r" style="white-space:nowrap">${x.saldo > 0 ? `<button class="btn ghost" type="button" data-kbsend="${esc(x.id)}">Kirim</button>` : ""}</td></tr>`).join("") + `</tbody>`
      : `<tr><td class="empty">Belum ada kasbon.</td></tr>`;
    const H = [...S.kasbon].sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || "")).slice(0, 60);
    $("kbHist").innerHTML = H.length ? `<thead><tr><th>Tanggal</th><th>Karyawan</th><th>Jenis</th><th>Dari / cara</th><th>Keterangan</th><th class="r">Jumlah</th><th></th></tr></thead><tbody>` +
      H.map(k => `<tr><td class="num">${esc(fmtDate(k.tanggal))}</td><td>${esc(k.nama || "")}</td><td><span class="pill ${k.tipe === "pinjam" ? "warn" : "ok"}">${k.tipe === "pinjam" ? "Kasbon" : "Pengembalian"}</span></td><td>${esc(k.dari || "–")}</td><td class="k">${esc(k.ket || "")}${k.cicil ? `<small>cicilan ${esc(fmt(k.cicil))}/bulan dari gaji</small>` : ""}</td><td class="r num">${fmt(k.jumlah)}</td><td class="r"><button class="btn ghost danger" type="button" data-kbdel="${esc(k.id)}">Hapus</button></td></tr>`).join("") + `</tbody>`
      : `<tr><td class="empty">Belum ada catatan.</td></tr>`;
  }
  ["kbJml", "kbCicil"].forEach(id => $(id).addEventListener("input", e => { const n = parseRp(e.target.value); e.target.value = n ? fmt(n) : ""; }));
  $("kbTgl").value = todayISO();
  $("kbTipe").addEventListener("change", () => { const p = $("kbTipe").value === "pinjam"; $("kbRekF").hidden = !p; $("kbCicilF").hidden = !p; $("kbCaraF").hidden = p; });
  $("kbForm").addEventListener("submit", async e => { e.preventDefault(); const x = kyRec($("kbEmp").value), tipe = $("kbTipe").value, j = parseRp($("kbJml").value);
    if (!x) { $("kbMsg").textContent = "Pilih karyawan."; return; } if (!(j > 0) || !validISO($("kbTgl").value)) { $("kbMsg").textContent = "Isi tanggal & jumlah."; return; }
    if (tipe === "bayar" && j > kbSaldo(x.id).saldo) { $("kbMsg").textContent = "Pengembalian melebihi sisa kasbon (" + rp(kbSaldo(x.id).saldo) + ")."; return; }
    const doc = { empId: x.id, nama: x.nama, cabang: x.cabang || "Pusat", tipe, tanggal: $("kbTgl").value, jumlah: j, dari: tipe === "pinjam" ? $("kbRek").value : $("kbCara").value, cicil: tipe === "pinjam" ? parseRp($("kbCicil").value) : 0, ket: $("kbKet").value.trim(), pengisi: actorName(), at: new Date().toISOString() };
    try { await S.db.collection("kasbon").add(doc); ["kbJml", "kbKet", "kbCicil"].forEach(id => $(id).value = ""); $("kbMsg").textContent = ""; toast((tipe === "pinjam" ? "Kasbon " : "Pengembalian ") + rp(j) + " tercatat"); }
    catch { $("kbMsg").textContent = "Gagal menyimpan. Hanya role admin."; } });
  document.addEventListener("click", async e => {
    const d = e.target.closest("[data-kbdel]"); if (d) { if (d.dataset.armed !== "1") { d.dataset.armed = "1"; d.textContent = "Yakin?"; setTimeout(() => { d.dataset.armed = ""; d.textContent = "Hapus"; }, 3000); return; }
      try { await S.db.doc("kasbon/" + d.dataset.kbdel).delete(); toast("Catatan kasbon dihapus"); } catch { toast("Gagal menghapus"); } return; }
    const s2 = e.target.closest("[data-kbsend]"); if (s2) { const x = kbAll().find(y => y.id === s2.dataset.kbsend), k = kyRec(x.id) || {};
      const text = `Halo ${x.nama},\n\nBerikut rincian kasbon kamu di Lash Bounty:\n• Total kasbon: ${rp(x.pinjam)}\n• Sudah dibayar: ${rp(x.bayar)}\n• Sisa: ${rp(x.saldo)}\n\nPengembalian dipotong dari gaji sesuai kesepakatan. Terima kasih.`;
      openSend({ title: "Kirim info kasbon", sub: x.nama, kind: "umum", text, waTo: k.hp || "", emailTo: k.email ? [k.email] : [], vars: { judul: "Informasi Kasbon " + x.nama, kepada: x.nama } }); } });
  // potongan kasbon otomatis di payroll: cicilan yang disepakati, maksimal sisa
  function kasbonCicilan(empId){ const s = kbSaldo(empId); if (s.saldo <= 0) return 0; const cic = sumOf(s.give, k => k.cicil || 0); return Math.min(s.saldo, cic || s.saldo); }

  /* ---------- v1.1 · pengumuman (blast email, Telegram, WhatsApp) ---------- */
  S.umum = []; S.umumLoaded = false;
  function umTargets(){ const mode = $("umMode").value, ky = kyActive();
    return mode === "cabang" ? ky.filter(x => [...$("umCab").selectedOptions].map(o => o.value).includes(x.cabang || "Pusat")) : mode === "pilih" ? ky.filter(x => [...document.querySelectorAll("#umPick input:checked")].map(i => i.value).includes(x.id)) : ky; }
  function renderUmum(){
    if (S.leaf !== "hrd/umum") return; if (!adminGate("umBody", "umRO")) return;
    const cabs = [...cabList(), "Pusat"]; if ($("umCab").options.length !== cabs.length) $("umCab").innerHTML = optList(cabs);
    const mode = $("umMode").value; $("umCabF").hidden = mode !== "cabang"; $("umPick").hidden = mode !== "pilih";
    if (mode === "pilih" && !$("umPick").dataset.n) { $("umPick").innerHTML = kyActive().map(x => `<label class="chk sm"><input type="checkbox" value="${esc(x.id)}"> ${esc(x.nama)}</label>`).join(""); $("umPick").dataset.n = "1"; }
    const T = umTargets(); $("umCount").textContent = `${T.length} penerima · ${T.filter(x => x.email).length} punya email · ${T.filter(x => x.tgChat).length} terhubung Telegram · ${T.filter(x => waNum(x.hp)).length} punya no. WA`;
    const L = [...S.umum].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
    $("umList").innerHTML = !S.umumLoaded ? `<div class="empty">Memuat…</div>` : L.length ? L.map(u => `<div class="um-item"><div class="ab-h"><div><b>${esc(u.judul)}</b><small>${esc(fmtDate(String(u.at).slice(0, 10)))} · ${esc(u.dari || "")} · ${u.ringkas ? `email ${u.ringkas.email}, Telegram ${u.ringkas.telegram} dari ${u.ringkas.total}` : "belum dikirim lewat server"}</small></div><button class="btn ghost" type="button" data-umwa="${esc(u.id)}">Kirim WA</button></div><p class="ab-prev">${esc(String(u.isi).slice(0, 220))}</p></div>`).join("")
      : `<div class="empty">Belum ada pengumuman.</div>`;
  }
  ["umMode", "umCab"].forEach(id => $(id).addEventListener("change", () => { $("umPick").dataset.n = ""; renderUmum(); }));
  $("umPick").addEventListener("change", renderUmum);
  $("umForm").addEventListener("submit", async e => { e.preventDefault(); const judul = $("umJudul").value.trim(), isi = $("umIsi").value.trim(), T = umTargets();
    if (!judul || !isi) { $("umMsg").textContent = "Isi judul dan pesan."; return; } if (!T.length) { $("umMsg").textContent = "Belum ada penerima."; return; }
    const ch = { email: $("umEmail").checked, telegram: $("umTg").checked };
    const doc = { judul, isi, dari: me()?.nama || "Manajemen Lash Bounty", at: new Date().toISOString(), target: { mode: $("umMode").value, cabang: [...$("umCab").selectedOptions].map(o => o.value), ids: T.map(x => x.id) }, channels: ch, penerima: T.length };
    $("umMsg").textContent = "Menyimpan…";
    try { const ref = await S.db.collection("pengumuman").add(doc);
      if (ch.email || ch.telegram) { $("umMsg").textContent = "Mengirim ke " + T.length + " karyawan…"; const r = await srv("announce", { id: ref.id }).catch(err => ({ error: err.message }));
        $("umMsg").textContent = r.error ? "Tersimpan, tapi pengiriman gagal: " + r.error : `Terkirim: ${r.email} email, ${r.telegram} Telegram.`; } else $("umMsg").textContent = "Tersimpan.";
      $("umJudul").value = ""; $("umIsi").value = ""; if ($("umWa").checked) umWaList(doc, T); }
    catch { $("umMsg").textContent = "Gagal menyimpan pengumuman."; } });
  function umWaList(doc, T){ const text = `📢 *${doc.judul}*\n\n${doc.isi}\n\n— ${doc.dari}`;
    $("umWaTitle").textContent = doc.judul; $("umWaText").value = text;
    $("umWaList").innerHTML = T.map(x => waNum(x.hp) ? `<a class="btn" target="_blank" rel="noopener" href="${esc(waLink(waNum(x.hp), text))}">${esc(x.nama)}</a>` : `<span class="btn ghost" aria-disabled="true">${esc(x.nama)} · no. WA kosong</span>`).join("");
    sheetOpen("umWaSheet"); }
  $("umWaList").addEventListener("click", e => { const a = e.target.closest("a"); if (a) a.classList.add("done"); });
  $("umWaCopy").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("umWaText").value); toast("Pesan disalin"); } catch { toast("Gagal menyalin"); } });
  document.addEventListener("click", e => { const b = e.target.closest("[data-umwa]"); if (!b) return; const u = S.umum.find(x => x.id === b.dataset.umwa); if (!u) return; const ids = u.target?.ids || []; umWaList(u, kyActive().filter(x => !ids.length || ids.includes(x.id))); });

  /* ---------- v1.1 · baca file Excel / PDF / gambar ---------- */
  const fileKind = f => /\.(xlsx|xlsm|xls)$/i.test(f.name) ? "xlsx" : /\.pdf$/i.test(f.name) || f.type === "application/pdf" ? "pdf" : /^image\//.test(f.type) ? "image" : "text";
  async function xlsxToText(f){ const X = await loadXlsx(), wb = X.read(await f.arrayBuffer(), { type: "array", cellDates: true });
    return wb.SheetNames.map(n => ({ sheet: n, csv: X.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false, dateNF: "yyyy-mm-dd" }) })).filter(x => x.csv.trim()); }
  // dipakai Import CSV: Excel → CSV langsung; PDF/foto → dibaca AI sesuai kolom template
  async function fileToCsv(file, T){
    const k = fileKind(file);
    if (k === "text") return typeof file.text === "function" ? file.text() : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(file); });
    if (k === "xlsx") { const sh = await xlsxToText(file); if (!sh.length) throw new Error("Sheet kosong."); return sh[0].csv; }
    if (!S.sample) throw new Error("Baca PDF/foto butuh AI aktif di server (ANTHROPIC_API_KEY).");
    $("imMsg").textContent = "AI sedang membaca " + (k === "pdf" ? "PDF" : "gambar") + "…";
    const out = await S.sample(`Dokumen ini berisi data "${T.label}" untuk aplikasi Lash Bounty ERP (salon lash & nail). Ubah SEMUA baris data menjadi CSV dengan pemisah koma dan header PERSIS: ${T.cols.map(c => c[0]).join(",")}.
Keterangan kolom: ${T.cols.map(c => c[0] + (c[3] ? " (" + c[3] + ")" : "") + (c[1] ? " wajib" : "")).join("; ")}. Contoh baris: ${T.cols.map(c => c[2]).join(",")}.
Tanggal format YYYY-MM-DD. Angka tanpa titik ribuan, tanpa "Rp", tanpa tanda minus untuk biaya. Isi teks yang mengandung koma dengan tanda kutip. Balas HANYA CSV tanpa penjelasan dan tanpa \`\`\`.`,
      { [k === "pdf" ? "documents" : "images"]: [file], maxTokens: 8000 });
    return String(out.text || "").replace(/```(?:csv)?/gi, "").trim();
  }

  /* ---------- v1.1 · Import dengan AI (chat + upload file laporan lama) ---------- */
  S.aiImp = { msgs: [], files: [], prop: null, busy: false };
  const AI_TYPES = { omzet: "Omzet (Zenwel)", omzet_manual: "Omzet manual", biaya: "Biaya", gaji: "Gaji karyawan", gaji_owner: "Gaji owner", tutup: "Tutup buku final" };
  function aiImpSystem(){
    return `Kamu asisten "Import AI" di Lash Bounty ERP (salon lash & nail multi-cabang). Tugasmu membaca file laporan bulan-bulan sebelumnya (income statement / tutup buku per cabang, laporan global, laporan omzet, payroll) lalu mengubahnya menjadi data untuk dimasukkan ke sistem.
Bahasa: Indonesia santai, singkat. Tanyakan hal yang belum jelas SATU PER SATU (cabang mana, periode mana, kategori biaya, apakah angka sudah termasuk sesuatu). Jangan menebak angka.
Aturan sistem: periode tutup buku tanggal 27 bulan sebelumnya s/d 26, nama periode = bulan akhirnya (contoh "November 2025" = "2025-11").
Cabang valid (pakai nama PERSIS): ${JSON.stringify([...cabList(), "Pusat"])}. Grup: ${cabList().map(c => c + "=" + grupOf(c)).join(", ")}.
Kategori biaya cabang valid: ${JSON.stringify(CAB_KAT)}. Pemetaan dari file: Cost of Good Sold / bahan / stock bulu mata → "Stok bahan (HPP)"; IPL → "IPL"; Listrik → "Listrik"; PAM → "PAM / air"; Internet → "Internet & telepon"; sewa/mortgage → "Sewa / mortgage"; ads / online advertisement cabang partner → "Ads / iklan"; office + admin fee → "Office + admin fee"; biaya admin EDC & QR → "Biaya admin EDC & QR"; belanja keperluan cabang & lainnya → "Lain-lain" (tulis rinciannya di keterangan).
Kategori biaya Kantor Pusat valid: ${JSON.stringify(PST_KAT)} (Ads IG → "Marketing"; IPL HO → "IPL HO"; Operasional mobil / Flazz → "Kendaraan & leasing"; Penyesuaian kas → "Penyesuaian kas"; Operasional trainer → "Operasional trainer").
Gaji & komisi karyawan dari bagian Salary/Commision Expenses → type "gaji" (satu record per orang, pokok = gaji, komisi = komisi). Gaji owner (${ownersCfg().join(", ")}) → type "gaji_owner". Karyawan pusat (Company Board Salary selain owner) → type "gaji" dengan cabang "Pusat".
Profit per cabang / Total Company Net Income JANGAN dimasukkan sebagai data (itu hasil hitungan); pakai untuk mengecek: setelah data dimasukkan, total harus sama dengan file. Kalau user setuju periode itu ditutup, tambahkan record "tutup" dengan labaBersih dari file.
SETIAP balasan WAJIB diakhiri satu blok \`\`\`json berisi: {"status":"tanya" atau "siap","ringkasan":"ringkas apa yang akan masuk & cek totalnya","records":[ ... ]}. records = daftar LENGKAP terbaru (kirim ulang semua, bukan tambahan). Format record:
{"type":"omzet","cabang":"…","periode":"YYYY-MM","total":angka,"keterangan":"…"}
{"type":"omzet_manual","cabang":"…","periode":"YYYY-MM","total":angka,"keterangan":"…"}
{"type":"biaya","cabang":"… atau Pusat","periode":"YYYY-MM","kategori":"kategori valid","keterangan":"…","jumlah":angka positif,"dana":"sumber dana kalau ada (fms/kas/koko/pusat/cash toko)"}
{"type":"gaji","cabang":"… atau Pusat","periode":"YYYY-MM","nama":"…","jabatan":"…","pokok":angka,"komisi":angka}
{"type":"gaji_owner","periode":"YYYY-MM","nama":"nama owner","jumlah":angka}
{"type":"tutup","periode":"YYYY-MM","labaBersih":angka}
Status "siap" hanya kalau tidak ada lagi yang perlu ditanyakan. Data yang sudah ada di sistem untuk periode yang sama: ${aiImpExisting()}.`;
  }
  function aiImpExisting(){ const m = {}; [...S.sales, ...(S.salesPst || [])].filter(s => s.sumber === "Import").forEach(s => m[perOf(s.tanggal)] = (m[perOf(s.tanggal)] || 0) + 1);
    return Object.keys(m).length ? Object.entries(m).map(([k, n]) => `${k}: ${n} omzet import`).join(", ") : "belum ada data import di periode yang sedang dimuat"; }
  function aiParse(text){ const blocks = [...String(text).matchAll(/```json\s*([\s\S]*?)```/gi)]; if (!blocks.length) return null; try { return JSON.parse(blocks[blocks.length - 1][1]); } catch { return null; } }
  const aiVisible = t => String(t).replace(/```json[\s\S]*?```/gi, "").trim();
  function renderAiImp(){
    if (S.leaf !== "acc/impor/ai") return; if (!adminGate("aiBody", "aiRO")) return;
    const A = S.aiImp, on = !!S.sample;
    $("aiOff").hidden = on; $("aiSend").disabled = !on || A.busy; $("aiIn").disabled = !on;
    $("aiFiles").innerHTML = A.files.map((f, i) => `<span class="pill file-pill">${f.kind === "pdf" ? "PDF" : f.kind === "image" ? "Foto" : f.kind === "xlsx" ? "Excel" : "CSV"} · ${esc(f.name)}<button type="button" data-aifx="${i}" aria-label="Hapus file">✕</button></span>`).join("");
    $("aiLog").innerHTML = A.msgs.length ? A.msgs.map((m, i) => `<div class="msg ${m.role}"><div class="bub" id="aiB${i}"></div></div>`).join("") : `<div class="ask-empty"><b>Upload file tutup buku / omzet bulan sebelumnya</b><span>PDF, Excel, CSV, atau foto. AI akan membaca, bertanya kalau ada yang belum jelas, lalu menyiapkan data untuk dimasukkan.</span></div>`;
    A.msgs.forEach((m, i) => { $("aiB" + i).textContent = m.role === "assistant" ? aiVisible(m.content) || "…" : m.show || m.content; });
    $("aiLog").scrollTop = $("aiLog").scrollHeight;
    const P = A.prop, recs = P?.records || [];
    $("aiPropPanel").hidden = !recs.length;
    if (recs.length) {
      $("aiPropHint").textContent = (P.status === "siap" ? "Siap dimasukkan" : "Masih ada pertanyaan") + " · " + recs.length + " data";
      $("aiPropSum").textContent = P.ringkasan || "";
      $("aiProp").innerHTML = `<thead><tr><th></th><th>Jenis</th><th>Periode</th><th>Cabang</th><th>Rincian</th><th class="r">Jumlah</th><th>Cek</th></tr></thead><tbody>` +
        recs.map((r, i) => { const er = aiCheck(r); return `<tr class="${r._off ? "muted" : ""}"><td><input type="checkbox" data-aion="${i}" ${r._off ? "" : "checked"} aria-label="Pakai"></td><td>${esc(AI_TYPES[r.type] || r.type)}</td><td class="num">${esc(r.periode || "")}</td><td>${esc(shortCab(r.cabang || ""))}</td>
          <td class="k">${esc(r.kategori ? r.kategori + " · " : "")}${esc(r.nama || r.keterangan || "")}${r.type === "gaji" && r.komisi ? `<small>komisi ${esc(fmt(r.komisi))}</small>` : ""}</td><td class="r num">${fmt(r.total ?? r.jumlah ?? r.pokok ?? r.labaBersih ?? 0)}</td><td>${er ? `<span class="pill no">${esc(er)}</span>` : `<span class="pill ok">OK</span>`}</td></tr>`; }).join("") +
        `</tbody>`;
      const ok = recs.filter(r => !r._off && !aiCheck(r)); $("aiApply").disabled = !ok.length || A.busy; $("aiApply").textContent = `Masukkan ${ok.length} data ke sistem`;
    }
  }
  const ownerMatch = n => { const a = String(n || "").trim().toLowerCase(); if (!a) return ""; return ownersCfg().find(o => o.toLowerCase() === a) || ownersCfg().find(o => o.toLowerCase().split(/\s+/)[0] === a.split(/\s+/)[0]) || ""; };
  function aiCheck(r){
    if (!/^\d{4}-\d{2}$/.test(r.periode || "")) return "periode?";
    if (["omzet", "omzet_manual", "biaya", "gaji"].includes(r.type) && ![...cabList(), "Pusat"].includes(r.cabang)) return "cabang?";
    if (r.type === "biaya" && !(r.cabang === "Pusat" ? PST_KAT : CAB_KAT_ALL).includes(r.kategori)) return "kategori?";
    if (r.type === "gaji_owner" && !ownerMatch(r.nama)) return "nama owner?";
    const v = +(r.total ?? r.jumlah ?? r.pokok ?? r.labaBersih); if (!Number.isFinite(v) || (r.type !== "tutup" && v < 0)) return "angka?";
    if (!AI_TYPES[r.type]) return "jenis?";
    return "";
  }
  async function aiAddFiles(list){ for (const f of list) { const kind = fileKind(f);
      try { if (kind === "xlsx") S.aiImp.files.push({ name: f.name, kind, text: (await xlsxToText(f)).map(s => `--- Sheet: ${s.sheet} ---\n${s.csv}`).join("\n\n") });
        else if (kind === "text") S.aiImp.files.push({ name: f.name, kind, text: await f.text() });
        else if (f.size > 20 * 1024 * 1024) toast(f.name + " terlalu besar (maks 20 MB)");
        else S.aiImp.files.push({ name: f.name, kind, blob: f }); }
      catch { toast("File " + f.name + " tidak terbaca"); } }
    renderAiImp(); }
  $("aiFile").addEventListener("change", e => { const fs = [...(e.target.files || [])]; e.target.value = ""; aiAddFiles(fs); });
  { const d = $("aiDrop"); ["dragenter", "dragover"].forEach(ev => d.addEventListener(ev, e => { e.preventDefault(); d.classList.add("over"); }));
    ["dragleave", "drop"].forEach(ev => d.addEventListener(ev, e => { e.preventDefault(); d.classList.remove("over"); })); d.addEventListener("drop", e => aiAddFiles([...(e.dataTransfer?.files || [])])); }
  document.addEventListener("click", e => { const b = e.target.closest("[data-aifx]"); if (b) { S.aiImp.files.splice(+b.dataset.aifx, 1); renderAiImp(); } });
  $("aiProp").addEventListener("change", e => { const c = e.target.closest("[data-aion]"); if (c) { S.aiImp.prop.records[+c.dataset.aion]._off = !c.checked; renderAiImp(); } });
  $("aiReset").addEventListener("click", () => { if (S.aiImp.busy) return; S.aiImp = { msgs: [], files: [], prop: null, busy: false }; renderAiImp(); });
  async function aiImpSend(q){
    const A = S.aiImp; q = String(q || "").trim(); if (A.busy || !S.sample) return;
    if (!q && !A.msgs.length) q = "Tolong baca file ini dan siapkan datanya.";
    if (!q) return;
    if (!A.msgs.length && !A.files.length) { toast("Upload file dulu"); return; }
    const first = !A.msgs.length, texts = A.files.filter(f => f.text).map(f => `=== File: ${f.name} ===\n${f.text}`).join("\n\n").slice(0, 250000);
    A.msgs.push({ role: "user", content: first ? (texts ? texts + "\n\n---\n" : "") + q : q, show: q + (first && A.files.length ? "\n📎 " + A.files.map(f => f.name).join(", ") : "") });
    A.msgs.push({ role: "assistant", content: "" }); A.busy = true; $("aiIn").value = ""; renderAiImp();
    const idx = A.msgs.length - 1;
    try {
      const msgs = A.msgs.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
      const out = await S.sample(msgs, { system: aiImpSystem(), documents: A.files.filter(f => f.kind === "pdf").map(f => f.blob), images: A.files.filter(f => f.kind === "image").map(f => f.blob), attachAt: 0, maxTokens: 12000, cache: false });
      A.msgs[idx].content = out.text || "Maaf, belum ada jawaban."; const P = aiParse(out.text); if (P && Array.isArray(P.records)) A.prop = P;
    } catch (err) { A.msgs[idx].content = err?.code === "rate_limited" ? "Batas pemakaian AI tercapai. Coba lagi beberapa menit lagi." : "Gagal menghubungi AI: " + (err?.message || "coba lagi"); }
    finally { A.busy = false; renderAiImp(); }
  }
  $("aiForm").addEventListener("submit", e => { e.preventDefault(); aiImpSend($("aiIn").value); });
  $("aiIn").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); aiImpSend($("aiIn").value); } });
  $("aiApply").addEventListener("click", async e => {
    const b = e.currentTarget, recs = (S.aiImp.prop?.records || []).filter(r => !r._off && !aiCheck(r)); if (!recs.length) return;
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Yakin? Klik sekali lagi"; setTimeout(() => { b.dataset.armed = ""; renderAiImp(); }, 4000); return; }
    b.dataset.armed = ""; b.disabled = true; let n = 0; const at = new Date().toISOString(), by = actorName(), src = S.aiImp.files.map(f => f.name).join(", ").slice(0, 200);
    const tgl = per => per + "-26";
    try {
      for (const r of recs.filter(x => ["omzet", "omzet_manual"].includes(x.type))) { const t = tgl(r.periode);
        await S.db.collection("sales").add({ cabang: r.cabang, tanggal: t, bulan: t.slice(0, 7), sumber: r.type === "omzet" ? "Import" : "Manual", kategori: r.type === "omzet" ? "Import omzet bulanan" : "Pemasukan lain", keterangan: r.keterangan || "Import " + mName(r.periode), total: Math.round(r.total), net: Math.round(r.total), items: [], qty: 0, pengisi: by, by: S.uid || null, at, importFile: src, contoh: false }); n++; }
      for (const r of recs.filter(x => x.type === "biaya")) { const t = tgl(r.periode);
        await S.db.collection("pusat").add({ unit: r.cabang, kategori: r.kategori, tanggal: t, bulan: t.slice(0, 7), jumlah: Math.round(Math.abs(r.jumlah)), keterangan: r.keterangan || r.kategori, nota: "", dana: r.dana || "", pengisi: by, sumber: "Import AI", importFile: src, by: S.uid || null, at, contoh: false }); n++; }
      const byPer = {}; recs.filter(x => x.type === "gaji").forEach(r => (byPer[r.periode] ||= []).push(r));
      for (const [per, rs] of Object.entries(byPer)) { const ref = S.db.doc("payroll/" + per), snap = await ref.get(), cur = snap.exists ? snap.data() : null;
        const rows = [...(cur?.rows || []), ...rs.map(r => { const k = kyList().find(x => x.nama.toLowerCase() === String(r.nama || "").toLowerCase()); return { id: k?.id || newId(), nama: r.nama, jabatan: r.jabatan || k?.jabatan || "", cabang: r.cabang, hk: 26, hadir: 26, izin: 0, sakit: 0, alpha: 0, pokok: Math.round(r.pokok || 0), tunjangan: 0, bonus: 0, komisi: Math.round(r.komisi || 0), potLain: 0, ketPot: "", imp: true }; })];
        await ref.set({ ...(cur || {}), bulan: per, periode: per, rows, status: "final", tglBayar: cur?.tglBayar || tgl(per), total: 0, sumber: cur?.sumber || "Import AI", at }); n += rs.length; }
      const own = {}; recs.filter(x => x.type === "gaji_owner").forEach(r => ((own[r.periode] ||= {})[ownerMatch(r.nama)] = Math.round(r.jumlah)));
      const tut = Object.fromEntries(recs.filter(x => x.type === "tutup").map(r => [r.periode, r]));
      for (const per of new Set([...Object.keys(own), ...Object.keys(tut)])) {
        const ref = S.db.doc("closing/" + per), snap = await ref.get(), cur = snap.exists ? snap.data() : {}, go = { ...(cur.gajiOwners || {}), ...(own[per] || {}) };
        const doc = { ...cur, periode: per, gajiOwners: go, gajiOwner: Object.values(go).reduce((a, x) => a + x, 0), gajiOwnerBy: by, prefinalAt: cur.prefinalAt || at, prefinalBy: cur.prefinalBy || by, status: cur.status || "prefinal" };
        if (tut[per]) Object.assign(doc, { status: "closed", closedAt: at, closedBy: by, ket: "Import dari file: " + src, ringkasan: { ...(cur.ringkasan || {}), labaBersih: Math.round(tut[per].labaBersih), labaFile: Math.round(tut[per].labaBersih), import: true } });
        await ref.set(doc); n++; }
      await S.db.collection("aiimport").add({ at, by, file: src, records: recs.length, ringkasan: S.aiImp.prop?.ringkasan || "" }).catch(() => {});
      toast(n + " data masuk ke sistem"); S.aiImp.msgs.push({ role: "assistant", content: `Sudah dimasukkan ${n} data ke sistem. Cek di Accounting → Tutup Buku (pilih periodenya di kanan atas). Kalau ada yang perlu dikoreksi, pakai Tutup Buku → Edit & Penyesuaian.` }); S.aiImp.prop = null; renderAiImp();
    } catch (err) { toast("Sebagian gagal masuk (" + n + " berhasil). " + (err?.message || "")); b.disabled = false; }
  });

  /* ---------- v1.1 · Refund ---------- */
  S.refund = []; S.refundLoaded = false;
  const RF_ALASAN = ["Garansi", "Salah transfer", "Lebih transfer", "Transaksi dobel", "Lainnya"];
  const RF_ST = { diajukan: ["warn", "Menunggu owner"], disetujui: ["ok", "Disetujui · siap transfer"], ditolak: ["no", "Ditolak owner"], ditransfer: ["ok", "Sudah ditransfer"] };
  function renderRefund(){
    if (S.leaf !== "acc/refund") return; if (!adminGate("rfBody", "rfRO")) return;
    fillSelect($("rfCab"), cabList(), $("rfCab").value); if (!$("rfAlasan").options.length) { $("rfAlasan").innerHTML = optList(RF_ALASAN); $("rfBiaya").checked = true; }
    const f = $("rfFilter").value, L = S.refund.filter(r => !f || r.status === f).sort((a, b) => (a.status === "diajukan") - (b.status === "diajukan") ? (b.status === "diajukan") - (a.status === "diajukan") : (b.tanggal || "").localeCompare(a.tanggal || ""));
    const pend = S.refund.filter(r => r.status === "diajukan"), siap = S.refund.filter(r => r.status === "disetujui");
    $("rfKpis").innerHTML = [["Menunggu owner", String(pend.length), rpShort(sumOf(pend, r => r.jumlah))], ["Siap ditransfer", String(siap.length), rpShort(sumOf(siap, r => r.jumlah))], ["Sudah ditransfer", String(S.refund.filter(r => r.status === "ditransfer").length), rpShort(sumOf(S.refund.filter(r => r.status === "ditransfer"), r => r.jumlah))]]
      .map(([l, v, s2], i) => `<div class="kpi"><span class="l">${l}</span><span class="v num ${i === 0 && pend.length ? "up" : ""}">${v}</span><span class="s">${s2}</span></div>`).join("");
    const own = isAppOwner();
    $("rfList").innerHTML = !S.refundLoaded ? `<tr><td class="empty">Memuat…</td></tr>` : L.length ? `<thead><tr><th>Tanggal</th><th>Cabang</th><th>Customer</th><th>Alasan</th><th>Rekening tujuan</th><th class="r">Jumlah</th><th>Status</th><th></th></tr></thead><tbody>` +
      L.map(r => { const [ty, lb] = RF_ST[r.status] || ["", r.status]; return `<tr><td class="num">${esc(fmtDate(r.tanggal))}</td><td>${esc(shortCab(r.cabang))}</td><td><b>${esc(r.customer || "–")}</b><small>${esc(r.hp || "")}</small></td><td>${esc(r.alasan)}<small>${esc(r.keterangan || "")}</small></td>
        <td class="k">${esc([r.bank, r.norek, r.an].filter(Boolean).join(" · ") || "–")}</td><td class="r num">${fmt(r.jumlah)}</td><td><span class="pill ${ty}">${lb}</span>${r.catatanOwner ? `<small>${esc(r.catatanOwner)}</small>` : ""}${r.status === "ditransfer" ? `<small>${esc(fmtDate(r.tglTransfer))} · ${esc(r.dari || "")}${r.biayaId ? " · dicatat biaya" : ""}</small>` : ""}</td>
        <td class="r" style="white-space:nowrap">${r.status === "diajukan" && own ? `<button class="btn primary" type="button" data-rfok="${esc(r.id)}">Setujui</button><button class="btn ghost danger" type="button" data-rfno="${esc(r.id)}">Tolak</button>` : ""}
          ${r.status === "disetujui" ? `<button class="btn" type="button" data-rftf="${esc(r.id)}">Tandai ditransfer</button>` : ""}<button class="btn ghost" type="button" data-rfsend="${esc(r.id)}">Kirim</button>${r.status === "diajukan" || own ? `<button class="btn ghost danger" type="button" data-rfdel="${esc(r.id)}">Hapus</button>` : ""}</td></tr>`; }).join("") + `</tbody>`
      : `<tr><td class="empty">Belum ada refund${f ? " dengan status ini" : ""}.</td></tr>`;
    $("rfOwnerNote").hidden = own;
  }
  $("rfFilter").addEventListener("change", renderRefund);
  $("rfAlasan").addEventListener("change", () => { $("rfBiaya").checked = ["Garansi", "Lainnya"].includes($("rfAlasan").value); });
  $("rfJml").addEventListener("input", e => { const n = parseRp(e.target.value); e.target.value = n ? fmt(n) : ""; });
  $("rfTgl").value = todayISO();
  $("rfForm").addEventListener("submit", async e => { e.preventDefault();
    const doc = { tanggal: $("rfTgl").value, cabang: $("rfCab").value, customer: $("rfCust").value.trim(), hp: $("rfHp").value.trim(), alasan: $("rfAlasan").value, keterangan: $("rfKet").value.trim(), jumlah: parseRp($("rfJml").value), bank: $("rfBank").value.trim(), norek: $("rfNorek").value.trim(), an: $("rfAn").value.trim(), catatBiaya: $("rfBiaya").checked, status: "diajukan", pengaju: actorName(), at: new Date().toISOString() };
    if (!validISO(doc.tanggal) || !doc.cabang || !doc.customer || !(doc.jumlah > 0)) { $("rfMsg").textContent = "Isi tanggal, cabang, nama customer, dan jumlah."; return; }
    try { await S.db.collection("refund").add(doc); ["rfCust", "rfHp", "rfKet", "rfJml", "rfBank", "rfNorek", "rfAn"].forEach(id => $(id).value = ""); $("rfMsg").textContent = ""; toast("Refund diajukan, menunggu konfirmasi owner"); }
    catch (err) { $("rfMsg").textContent = err?.message || "Gagal menyimpan."; } });
  document.addEventListener("click", async e => {
    const id = (sel) => e.target.closest(sel)?.dataset;
    let d = id("[data-rfok]"), r;
    if (d || (d = id("[data-rfno]"))) { const ok = !!d.rfok; r = S.refund.find(x => x.id === (d.rfok || d.rfno)); if (!r) return; S.rfDec = { id: r.id, ok };
      $("rfdTitle").textContent = (ok ? "Setujui refund · " : "Tolak refund · ") + (r.customer || "") + " · " + rp(r.jumlah); $("rfdLabel").textContent = ok ? "Catatan untuk admin (opsional)" : "Alasan ditolak";
      $("rfdNote").value = ""; $("rfdMsg").textContent = ""; $("rfdOk").textContent = ok ? "Setujui" : "Tolak"; $("rfdOk").className = "btn " + (ok ? "primary" : "danger"); sheetOpen("rfdSheet"); setTimeout(() => $("rfdNote").focus(), 50); return; }
    if ((d = id("[data-rftf]"))) { r = S.refund.find(x => x.id === d.rftf); S.rfTf = r.id; $("rftTitle").textContent = (r.customer || "") + " · " + rp(r.jumlah); $("rftTgl").value = todayISO();
      $("rftDari").innerHTML = optList(["Rekening pusat", ...rekList().map(rekName)]); $("rftBiaya").checked = !!r.catatBiaya; $("rftMsg").textContent = ""; sheetOpen("rftSheet"); return; }
    if ((d = id("[data-rfsend]"))) { r = S.refund.find(x => x.id === d.rfsend);
      const text = `Halo ${r.customer || "Kak"},\n\nKami dari Lash Bounty ${shortCab(r.cabang)} ingin menginformasikan pengembalian dana (refund) sebesar ${rp(r.jumlah)} untuk keperluan: ${r.alasan}${r.keterangan ? " (" + r.keterangan + ")" : ""}.\nStatus: ${RF_ST[r.status]?.[1] || r.status}${r.status === "ditransfer" ? " pada " + fullDate(r.tglTransfer) + " ke rekening " + [r.bank, r.norek, r.an].filter(Boolean).join(" ") : ""}.\n\nMohon maaf atas ketidaknyamanannya. Terima kasih atas kepercayaan Kakak kepada Lash Bounty.`;
      openSend({ title: "Kirim info refund", sub: r.customer, kind: "umum", text, waTo: r.hp || "", vars: { judul: "Informasi Pengembalian Dana Lash Bounty", kepada: r.customer } }); return; }
    if ((d = id("[data-rfdel]"))) { const b = e.target.closest("[data-rfdel]"); if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Yakin?"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Hapus"; }, 3000); return; }
      try { await S.db.doc("refund/" + d.rfdel).delete(); toast("Refund dihapus"); } catch (err) { toast(err?.message || "Gagal menghapus"); } }
  });
  $("rftOk").addEventListener("click", async () => { const r = S.refund.find(x => x.id === S.rfTf); if (!r) return; const tgl = $("rftTgl").value, dari = $("rftDari").value;
    if (!validISO(tgl)) { $("rftMsg").textContent = "Isi tanggal transfer."; return; }
    const lk = lockOf(tgl); if (lk && $("rftBiaya").checked) { $("rftMsg").textContent = lk; return; }
    try { let biayaId = null;
      if ($("rftBiaya").checked) { const ref = await S.db.collection("pusat").add({ unit: r.cabang, kategori: "Refund customer", tanggal: tgl, bulan: tgl.slice(0, 7), jumlah: r.jumlah, keterangan: `Refund ${r.customer || ""} (${r.alasan})`, nota: "", dana: dari, pengisi: actorName(), refundId: r.id, by: S.uid || null, at: new Date().toISOString(), contoh: false }); biayaId = ref.id; }
      await S.db.doc("refund/" + r.id).update({ status: "ditransfer", tglTransfer: tgl, dari, biayaId, transferBy: actorName() }); sheetClose("rftSheet"); toast("Refund ditandai sudah ditransfer"); }
    catch (err) { $("rftMsg").textContent = err?.message || "Gagal menyimpan."; } });
  $("rfdOk").addEventListener("click", async () => { const D = S.rfDec; if (!D) return; const note = $("rfdNote").value.trim();
    if (!D.ok && !note) { $("rfdMsg").textContent = "Tulis alasan ditolak."; return; }
    try { await S.db.doc("refund/" + D.id).update({ status: D.ok ? "disetujui" : "ditolak", catatanOwner: note, putusAt: new Date().toISOString(), putusBy: actorName() }); sheetClose("rfdSheet"); toast(D.ok ? "Refund disetujui" : "Refund ditolak"); }
    catch (err) { $("rfdMsg").textContent = err?.message || "Gagal menyimpan."; } });

  /* ---------- v1.1 · tanda tangan laporan (dibuat oleh Yuli · diketahui oleh Kevin) ---------- */
  const lastMk = k => tokKeys(k).slice(-1)[0];
  const ttdValid = (C, t) => !!(t && t.img && C?.status === "closed" && (!C.closedAt || t.at >= C.closedAt));
  function ttdBlock(k){
    const ks = tokKeys(k), R = rptCfg(), C = ks.length === 1 ? S.closing[ks[0]] : null, T = C?.ttd || {};
    const cell = (lbl, t, def, jab) => { const ok = ttdValid(C, t); return `<div><small>${lbl}</small><span class="ttd-img">${ok ? `<img src="${esc(t.img)}" alt="Tanda tangan ${esc(t.nama)}">` : ""}</span><b>${esc(ok ? t.nama : def)}</b><em>${jab}</em>${ok ? `<i>Ditandatangani ${esc(fmtDate(t.at.slice(0, 10)))}</i>` : `<i>&nbsp;</i>`}</div>`; };
    return `<div class="rp-place rb">${esc(R.kota)}, ${esc(tglPanjang((C?.closedAt || new Date().toISOString()).slice(0, 10)))}</div><div class="rp-sign2 rp-ttd rb">${cell("Dibuat oleh", T.prep, R.prepBy, "Head of Admin")}${cell("Diketahui oleh", T.appr, R.apprBy, "Owner")}</div>`;
  }
  function renderRpTtd(){
    const box = $("rpTtd"); if (!box || !RPT_KINDS.includes(S.leaf)) return; const k = S.rk, ks = tokKeys(k);
    if (ks.length !== 1) { box.innerHTML = `<span class="note">Tanda tangan dibuat per bulan. Pilih periode bulanan untuk menandatangani.</span>`; return; }
    const mk = ks[0], C = S.closing[mk], T = C?.ttd || {}, u = me(), own = isAppOwner(), adm = S.admin && !own;
    if (C?.status !== "closed") { box.innerHTML = `<span class="pill warn">Belum final</span><span class="note">Tanda tangan bisa dibuat setelah tutup buku ${esc(perName(mk))} final.</span>`; return; }
    const st = (t, lbl) => ttdValid(C, t) ? `<span class="pill ok">${lbl}: ${esc(t.nama)} ✓</span>` : t ? `<span class="pill warn">${lbl}: perlu tanda tangan ulang (ada revisi)</span>` : `<span class="pill">${lbl}: belum</span>`;
    const hasTtd = !!(u?.ttd || ttdOf(u?.id));
    box.innerHTML = st(T.prep, "Dibuat") + st(T.appr, "Diketahui") +
      (adm && !ttdValid(C, T.prep) ? `<button class="btn primary" type="button" data-ttdsign="prep">Tandatangani (dibuat oleh)</button>` : "") +
      (own && !ttdValid(C, T.appr) ? `<button class="btn primary" type="button" data-ttdsign="appr">Tandatangani (diketahui oleh)</button>` : "") +
      (own && !ttdValid(C, T.prep) ? `<button class="btn ghost" type="button" data-ttdsign="prep">Tanda tangan pembuat oleh owner</button>` : "") +
      ((adm || own) && !hasTtd ? `<span class="note">Simpan tanda tangan dulu di <a href="#" data-goleaf="set/akun">Pengaturan → Akun saya</a>.</span>` : "");
  }
  document.addEventListener("click", async e => {
    const g = e.target.closest("[data-goleaf]"); if (g) { e.preventDefault(); go(g.dataset.goleaf); window.scrollTo({ top: 0 }); return; }
    const b = e.target.closest("[data-ttdsign]"); if (!b) return; const mk = lastMk(S.rk), C = S.closing[mk], u = me(); if (!C || !u) return;
    const img = u.ttd || ttdOf(u.id); if (!img) { toast("Simpan tanda tangan dulu di Pengaturan → Akun saya"); go("set/akun"); return; }
    const who = b.dataset.ttdsign; b.disabled = true;
    try { await S.db.doc("closing/" + mk).update({ ttd: { ...(C.ttd || {}), [who]: { uid: u.id, nama: u.nama, img, at: new Date().toISOString() } } }); toast("Laporan " + perName(mk) + " ditandatangani"); }
    catch (err) { toast(err?.message || "Gagal menandatangani"); b.disabled = false; }
  });

  /* ---------- v1.1 · kirim laporan (WA / email PDF / salin) ---------- */
  const rpFileName = () => "Tutup Buku " + $("rpEyebrow").textContent.replace("Tutup buku · ", "") + " " + ($("rpCab").hidden ? "" : shortCab($("rpCab").value) + " ") + mName(S.rk) + ".pdf";
  $("rpSend").addEventListener("click", () => {
    const k = S.rk, jenis = $("rpTitle").textContent.replace(/ · .*$/, ""), C = S.closing[lastMk(k)], fin = tokKeys(k).every(m => S.closing[m]?.status === "closed");
    const ownerMail = S.users.filter(x => x.role === "owner" && x.email).map(x => x.email);
    const text = `*${jenis}*\n${perName(k)} (${perRange(k)})\nStatus: ${fin ? "Final · sudah tutup buku" : "Belum final"}\n\nLaporan lengkap (PDF) dikirim lewat email atau bisa diunduh di Lash Bounty ERP → Accounting → Tutup Buku → Riwayat.\n\nTerima kasih.`;
    openSend({ title: "Kirim laporan", sub: $("rpTitle").textContent, kind: "laporan", text, emailTo: ownerMail, tab: "email", attachName: rpFileName(),
      vars: { jenis, periode: mName(k), rentang: perRange(k), kepada: "" },
      attach: async () => [{ filename: rpFileName(), blob: await elToPdf($("paper"), "Lash Bounty ERP · " + $("rpTitle").textContent) }] });
    if (!fin) $("sdMsg").textContent = "Catatan: laporan periode ini belum final" + (C?.ttd ? "" : " dan belum ditandatangani") + ".";
  });

  /* ---------- v1.1 · Riwayat tutup buku ---------- */
  const RPT_LABEL = { simple: "Simple (per cabang)", wendy: "Cabang Wendy", global: "Global", expert: "Expertise" };
  function renderRiwayat(){
    if (S.leaf !== "acc/tutup/riwayat") return; if (!adminGate("tbBody", "tbRO")) return;
    const L = Object.entries(S.closing).filter(([, C]) => C && (C.status === "closed" || C.prefinalAt || (C.revisi || []).length)).sort((a, b) => b[0].localeCompare(a[0]));
    const fin = L.filter(([, C]) => C.status === "closed").length;
    $("rwHint").textContent = L.length ? fin + " final · " + (L.length - fin) + " belum final" : "";
    $("rwTable").innerHTML = L.length ? `<thead><tr><th>Periode</th><th>Status</th><th class="r">Laba bersih</th><th>Ditutup</th><th>Tanda tangan</th><th>Revisi</th><th>Buka & download</th></tr></thead><tbody>` +
      L.map(([mk, C]) => { const T = C.ttd || {}, R = C.ringkasan || {}, cl = C.status === "closed";
        return `<tr><td><b>${esc(mName(mk))}</b><small>${esc(perRange(mk))}</small></td><td>${cl ? `<span class="pill ok">Final</span>` : `<span class="pill warn">${(C.revisi || []).length ? "Revisi" : "Pre-final"}</span>`}${R.import ? `<small>dari import</small>` : ""}</td>
          <td class="r num">${R.labaBersih != null ? fmt(R.labaBersih) : "–"}</td><td>${cl ? esc(fmtDate((C.closedAt || "").slice(0, 10))) + `<small>${esc(C.closedBy || "")}</small>` : "–"}</td>
          <td>${ttdValid(C, T.prep) ? `<span class="pill ok">Dibuat ✓</span>` : `<span class="pill">Dibuat –</span>`} ${ttdValid(C, T.appr) ? `<span class="pill ok">Diketahui ✓</span>` : `<span class="pill">Diketahui –</span>`}</td>
          <td>${(C.revisi || []).length ? (C.revisi || []).map(r => `<small title="${esc(r.alasan || "")}">#${r.no} ${esc(fmtDate((r.at || "").slice(0, 10)))} · ${esc(r.alasan || "")}</small>`).join("") : "–"}</td>
          <td class="rw-act">${Object.keys(RPT_LABEL).map(t => `<button class="btn ghost" type="button" data-rwopen="${mk}|${t}" title="Buka ${esc(RPT_LABEL[t])}">${t === "simple" ? "Simple" : t === "wendy" ? "Wendy" : t === "global" ? "Global" : "Expert"}</button>`).join("")}
            <button class="btn" type="button" data-rwpdf="${mk}">PDF</button></td></tr>`; }).join("") + `</tbody>`
      : `<tr><td class="empty">Belum ada tutup buku. Riwayat muncul setelah pre-final / final.</td></tr>`;
  }
  // tunggu data periode termuat lalu render ulang laporan
  const waitLoaded = (ms = 15000) => new Promise((res, rej) => { const t0 = Date.now(), tick = () => { if (!S.db || (S.rowsLoaded && S.salesLoaded && S.psLoaded && S.prLoaded !== false)) return res(); if (Date.now() - t0 > ms) return rej(new Error("timeout")); setTimeout(tick, 120); }; tick(); });
  function openPeriod(mk){ if (S.rk !== mk) { S.span = 1; $("spanSel").value = "1"; ls.set("rpc-span", "1"); S.rowsLoaded = S.salesLoaded = S.psLoaded = false; setPeriod(mk); } }
  document.addEventListener("click", async e => {
    const o = e.target.closest("[data-rwopen]"); if (o) { const [mk, t] = o.dataset.rwopen.split("|"); openPeriod(mk); go("acc/tutup/" + t); window.scrollTo({ top: 0 }); return; }
    const p = e.target.closest("[data-rwpdf]"); if (!p) return; const mk = p.dataset.rwpdf; S.rwPdf = mk;
    $("rwpTitle").textContent = "Download laporan " + mName(mk); $("rwpMsg").textContent = ""; $("rwpCab").innerHTML = optList(cabList());
    $("rwpList").innerHTML = Object.entries(RPT_LABEL).map(([t, l]) => `<label class="chk"><input type="checkbox" value="${t}" ${t !== "simple" ? "checked" : ""}> ${esc(l)}</label>`).join(""); sheetOpen("rwpSheet");
  });
  async function rptPdfFor(mk, kind, cab){
    openPeriod(mk); await waitLoaded();
    const g = grups().find(x => x === bhCfg().grup) || grups()[0];
    const html = kind === "simple" ? simpleHtml(cab, mk) : kind === "wendy" ? grupHtml(g, mk) : kind === "global" ? globalHtml(mk) : expertHtml(mk);
    const title = { simple: "Income statement " + shortCab(cab), wendy: "Lash Bounty X " + rptCfg().partnerNama, global: "Summary Global income statement", expert: "Laporan keuangan lengkap" }[kind] + " · " + mName(mk);
    return { filename: `Tutup Buku ${RPT_LABEL[kind].replace(/ \(.*\)/, "")} ${kind === "simple" ? shortCab(cab) + " " : ""}${mName(mk)}.pdf`, blob: await htmlToPdf(html, "Lash Bounty ERP · " + title) };
  }
  async function rwpBuild(){ const mk = S.rwPdf, kinds = [...$("rwpList").querySelectorAll("input:checked")].map(x => x.value), cab = $("rwpCab").value;
    if (!kinds.length) throw new Error("Pilih minimal satu laporan."); const out = [];
    for (const t of kinds) { if (t === "simple") { for (const c of ($("rwpAllCab").checked ? cabList() : [cab])) { $("rwpMsg").textContent = "Membuat " + RPT_LABEL[t] + " " + shortCab(c) + "…"; out.push(await rptPdfFor(mk, t, c)); } }
      else { $("rwpMsg").textContent = "Membuat " + RPT_LABEL[t] + "…"; out.push(await rptPdfFor(mk, t)); } }
    $("rwpMsg").textContent = ""; return out; }
  $("rwpGo").addEventListener("click", async () => { const b = $("rwpGo"); if (!S.dl) { toast("Download tidak tersedia di tampilan ini"); return; } b.disabled = true;
    try { for (const f of await rwpBuild()) await S.dl.save({ filename: f.filename, data: f.blob }); toast("PDF disimpan"); sheetClose("rwpSheet"); }
    catch (err) { $("rwpMsg").textContent = err?.message === "timeout" ? "Data periode belum termuat, coba lagi." : err?.message || "Gagal membuat PDF."; }
    finally { b.disabled = false; } });
  $("rwpMail").addEventListener("click", () => { const mk = S.rwPdf; sheetClose("rwpSheet");
    openSend({ title: "Kirim laporan tutup buku", sub: mName(mk), kind: "laporan", tab: "email", attachName: "Laporan tutup buku " + mName(mk) + " (PDF)",
      emailTo: S.users.filter(x => x.role === "owner" && x.email).map(x => x.email), text: `Laporan tutup buku Lash Bounty ${perName(mk)} (${perRange(mk)}) sudah tersedia di Lash Bounty ERP → Accounting → Tutup Buku → Riwayat.`,
      vars: { jenis: "Laporan Tutup Buku", periode: mName(mk), rentang: perRange(mk) }, attach: () => rwpBuild() }); });

  /* ---------- v1.1 · Edit & Penyesuaian tutup buku (manual + Talk to AI) ---------- */
  S.te = { msgs: [], ops: null, busy: false, f: "", c: "" };
  const TE_COLS = { sales: "Omzet", pusat: "Biaya cabang / pusat", expenses: "Petty cash" };
  function teItems(){ const k = S.rk;
    return [...S.sales, ...(S.salesPst || [])].filter(s => inPer(s.tanggal, k)).map(s => ({ col: "sales", id: s.id, tanggal: s.tanggal, cabang: s.cabang, kategori: s.sumber === "Manual" ? s.kategori || "Manual" : "Zenwel" + (s.sumber && s.sumber !== "Zenwel" ? " (" + s.sumber + ")" : ""), ket: s.keterangan || s.file || "", v: s.total || 0, adj: !!s.adj }))
      .concat(biayaPer(k).map(p => ({ col: "pusat", id: p.id, tanggal: p.tanggal, cabang: p.unit, kategori: p.kategori, ket: p.keterangan || "", v: p.jumlah || 0, adj: !!p.adj })))
      .concat(S.rows.filter(r => inPer(r.tanggal, k)).map(r => ({ col: "expenses", id: r.id, tanggal: r.tanggal, cabang: r.cabang, kategori: "Petty cash" + (isHpp(r) ? " · HPP" : ""), ket: r.keterangan || "", v: r.jumlah || 0, adj: false })))
      .sort((a, b) => (a.tanggal || "").localeCompare(b.tanggal || "") || (a.cabang || "").localeCompare(b.cabang || "")); }
  function renderTbEdit(){
    if (S.leaf !== "acc/tutup/edit") return; if (!adminGate("tbBody", "tbRO")) return;
    const k = S.rk, ks = tokKeys(k), closed = ks.some(m => isClosed(m)), mono = ks.length === 1;
    $("teTitle").textContent = "Edit & penyesuaian · " + mName(k);
    $("teLock").hidden = !closed; $("teLock").innerHTML = closed ? `Periode ini sudah <b>final</b>. Untuk mengedit, buka dulu di <a href="#" data-goleaf="acc/tutup/cek">Checklist & kunci</a> → Buka untuk revisi (wajib isi alasan).` : "";
    if (!mono) $("teLock").hidden = false, $("teLock").textContent = "Pilih periode bulanan untuk mengedit.";
    const dis = closed || !mono; ["teIn", "teSend", "taForm"].forEach(id => $(id).toggleAttribute("disabled", dis)); $("taForm").querySelectorAll("input,select,button").forEach(x => x.disabled = dis);
    // ringkasan laba per cabang
    $("teSum").innerHTML = cabList().map(c => { const I = incomeStmt([c], k); return `<div class="kpi"><span class="l">${esc(shortCab(c))}</span><span class="v num ${I.net < 0 ? "dn" : ""}">${rpShort(I.net)}</span><span class="s">omzet ${rpShort(I.sales)} · biaya ${rpShort(I.hppT + I.exp)}</span></div>`; }).join("");
    // chat AI
    const T = S.te; $("teOff").hidden = !!S.sample;
    $("teLog").innerHTML = T.msgs.length ? T.msgs.map((m, i) => `<div class="msg ${m.role}"><div class="bub" id="teB${i}"></div></div>`).join("") : `<div class="ask-empty"><b>Ceritakan yang mau dikoreksi</b><span>Contoh: "Listrik Tebet harusnya 2.350.000" · "Hapus omzet manual Pluit tanggal 3, dobel" · "Tambah biaya perbaikan AC Bekasi 750 ribu tanggal 20".</span></div>`;
    T.msgs.forEach((m, i) => { $("teB" + i).textContent = m.role === "assistant" ? aiVisible(m.content) || "…" : m.content; }); $("teLog").scrollTop = $("teLog").scrollHeight;
    const ops = T.ops?.ops || []; $("teOpsPanel").hidden = !ops.length;
    if (ops.length) { const all = teItems();
      $("teOps").innerHTML = `<thead><tr><th></th><th>Aksi</th><th>Data</th><th class="r">Sebelum</th><th class="r">Sesudah</th></tr></thead><tbody>` + ops.map((o, i) => { const it = all.find(x => x.id === o.id && x.col === o.col), er = teCheck(o, it);
        return `<tr><td><input type="checkbox" data-teon="${i}" ${o._off || er ? "" : "checked"} ${er ? "disabled" : ""} aria-label="Pakai"></td><td>${esc({ ubah: "Ubah", hapus: "Hapus", tambah: "Tambah" }[o.op] || o.op)}${er ? `<small class="dn-r">${esc(er)}</small>` : ""}</td>
          <td class="k">${esc(TE_COLS[o.col] || o.col)} · ${esc(shortCab(it?.cabang || o.doc?.cabang || o.doc?.unit || ""))} · ${esc(it ? fmtDate(it.tanggal) + " · " + (it.kategori || "") + " · " + it.ket : (o.doc?.kategori || "") + " · " + (o.doc?.keterangan || ""))}</td>
          <td class="r num">${it ? fmt(it.v) : "–"}</td><td class="r num">${o.op === "hapus" ? "dihapus" : o.op === "tambah" ? fmt(o.doc?.jumlah ?? o.doc?.total ?? 0) : esc(Object.entries(o.set || {}).map(([f, v]) => (f === "jumlah" || f === "total" ? fmt(v) : f + ": " + v)).join(", "))}</td></tr>`; }).join("") + `</tbody>`;
      const n = ops.filter((o, i) => !o._off && !teCheck(o, all.find(x => x.id === o.id && x.col === o.col))).length; $("teApply").disabled = !n || dis; $("teApply").textContent = `Terapkan ${n} perubahan`; }
    // manual
    const f = $("teF").value, c = $("teC").value; { const keep = c; $("teC").innerHTML = `<option value="">Semua cabang</option>` + optList([...cabList(), "Pusat"], keep); }
    const L = teItems().filter(x => (!f || x.col === f) && (!c || x.cabang === c));
    $("teHint").textContent = L.length + " transaksi · total " + rpShort(sumOf(L, x => x.v));
    if (!$("teTable").contains(document.activeElement) || $("teTable").dataset.sig !== f + "|" + c + "|" + L.length) { $("teTable").dataset.sig = f + "|" + c + "|" + L.length; $("teTable").innerHTML = L.length ? `<thead><tr><th>Tanggal</th><th>Jenis</th><th>Cabang</th><th>Kategori</th><th>Keterangan</th><th class="r">Jumlah</th><th></th></tr></thead><tbody>` +
      L.slice(0, 400).map(x => `<tr data-terow="${x.col}|${esc(x.id)}"><td class="num">${esc(fmtDate(x.tanggal))}</td><td>${esc(TE_COLS[x.col])}${x.adj ? ` <span class="pill">penyesuaian</span>` : ""}</td><td>${esc(shortCab(x.cabang))}</td><td>${esc(x.kategori)}</td>
        <td><input type="text" class="te-ket" value="${esc(x.ket)}" maxlength="160" ${dis ? "disabled" : ""} aria-label="Keterangan"></td><td class="r"><input type="text" class="te-v num" inputmode="numeric" value="${fmt(x.v)}" ${dis ? "disabled" : ""} aria-label="Jumlah"></td>
        <td class="r" style="white-space:nowrap"><button class="btn" type="button" data-tesave ${dis ? "disabled" : ""}>Simpan</button><button class="btn ghost danger" type="button" data-tedel ${dis ? "disabled" : ""}>Hapus</button></td></tr>`).join("") + `</tbody>`
      : `<tr><td class="empty">Tidak ada transaksi.</td></tr>`; }
    // form penyesuaian
    const jn = $("taJenis").value || "biaya"; const kats = jn === "omzet" ? OM_KAT : $("taCab").value === "Pusat" ? PST_KAT : CAB_KAT;
    fillSelect($("taCab"), [...cabList(), "Pusat"], $("taCab").value); { const kk = $("taKat").value; $("taKat").innerHTML = optList(kats, kats.includes(kk) ? kk : kats[0]); }
    if (!$("taTgl").value || !inPer($("taTgl").value, k)) $("taTgl").value = mono ? perEnd(k) : "";
  }
  ["teF", "teC"].forEach(id => $(id).addEventListener("change", renderTbEdit));
  ["taJenis", "taCab"].forEach(id => $(id).addEventListener("change", renderTbEdit));
  $("taJml").addEventListener("input", e => { const n = parseRp(e.target.value); e.target.value = n ? fmt(n) : ""; });
  $("teTable").addEventListener("input", e => { if (e.target.classList.contains("te-v")) { const n = parseRp(e.target.value); e.target.value = n ? fmt(n) : "0"; } });
  const teField = col => col === "sales" ? "total" : "jumlah";
  $("teTable").addEventListener("click", async e => { const tr = e.target.closest("[data-terow]"); if (!tr) return; const [col, id] = tr.dataset.terow.split("|"), it = teItems().find(x => x.col === col && x.id === id); if (!it) return;
    const lk = lockOf(it.tanggal); if ((e.target.closest("[data-tesave]") || e.target.closest("[data-tedel]")) && lk) { toast(lk); return; }
    if (e.target.closest("[data-tesave]")) { const v = parseRp(tr.querySelector(".te-v").value), ket = tr.querySelector(".te-ket").value.trim();
      if (!(v > 0)) { toast("Jumlah harus lebih dari 0 (pakai Hapus untuk menghapus)"); return; }
      const set = { [teField(col)]: v, keterangan: ket }; if (col === "sales") { const s = [...S.sales, ...(S.salesPst || [])].find(x => x.id === id); if (s?.sumber === "Manual" || s?.net === s?.total) set.net = v; }
      try { await S.db.doc(col + "/" + id).update({ ...set, editAt: new Date().toISOString(), editBy: actorName() }); toast("Tersimpan"); } catch (err) { toast(err?.message || "Gagal menyimpan"); } return; }
    const d = e.target.closest("[data-tedel]"); if (d) { if (d.dataset.armed !== "1") { d.dataset.armed = "1"; d.textContent = "Yakin?"; setTimeout(() => { d.dataset.armed = ""; d.textContent = "Hapus"; }, 3000); return; }
      try { await S.db.doc(col + "/" + id).delete(); toast("Dihapus"); } catch (err) { toast(err?.message || "Gagal menghapus"); } } });
  $("taForm").addEventListener("submit", async e => { e.preventDefault(); const msg = $("taMsg"), jn = $("taJenis").value, tgl = $("taTgl").value, cab = $("taCab").value, kat = $("taKat").value, ket = $("taKet").value.trim(), v = parseRp($("taJml").value);
    if (!validISO(tgl) || !inPer(tgl, S.rk)) { msg.textContent = "Tanggal harus di dalam periode " + perRange(S.rk) + "."; return; }
    const lk = lockOf(tgl); if (lk) { msg.textContent = lk; return; } if (!(v > 0)) { msg.textContent = "Isi jumlah."; return; } if (!ket) { msg.textContent = "Isi keterangan / alasan penyesuaian."; return; }
    const base = { tanggal: tgl, bulan: tgl.slice(0, 7), keterangan: ket, pengisi: actorName(), adj: true, by: S.uid || null, at: new Date().toISOString(), contoh: false };
    try { if (jn === "omzet") await S.db.collection("sales").add({ ...base, cabang: cab, kategori: kat, sumber: "Manual", total: v, net: v, items: [], qty: 0 });
      else await S.db.collection("pusat").add({ ...base, unit: cab, kategori: kat, jumlah: v, nota: "", dana: "Penyesuaian" });
      $("taKet").value = ""; $("taJml").value = ""; msg.textContent = ""; toast("Penyesuaian ditambahkan"); }
    catch (err) { msg.textContent = err?.message || "Gagal menyimpan."; } });
  function teCheck(o, it){
    if (!TE_COLS[o.col]) return "jenis data?";
    if (o.op === "ubah" || o.op === "hapus") { if (!it) return "data tidak ditemukan"; if (lockOf(it.tanggal)) return "periode terkunci"; }
    if (o.op === "ubah") { const ks = Object.keys(o.set || {}); if (!ks.length || ks.some(f => !["jumlah", "total", "keterangan", "kategori", "tanggal"].includes(f))) return "kolom tidak boleh";
      if (o.set.tanggal && (!validISO(o.set.tanggal) || !inPer(o.set.tanggal, S.rk))) return "tanggal di luar periode";
      if ((o.set.jumlah ?? o.set.total) != null && !(+(o.set.jumlah ?? o.set.total) > 0)) return "angka?"; }
    if (o.op === "tambah") { const d = o.doc || {}, cab = d.cabang || d.unit; if (o.col === "expenses") return "petty cash diinput dari cabang";
      if (![...cabList(), "Pusat"].includes(cab)) return "cabang?"; if (!validISO(d.tanggal) || !inPer(d.tanggal, S.rk)) return "tanggal?"; if (!(+(d.jumlah ?? d.total) > 0)) return "angka?";
      if (o.col === "pusat" && !(cab === "Pusat" ? PST_KAT : CAB_KAT_ALL).includes(d.kategori)) return "kategori?"; }
    if (!["ubah", "hapus", "tambah"].includes(o.op)) return "aksi?";
    return "";
  }
  function teSystem(){
    const k = S.rk, items = teItems().map(x => [x.col, x.id, x.tanggal, x.cabang, x.kategori, x.ket.slice(0, 60), x.v].join(" | ")).join("\n");
    const sum = cabList().map(c => { const I = incomeStmt([c], k); return `${c}: omzet ${I.sales}, HPP ${I.hppT}, gaji+komisi ${I.salT + I.komT}, biaya bulanan ${I.monT}, sewa ${I.rentT}, lain ${I.othT}, net ${I.net}`; }).join("\n");
    return `Kamu asisten "Edit tutup buku" di Lash Bounty ERP. Periode ${perName(k)} (${perRange(k)}). User (admin keuangan) minta koreksi data laporan. Bahasa Indonesia santai, singkat.
Tugas: pahami koreksinya, cari transaksi yang dimaksud di daftar, lalu usulkan perubahan. Kalau ambigu (lebih dari satu transaksi cocok, cabang tidak jelas), TANYA dulu. Jangan mengarang id.
Aturan: biaya ditulis angka positif. Omzet = koleksi "sales" (field total). Biaya cabang & kantor pusat = koleksi "pusat" (field jumlah, cabang di field unit). Petty cash = "expenses" (hanya boleh ubah/hapus, tidak boleh tambah). Gaji diubah di HRD → Payroll, bukan di sini; kalau user minta ubah gaji, jelaskan caranya.
Kategori biaya cabang: ${JSON.stringify(CAB_KAT)}. Kategori pusat: ${JSON.stringify(PST_KAT)}. Kategori omzet manual: ${JSON.stringify(OM_KAT)}. Cabang: ${JSON.stringify([...cabList(), "Pusat"])}.
Ringkasan per cabang saat ini:\n${sum}
Daftar transaksi (koleksi | id | tanggal | cabang | kategori | keterangan | jumlah):\n${items || "(kosong)"}
SETIAP balasan WAJIB diakhiri satu blok \`\`\`json: {"ops":[...],"ringkasan":"apa yang berubah & efeknya ke laba"}. ops kosong kalau masih bertanya. Format op:
{"op":"ubah","col":"pusat","id":"…","set":{"jumlah":2350000}}  (field boleh: jumlah/total, keterangan, kategori, tanggal)
{"op":"hapus","col":"sales","id":"…"}
{"op":"tambah","col":"pusat","doc":{"unit":"Cabang …","kategori":"…","tanggal":"YYYY-MM-DD","keterangan":"…","jumlah":angka}}
{"op":"tambah","col":"sales","doc":{"cabang":"Cabang …","kategori":"…","tanggal":"YYYY-MM-DD","keterangan":"…","total":angka}}
ops = daftar LENGKAP usulan terbaru (kirim ulang semua).`;
  }
  async function teSend(q){ const T = S.te; q = String(q || "").trim(); if (!q || T.busy || !S.sample) return;
    T.msgs.push({ role: "user", content: q }, { role: "assistant", content: "" }); T.busy = true; $("teIn").value = ""; renderTbEdit(); const idx = T.msgs.length - 1;
    try { const out = await S.sample(T.msgs.slice(0, -1).map(m => ({ role: m.role, content: m.content })), { system: teSystem(), maxTokens: 6000, cache: false });
      T.msgs[idx].content = out.text || "Maaf, belum ada jawaban."; const P = aiParse(out.text); if (P && Array.isArray(P.ops)) T.ops = P; }
    catch (err) { T.msgs[idx].content = err?.code === "rate_limited" ? "Batas pemakaian AI tercapai. Coba lagi beberapa menit lagi." : "Gagal menghubungi AI: " + (err?.message || "coba lagi"); }
    finally { T.busy = false; renderTbEdit(); } }
  $("teForm").addEventListener("submit", e => { e.preventDefault(); teSend($("teIn").value); });
  $("teIn").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); teSend($("teIn").value); } });
  $("teReset").addEventListener("click", () => { if (S.te.busy) return; S.te = { msgs: [], ops: null, busy: false }; renderTbEdit(); });
  $("teOps").addEventListener("change", e => { const c = e.target.closest("[data-teon]"); if (c) { S.te.ops.ops[+c.dataset.teon]._off = !c.checked; renderTbEdit(); } });
  $("teApply").addEventListener("click", async () => { const all = teItems(), ops = (S.te.ops?.ops || []).filter(o => !o._off && !teCheck(o, all.find(x => x.id === o.id && x.col === o.col))); if (!ops.length) return;
    $("teApply").disabled = true; let n = 0; const at = new Date().toISOString(), by = actorName();
    try { for (const o of ops) {
        if (o.op === "hapus") await S.db.doc(o.col + "/" + o.id).delete();
        else if (o.op === "ubah") { const set = { ...o.set }; if (set.jumlah != null && o.col === "sales") { set.total = +set.jumlah; delete set.jumlah; } if (set.total != null && o.col !== "sales") { set.jumlah = +set.total; delete set.total; }
          ["jumlah", "total"].forEach(f => { if (set[f] != null) set[f] = Math.round(Math.abs(+set[f])); }); if (set.total != null) set.net = set.total; if (set.tanggal) set.bulan = set.tanggal.slice(0, 7);
          await S.db.doc(o.col + "/" + o.id).update({ ...set, editAt: at, editBy: by + " (AI)" }); }
        else { const d = o.doc, base = { tanggal: d.tanggal, bulan: d.tanggal.slice(0, 7), keterangan: d.keterangan || "Penyesuaian", pengisi: by + " (AI)", adj: true, by: S.uid || null, at, contoh: false };
          if (o.col === "sales") await S.db.collection("sales").add({ ...base, cabang: d.cabang || d.unit, kategori: OM_KAT.includes(d.kategori) ? d.kategori : "Pemasukan lain", sumber: "Manual", total: Math.round(+(d.total ?? d.jumlah)), net: Math.round(+(d.total ?? d.jumlah)), items: [], qty: 0 });
          else await S.db.collection("pusat").add({ ...base, unit: d.unit || d.cabang, kategori: d.kategori, jumlah: Math.round(Math.abs(+(d.jumlah ?? d.total))), nota: "", dana: "Penyesuaian" }); }
        n++; }
      S.te.msgs.push({ role: "assistant", content: `Sudah diterapkan ${n} perubahan. Cek angka di laporan; semua tercatat di Pengaturan → Riwayat perubahan.` }); S.te.ops = null; toast(n + " perubahan diterapkan");
    } catch (err) { toast("Berhenti setelah " + n + " perubahan: " + (err?.message || "gagal")); }
    finally { renderTbEdit(); } });

  /* ---------- v1.1 · Permintaan barang cabang → pusat (stok berdiri sendiri, tidak menyentuh HPP) ---------- */
  S.minta = []; S.mintaLoaded = false; S.mtRows = [{ nama: "", qty: "" }];
  const MT_ST = { menunggu: ["warn", "Menunggu diproses"], dipesan: ["warn", "Menunggu pesanan"], dikirim: ["", "Dalam pengiriman"], diterima: ["ok", "Sudah diterima"], ditolak: ["no", "Ditolak"] };
  const addDaysISO = (iso, n) => { const d = new Date(iso + "T00:00"); d.setDate(d.getDate() + n); return isoOf(d); };
  const mtLate = p => !["diterima", "ditolak"].includes(p.status) && addDaysISO(p.estimasi || String(p.at || p.tanggal || todayISO()).slice(0, 10), 3) < todayISO();
  const mtCab = () => S.staff || (!S.admin && myCab()) || "";
  const mtItemsTxt = p => (p.items || []).map(i => `• ${i.nama}: ${fmtQty(i.kirim ?? i.qty)} ${i.satuan || ""}`.trim()).join("\n");
  function renderMinta(){
    if (S.leaf !== "inv/minta") return;
    const fixed = mtCab(), cabs = fixed ? [fixed] : cabList(); fillSelect($("mtCab"), cabs, $("mtCab").value || fixed || ls.get("rpc-cabang")); $("mtCabF").hidden = !!fixed && !S.admin;
    $("mtNames").innerHTML = itemList().map(it => `<option value="${esc(it.nama)}">`).join("");
    if ($("mtRows").children.length !== S.mtRows.length || !$("mtRows").contains(document.activeElement)) $("mtRows").innerHTML = S.mtRows.map((r, i) => { const it = itemList().find(x => x.nama === r.nama);
      return `<div class="mt-row"><input type="text" list="mtNames" data-mtn="${i}" value="${esc(r.nama)}" placeholder="Nama barang" maxlength="80" aria-label="Nama barang ${i + 1}"><input type="text" inputmode="decimal" data-mtq="${i}" value="${esc(r.qty)}" placeholder="Jumlah" aria-label="Jumlah ${i + 1}"><span class="note">${esc(it?.satuan || "")}</span>${S.mtRows.length > 1 ? `<button type="button" class="btn ghost" data-mtx="${i}" aria-label="Hapus baris">✕</button>` : ""}</div>`; }).join("");
    const f = $("mtFilter").value, myC = fixed, L = S.minta.filter(p => (!myC || p.cabang === myC) && (!f || (f === "aktif" ? !["diterima", "ditolak"].includes(p.status) : f === "telat" ? mtLate(p) : p.status === f)))
      .sort((a, b) => (["diterima", "ditolak"].includes(a.status) - ["diterima", "ditolak"].includes(b.status)) || (b.at || "").localeCompare(a.at || ""));
    const aktif = S.minta.filter(p => (!myC || p.cabang === myC) && !["diterima", "ditolak"].includes(p.status)), telat = aktif.filter(mtLate);
    $("mtKpis").innerHTML = [["Menunggu diproses", aktif.filter(p => p.status === "menunggu").length], ["Menunggu pesanan", aktif.filter(p => p.status === "dipesan").length], ["Dalam pengiriman", aktif.filter(p => p.status === "dikirim").length], ["Terlambat > 3 hari", telat.length]]
      .map(([l, v], i) => `<div class="kpi"><span class="l">${l}</span><span class="v num ${i === 3 && v ? "up" : ""}">${v}</span><span class="s">${i === 3 ? "owner dinotifikasi" : "permintaan"}</span></div>`).join("");
    $("mtList").innerHTML = !S.mintaLoaded ? `<tr><td class="empty">Memuat…</td></tr>` : L.length ? `<thead><tr><th>Diminta</th><th>Cabang</th><th>Barang</th><th>Status</th><th>Estimasi sampai</th><th></th></tr></thead><tbody>` +
      L.map(p => { const [ty, lb] = MT_ST[p.status] || ["", p.status], late = mtLate(p), mine = p.by && p.by === S.uid;
        return `<tr><td class="num">${esc(fmtDate(String(p.at || p.tanggal || "").slice(0, 10)))}<small>${esc(p.pengaju || "")}</small></td><td>${esc(shortCab(p.cabang))}</td>
          <td class="k">${(p.items || []).map(i => `<div>${esc(i.nama)} · <b>${fmtQty(i.kirim ?? i.qty)}</b> ${esc(i.satuan || "")}${i.kirim != null && i.kirim !== i.qty ? ` <small>(minta ${fmtQty(i.qty)})</small>` : ""}</div>`).join("")}${p.catatan ? `<small>${esc(p.catatan)}</small>` : ""}</td>
          <td><span class="pill ${ty}">${lb}</span>${late ? ` <span class="pill no">Terlambat</span>` : ""}${p.catatanAdmin ? `<small>${esc(p.catatanAdmin)}</small>` : ""}${p.status === "diterima" ? `<small>${esc(fmtDate(String(p.diterimaAt || "").slice(0, 10)))} · ${esc(p.diterimaBy || "")} · masuk stok</small>` : ""}</td>
          <td class="num">${p.estimasi ? esc(fmtDate(p.estimasi)) : "–"}</td>
          <td class="r" style="white-space:nowrap">${S.admin && !["diterima"].includes(p.status) ? `<button class="btn" type="button" data-mtpro="${esc(p.id)}">Proses</button>` : ""}
            ${["dipesan", "dikirim"].includes(p.status) ? `<button class="btn primary" type="button" data-mtok="${esc(p.id)}">Sudah diterima</button>` : ""}
            <button class="btn ghost" type="button" data-mtsend="${esc(p.id)}">Kirim</button>${p.status === "menunggu" && (mine || S.admin) ? `<button class="btn ghost danger" type="button" data-mtdel="${esc(p.id)}">Batalkan</button>` : ""}</td></tr>`; }).join("") + `</tbody>`
      : `<tr><td class="empty">Belum ada permintaan barang${f ? " dengan status ini" : ""}.</td></tr>`;
  }
  $("mtFilter").addEventListener("change", renderMinta);
  $("mtAdd").addEventListener("click", () => { S.mtRows.push({ nama: "", qty: "" }); renderMinta(); $("mtRows").querySelector(`[data-mtn="${S.mtRows.length - 1}"]`)?.focus(); });
  $("mtRows").addEventListener("input", e => { const n = e.target.dataset.mtn, q = e.target.dataset.mtq; if (n != null) S.mtRows[+n].nama = e.target.value; if (q != null) S.mtRows[+q].qty = e.target.value; });
  $("mtRows").addEventListener("change", e => { if (e.target.dataset.mtn == null) return; const it = itemList().find(x => x.nama.toLowerCase() === e.target.value.trim().toLowerCase()), sp = e.target.parentElement.querySelector(".note"); if (sp) sp.textContent = it?.satuan || ""; });
  $("mtRows").addEventListener("click", e => { const x = e.target.closest("[data-mtx]"); if (x) { S.mtRows.splice(+x.dataset.mtx, 1); renderMinta(); } });
  $("mtForm").addEventListener("submit", async e => { e.preventDefault(); const msg = $("mtMsg"), cab = $("mtCab").value;
    const items = [], bad = []; S.mtRows.forEach(r => { const nama = r.nama.trim(), q = parseQty(r.qty); if (!nama && (r.qty === "" || r.qty == null)) return; if (!nama || !(q > 0)) { bad.push(nama || "baris kosong"); return; }
      const it = itemList().find(x => x.nama.toLowerCase() === nama.toLowerCase()); items.push({ nama: it?.nama || nama, satuan: it?.satuan || "", qty: q }); });
    if (!cab) { msg.textContent = "Pilih cabang."; return; } if (bad.length) { msg.textContent = "Cek nama barang & jumlah: " + bad.join(", "); return; } if (!items.length) { msg.textContent = "Isi minimal 1 barang."; return; }
    const at = new Date().toISOString(), by = actorName();
    try { await S.db.collection("permintaan").add({ cabang: cab, tanggal: todayISO(), items, catatan: $("mtKet").value.trim(), butuh: $("mtButuh").value || "", status: "menunggu", pengaju: by, by: S.uid || null, at, riwayat: [{ at, by, status: "menunggu" }] });
      S.mtRows = [{ nama: "", qty: "" }]; $("mtKet").value = ""; $("mtButuh").value = ""; msg.textContent = ""; renderMinta(); toast("Permintaan terkirim ke pusat"); }
    catch (err) { msg.textContent = err?.message || "Gagal mengirim."; } });
  document.addEventListener("click", async e => {
    let b = e.target.closest("[data-mtpro]"); if (b) { const p = S.minta.find(x => x.id === b.dataset.mtpro); if (!p) return; S.mtPro = p.id;
      $("mpTitle").textContent = "Proses permintaan · " + shortCab(p.cabang); $("mpSt").innerHTML = ["dipesan", "dikirim", "ditolak", ...(p.status === "menunggu" ? ["menunggu"] : [])].map(s => `<option value="${s}" ${s === (p.status === "menunggu" ? "dipesan" : p.status) ? "selected" : ""}>${MT_ST[s][1]}</option>`).join("");
      $("mpEst").value = p.estimasi || addDaysISO(todayISO(), 3); $("mpKet").value = p.catatanAdmin || ""; $("mpMsg").textContent = "";
      $("mpItems").innerHTML = (p.items || []).map((i, k) => `<div class="mt-row"><span>${esc(i.nama)} <small class="note">minta ${fmtQty(i.qty)} ${esc(i.satuan || "")}</small></span><input type="text" inputmode="decimal" data-mpq="${k}" value="${fmtQty(i.kirim ?? i.qty)}" aria-label="Jumlah dikirim ${esc(i.nama)}"></div>`).join("");
      sheetOpen("mpSheet"); return; }
    b = e.target.closest("[data-mtok]"); if (b) { const p = S.minta.find(x => x.id === b.dataset.mtok); if (!p) return;
      if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Yakin sudah sampai?"; setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.textContent = "Sudah diterima"; } }, 4000); return; }
      b.disabled = true; const at = new Date().toISOString(), by = actorName(), tgl = todayISO();
      try { const ref = await S.db.collection("opname").add({ jenis: "jurnal", cabang: p.cabang, tanggal: tgl, bulan: tgl.slice(0, 7), items: (p.items || []).map(i => ({ nama: i.nama, satuan: i.satuan || "", masuk: +(i.kirim ?? i.qty) || 0, keluar: 0 })).filter(i => i.masuk > 0),
          catatan: "Kiriman pusat (permintaan " + fmtDate(String(p.at || p.tanggal).slice(0, 10)) + ")", pengisi: by, permintaanId: p.id, by: S.uid || null, at, contoh: false });
        await S.db.doc("permintaan/" + p.id).update({ status: "diterima", diterimaAt: at, diterimaBy: by, stokId: ref.id, riwayat: [...(p.riwayat || []), { at, by, status: "diterima" }] });
        toast("Diterima · stok " + shortCab(p.cabang) + " bertambah"); }
      catch (err) { toast(err?.message || "Gagal menyimpan"); b.disabled = false; } return; }
    b = e.target.closest("[data-mtsend]"); if (b) { const p = S.minta.find(x => x.id === b.dataset.mtsend); if (!p) return;
      const text = `*Permintaan barang · ${shortCab(p.cabang)}*\nTanggal: ${fullDate(String(p.at || p.tanggal).slice(0, 10))}\n${mtItemsTxt(p)}\nStatus: ${MT_ST[p.status]?.[1] || p.status}${p.estimasi ? "\nEstimasi sampai: " + fullDate(p.estimasi) : ""}${p.catatan ? "\nCatatan: " + p.catatan : ""}`;
      openSend({ title: "Kirim permintaan barang", sub: shortCab(p.cabang), kind: "umum", text, vars: { judul: "Permintaan Barang " + shortCab(p.cabang), isi: text.replace(/\*/g, "") } }); return; }
    b = e.target.closest("[data-mtdel]"); if (b) { if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Yakin?"; setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.textContent = "Batalkan"; } }, 3000); return; }
      try { await S.db.doc("permintaan/" + b.dataset.mtdel).delete(); toast("Permintaan dibatalkan"); } catch (err) { toast(err?.message || "Gagal"); } }
  });
  $("mpOk").addEventListener("click", async () => { const p = S.minta.find(x => x.id === S.mtPro); if (!p) return; const st = $("mpSt").value, est = $("mpEst").value, at = new Date().toISOString(), by = actorName();
    if (["dipesan", "dikirim"].includes(st) && !validISO(est)) { $("mpMsg").textContent = "Isi estimasi sampai."; return; }
    const items = (p.items || []).map((i, k) => { const q = parseQty($("mpItems").querySelector(`[data-mpq="${k}"]`)?.value); return { ...i, kirim: Number.isFinite(q) && q != null ? q : i.qty }; });
    try { await S.db.doc("permintaan/" + p.id).update({ status: st, estimasi: st === "ditolak" ? "" : est, catatanAdmin: $("mpKet").value.trim(), items, prosesBy: by, prosesAt: at, ...(st === "dipesan" ? { pesanAt: at } : st === "dikirim" ? { kirimAt: at } : {}), riwayat: [...(p.riwayat || []), { at, by, status: st, ket: $("mpKet").value.trim() }] });
      sheetClose("mpSheet"); toast("Status: " + MT_ST[st][1]); }
    catch (err) { $("mpMsg").textContent = err?.message || "Gagal menyimpan."; } });

  /* ---------- v1.1 · Grafik pemakaian barang ---------- */
  const PAKAI_N = 6;
  function pakaiOf(c, mk){ const K = kartu(c, mk), o = {}; K.rows.forEach(r => { const v = r.op != null && r.cl != null ? r2(r.op + r.ms - r.cl) : r.kl; if (v > 0) o[r.it.nama] = v; }); return o; }
  function renderGrafik(){
    if (S.leaf !== "inv/stok/grafik") return; if (!adminGate("grBody", "grRO")) return;
    const cabs = cabList(), items = itemList(); { const kc = $("grCab").value; $("grCab").innerHTML = `<option value="">Semua cabang</option>` + optList(cabs, kc); }
    const ks = []; let k = S.month; for (let i = 0; i < PAKAI_N; i++) { ks.unshift(k); k = prevKey(k); }
    const cs = $("grCab").value ? [$("grCab").value] : cabs, D = {}; ks.forEach(mk => cs.forEach(c => D[mk + "|" + c] = pakaiOf(c, mk)));
    const tot = {}; ks.forEach(mk => cs.forEach(c => Object.entries(D[mk + "|" + c]).forEach(([n, v]) => tot[n] = (tot[n] || 0) + v)));
    const rank = Object.entries(tot).sort((a, b) => b[1] - a[1]);
    { const kb = $("grItem").value; $("grItem").innerHTML = optList(items.map(x => x.nama), kb && items.some(x => x.nama === kb) ? kb : rank[0]?.[0] || items[0]?.nama); }
    const it = $("grItem").value, sat = items.find(x => x.nama === it)?.satuan || "", sortBy = $("grSort").value;
    $("grHint").textContent = `${mName(ks[0])} – ${mName(ks[ks.length - 1])} · pemakaian = stok awal + masuk − stock opname (atau jurnal keluar kalau belum opname)`;
    if (!S.opnLoaded) { $("grChart").innerHTML = `<div class="empty">Memuat…</div>`; return; }
    if (!items.length) { $("grChart").innerHTML = `<div class="empty">Belum ada daftar barang stok (Pengaturan → Barang stok).</div>`; $("grRank").innerHTML = ""; $("grTable").innerHTML = ""; return; }
    // 1) tren barang terpilih per bulan, per cabang
    const ser = cs.map((c, i) => ({ c, col: `var(--s${(cabs.indexOf(c) % 8) + 1})`, v: ks.map(mk => D[mk + "|" + c][it] || 0) }));
    const maxV = Math.max(1, ...ser.flatMap(s => s.v)), nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(maxV))), m = maxV / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; })(), step = nice / 4;
    const W = 760, H = 230, Lm = 44, R = 8, T = 14, B = 28, pw = W - Lm - R, ph = H - T - B, gw = pw / ks.length, bw = Math.min(30, (gw - 18) / Math.max(1, ser.length) - 2);
    let svg = `<svg class="daily" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pemakaian ${esc(it)} per bulan">`;
    for (let v = 0; v <= nice + 1e-9; v += step) { const y = T + ph - v / nice * ph; svg += `<line class="grid" x1="${Lm}" x2="${W - R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/><text x="${Lm - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${fmtQty(r2(v))}</text>`; }
    ks.forEach((mk, i) => { const x0 = Lm + i * gw + (gw - ser.length * (bw + 2) + 2) / 2;
      ser.forEach((s, j) => { const v = s.v[i], hh = v ? Math.max(2, v / nice * ph) : 0, x = x0 + j * (bw + 2), y = T + ph - hh;
        if (hh) svg += `<path d="M${x.toFixed(1)},${(T + ph).toFixed(1)}V${(y + 4).toFixed(1)}q0,-4 4,-4h${(bw - 8).toFixed(1)}q4,0 4,4V${(T + ph).toFixed(1)}Z" fill="${s.col}"><title>${esc(mName(mk))} · ${esc(shortCab(s.c))}: ${fmtQty(v)} ${esc(sat)}</title></path>`;
        svg += `<rect x="${x.toFixed(1)}" y="${T}" width="${bw.toFixed(1)}" height="${ph}" fill="transparent"><title>${esc(mName(mk))} · ${esc(shortCab(s.c))}: ${fmtQty(v)} ${esc(sat)}</title></rect>`; });
      svg += `<text x="${(Lm + i * gw + gw / 2).toFixed(1)}" y="${H - 9}" text-anchor="middle">${esc(mName(mk).slice(0, 3) + " " + mk.slice(2, 4))}</text>`; });
    $("grChart").innerHTML = svg + `</svg>`; $("grTitle").textContent = "Pemakaian " + it + (sat ? " (" + sat + ")" : "") + " per bulan";
    $("grLegend").innerHTML = ser.length > 1 ? ser.map(s => `<span><i style="background:${s.col}"></i>${esc(shortCab(s.c))} · ${fmtQty(r2(s.v.reduce((a, b) => a + b, 0)))}</span>`).join("") : "";
    // 2) peringkat barang (periode berjalan atau 6 bulan)
    const useAll = $("grRange").value === "6", base = {}; (useAll ? ks : [S.month]).forEach(mk => cs.forEach(c => Object.entries(D[mk + "|" + c] || pakaiOf(c, mk)).forEach(([n, v]) => base[n] = (base[n] || 0) + v)));
    let rk = Object.entries(base); rk = sortBy === "nama" ? rk.sort((a, b) => a[0].localeCompare(b[0])) : rk.sort((a, b) => b[1] - a[1]);
    const mx = Math.max(1, ...rk.map(x => x[1]));
    $("grRank").innerHTML = rk.length ? rk.map(([n, v]) => `<button type="button" class="hbar ${n === it ? "on" : ""}" data-gritem="${esc(n)}" title="Lihat tren ${esc(n)}"><span class="hb-l">${esc(n)}</span><span class="hb-t"><i style="width:${(v / mx * 100).toFixed(1)}%"></i></span><b class="num">${fmtQty(r2(v))} <small>${esc(items.find(x => x.nama === n)?.satuan || "")}</small></b></button>`).join("")
      : `<div class="empty">Belum ada pemakaian tercatat di ${useAll ? "6 bulan ini" : perName(S.month)}${$("grCab").value ? " untuk " + esc(shortCab($("grCab").value)) : ""}.</div>`;
    // 3) tabel
    $("grTable").innerHTML = `<thead><tr><th>Barang</th>${ks.map(mk => `<th class="r">${esc(mName(mk).slice(0, 3) + " " + mk.slice(2, 4))}</th>`).join("")}<th class="r">Total</th></tr></thead><tbody>` +
      (rank.length ? rank.map(([n]) => { const vs = ks.map(mk => sumOf(cs, c => D[mk + "|" + c][n] || 0)); return `<tr><td>${esc(n)}</td>${vs.map(v => `<td class="r num">${v ? fmtQty(r2(v)) : "–"}</td>`).join("")}<td class="r num"><b>${fmtQty(r2(vs.reduce((a, b) => a + b, 0)))}</b></td></tr>`; }).join("") : `<tr><td class="empty" colspan="${ks.length + 2}">Belum ada data.</td></tr>`) + `</tbody>`;
  }
  ["grCab", "grItem", "grSort", "grRange"].forEach(id => $(id).addEventListener("change", renderGrafik));
  $("grRank").addEventListener("click", e => { const b = e.target.closest("[data-gritem]"); if (b) { $("grItem").value = b.dataset.gritem; renderGrafik(); } });

  /* ---------- v1.1 · Musnahkan aset rusak + Berita Acara Pemusnahan ---------- */
  S.musnah = []; S.musnahLoaded = false;
  const MS_CARA = ["Dihancurkan / dibuang", "Didaur ulang", "Diserahkan ke pihak ketiga", "Dijual sebagai barang bekas", "Lainnya"];
  const baNo = (tgl) => { const y = tgl.slice(0, 4), m = tgl.slice(5, 7), n = S.musnah.filter(x => (x.tanggal || "").slice(0, 7) === tgl.slice(0, 7)).length + 1; return `BA/LB/${y}/${m}/${String(n).padStart(3, "0")}`; };
  document.addEventListener("click", e => { const b = e.target.closest("[data-asmus]"); if (!b) return; const a = S.aset.find(x => x.id === b.dataset.asmus); if (!a) return; S.msAset = a.id;
    $("msTitle").textContent = "Musnahkan aset · " + a.nama; $("msSub").textContent = shortCab(a.lokasi) + " · " + fmt(a.qty) + " unit · " + fmt(a.rusak || 0) + " rusak";
    $("msQty").value = String(a.rusak || 1); $("msTgl").value = todayISO(); $("msCara").innerHTML = optList(MS_CARA); $("msAlasan").value = ""; $("msSaksi").value = ""; $("msMsg").textContent = ""; sheetOpen("msSheet"); });
  $("msOk").addEventListener("click", async () => { const a = S.aset.find(x => x.id === S.msAset); if (!a) return; const n = parseInt($("msQty").value, 10), tgl = $("msTgl").value, alasan = $("msAlasan").value.trim(), msg = $("msMsg");
    if (!(n > 0) || n > (a.rusak || 0)) { msg.textContent = `Jumlah 1 – ${a.rusak || 0} unit (sesuai unit rusak).`; return; } if (!validISO(tgl)) { msg.textContent = "Isi tanggal."; return; } if (alasan.length < 4) { msg.textContent = "Tulis kondisi / alasan pemusnahan."; return; }
    const u = me(), at = new Date().toISOString(), doc = { nomor: baNo(tgl), asetId: a.id, nama: a.nama, kategori: a.kategori || "", lokasi: a.lokasi, qty: n, nilai: a.nilai || 0, tglBeli: a.tglBeli || "", tanggal: tgl, alasan, cara: $("msCara").value, saksi: $("msSaksi").value.trim(),
      pembuat: actorName(), ttd: u?.ttd ? { prep: { uid: u.id, nama: u.nama, img: u.ttd, at } } : {}, by: S.uid || null, at };
    $("msOk").disabled = true;
    try { const ref = await S.db.collection("pemusnahan").add(doc); const sisa = (a.qty || 0) - n;
      if (sisa > 0) await S.db.doc("aset/" + a.id).update({ qty: sisa, rusak: (a.rusak || 0) - n }); else await S.db.doc("aset/" + a.id).delete();
      sheetClose("msSheet"); toast("Aset dimusnahkan · berita acara dibuat"); baPreview({ id: ref.id, ...doc }); }
    catch (err) { msg.textContent = err?.message || "Gagal menyimpan."; }
    finally { $("msOk").disabled = false; } });
  function baHtml(x){
    const d = new Date(x.tanggal + "T00:00"), R = rptCfg(), T = x.ttd || {};
    const sig = (lbl, t, nama, jab) => `<div><small>${lbl}</small><span class="ttd-img">${t?.img ? `<img src="${esc(t.img)}" alt="">` : ""}</span><b>${esc(t?.nama || nama || "( ................................ )")}</b><em>${jab}</em></div>`;
    return `<div class="rp-h rb"><b>BERITA ACARA PEMUSNAHAN ASET</b><span>Nomor: ${esc(x.nomor || "-")}</span></div>
      <p class="rb ba-p">Pada hari ini, <b>${HARI[d.getDay()]}</b>, tanggal <b>${esc(tglPanjang(x.tanggal))}</b>, bertempat di <b>Lash Bounty ${esc(shortCab(x.lokasi))}</b>, kami yang bertanda tangan di bawah ini telah melaksanakan pemusnahan aset milik Lash Bounty dengan rincian sebagai berikut:</p>
      <table class="rp-t rb"><thead><tr><th>No</th><th>Nama aset</th><th>Kategori</th><th>Lokasi</th><th class="r">Jumlah</th><th class="r">Nilai per unit</th><th class="r">Total nilai</th></tr></thead>
      <tbody><tr><td>1</td><td>${esc(x.nama)}</td><td>${esc(x.kategori || "-")}</td><td>${esc(shortCab(x.lokasi))}</td><td class="r">${fmt(x.qty)} unit</td><td class="r">${fmt(x.nilai || 0)}</td><td class="r">${fmt((x.nilai || 0) * x.qty)}</td></tr></tbody></table>
      <table class="rp-t rb ba-kv"><tbody><tr><td>Kondisi / alasan</td><td>${esc(x.alasan)}</td></tr><tr><td>Cara pemusnahan</td><td>${esc(x.cara || "-")}</td></tr>${x.tglBeli ? `<tr><td>Tanggal pembelian</td><td>${esc(tglPanjang(x.tglBeli))}</td></tr>` : ""}<tr><td>Saksi</td><td>${esc(x.saksi || "-")}</td></tr></tbody></table>
      <p class="rb ba-p">Dengan dilaksanakannya pemusnahan ini, aset tersebut di atas dikeluarkan dari daftar aset Lash Bounty. Demikian berita acara ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.</p>
      <div class="rp-place rb">${esc(R.kota)}, ${esc(tglPanjang(x.tanggal))}</div>
      <div class="rp-sign2 rp-ttd ba-3 rb">${sig("Dibuat oleh", T.prep, x.pembuat, "Admin")}${sig("Saksi", null, x.saksi, "Saksi")}${sig("Diketahui oleh", T.appr, R.apprBy, "Owner")}</div>`;
  }
  const baName = x => `Berita Acara Pemusnahan ${x.nama} ${shortCab(x.lokasi)} ${x.tanggal}.pdf`.replace(/[\\/:*?"<>|]/g, "-");
  function baPreview(x){ S.baCur = x.id; S.baDoc = x; $("baPaper").innerHTML = baHtml(x); $("baSign").hidden = !(isAppOwner() && !x.ttd?.appr); sheetOpen("baSheet"); }
  function renderMusnah(){
    if (S.pSub !== "aset" || document.body.classList.contains("staff") || !$("msList")) return;
    const L = [...S.musnah].sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || "") || (b.at || "").localeCompare(a.at || ""));
    $("msHint").textContent = L.length ? L.length + " berita acara · " + fmt(sumOf(L, x => x.qty)) + " unit" : "";
    $("msList").innerHTML = L.length ? `<thead><tr><th>Tanggal</th><th>Nomor</th><th>Aset</th><th>Lokasi</th><th class="r">Unit</th><th>Tanda tangan</th><th></th></tr></thead><tbody>` +
      L.map(x => `<tr><td class="num">${esc(fmtDate(x.tanggal))}</td><td class="num">${esc(x.nomor || "")}</td><td><b>${esc(x.nama)}</b><small>${esc(x.alasan || "")}</small></td><td>${esc(shortCab(x.lokasi))}</td><td class="r num">${fmt(x.qty)}</td>
        <td>${x.ttd?.prep ? `<span class="pill ok">Dibuat ✓</span>` : `<span class="pill">Dibuat –</span>`} ${x.ttd?.appr ? `<span class="pill ok">Diketahui ✓</span>` : `<span class="pill">Diketahui –</span>`}</td>
        <td class="r"><button class="btn" type="button" data-baopen="${esc(x.id)}">Berita acara</button></td></tr>`).join("") + `</tbody>` : `<tr><td class="empty">Belum ada pemusnahan aset.</td></tr>`;
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-baopen]"); if (!b) return; const x = S.musnah.find(m => m.id === b.dataset.baopen); if (x) baPreview(x); });
  $("baPdf").addEventListener("click", async () => { const x = S.baDoc; if (!x) return; if (!S.dl) { toast("Download tidak tersedia"); return; } const b = $("baPdf"); b.disabled = true;
    try { await S.dl.save({ filename: baName(x), data: await elToPdf($("baPaper"), "Lash Bounty ERP · " + (x.nomor || "Berita acara pemusnahan")) }); toast("PDF disimpan"); }
    catch (err) { if (err?.code !== "declined") toast("Gagal membuat PDF"); } finally { b.disabled = false; } });
  $("baSend").addEventListener("click", () => { const x = S.baDoc; if (!x) return;
    const text = `*Berita Acara Pemusnahan Aset*\nNomor: ${x.nomor}\nTanggal: ${fullDate(x.tanggal)}\nAset: ${x.nama} · ${fmt(x.qty)} unit · ${shortCab(x.lokasi)}\nAlasan: ${x.alasan}\nCara: ${x.cara}`;
    openSend({ title: "Kirim berita acara", sub: x.nomor, kind: "ba", text, tab: "email", attachName: baName(x), emailTo: S.users.filter(u => u.role === "owner" && u.email).map(u => u.email),
      vars: { tanggal: fullDate(x.tanggal), aset: `${x.nama} (${fmt(x.qty)} unit, ${shortCab(x.lokasi)})` }, attach: async () => [{ filename: baName(x), blob: await htmlToPdf(baHtml(x), "Lash Bounty ERP · " + x.nomor) }] }); });
  $("baSign").addEventListener("click", async () => { const x = S.baDoc, u = me(); if (!x || !u) return; if (!u.ttd) { toast("Simpan tanda tangan dulu di Pengaturan → Akun saya"); return; }
    const ttd = { ...(x.ttd || {}), appr: { uid: u.id, nama: u.nama, img: u.ttd, at: new Date().toISOString() } };
    try { await S.db.doc("pemusnahan/" + x.id).update({ ttd }); S.baDoc = { ...x, ttd }; $("baPaper").innerHTML = baHtml(S.baDoc); $("baSign").hidden = true; toast("Berita acara ditandatangani"); }
    catch (err) { toast(err?.message || "Gagal"); } });

  /* ---------- v1.1 · Banking → Tabungan Sewa (Tebet & Bekasi, dicatat sebagai biaya sewa bulanan cabang) ---------- */
  S.tbg = []; S.tbgLoaded = false;
  const TB_KET = "Biaya sewa tempat (ditabung)";
  const tbCabs = () => { const c = S.bkCfg?.tabungan?.cabang; if (c && typeof c === "object" && Object.keys(c).length) return Object.keys(c).filter(x => cabList().includes(x));
    const w = cabsOfGrup(bhCfg().grup); return w.length ? w : cabList().filter(x => /tebet|bekasi/i.test(x)); };
  const tbAmt = c => { const v = S.bkCfg?.tabungan?.cabang?.[c]; return v > 0 ? v : 10000000; };
  const tbRek = () => S.bkCfg?.tabungan?.rek || "Rekening pribadi Kevin";
  const tbSaldo = c => sumOf(S.tbg.filter(x => x.cabang === c), x => x.tipe === "tarik" ? -x.jumlah : x.jumlah);
  const tbOf = (c, mk) => S.tbg.filter(x => x.cabang === c && x.tipe === "setor" && x.periode === mk);
  function renderTabungan(){
    if (S.leaf !== "bank/tabungan") return;
    const cabs = tbCabs(), mk = S.month, k12 = []; let k = mk; for (let i = 0; i < 12; i++) { k12.unshift(k); k = prevKey(k); }
    $("tsKpis").innerHTML = [...cabs.map(c => [shortCab(c), rpShort(tbSaldo(c)), tbOf(c, mk).length ? "✓ " + mName(mk) + " sudah disetor" : "Belum setor " + mName(mk), !tbOf(c, mk).length]),
      ["Total tabungan sewa", rpShort(sumOf(cabs, tbSaldo)), "di " + tbRek(), false]]
      .map(([l, v, s, warn]) => `<div class="kpi"><span class="l">${esc(l)}</span><span class="v num">${v}</span><span class="s ${warn ? "dn-r" : ""}">${esc(s)}</span></div>`).join("");
    $("tsQuick").innerHTML = cabs.map(c => { const done = tbOf(c, mk).length; return `<div class="ts-q"><div><b>${esc(shortCab(c))}</b><small>${esc(mName(mk))} · ${rp(tbAmt(c))}</small></div>${done ? `<span class="pill ok">Sudah disetor</span>` : `<button class="btn primary" type="button" data-tsq="${esc(c)}">Catat setoran ${esc(mName(mk))}</button>`}</div>`; }).join("") || `<span class="note">Belum ada cabang tujuan. Atur di bawah.</span>`;
    // matriks 12 bulan
    $("tsMatrix").innerHTML = `<thead><tr><th>Cabang</th>${k12.map(m => `<th class="c">${esc(mName(m).slice(0, 3) + " " + m.slice(2, 4))}</th>`).join("")}<th class="r">Saldo</th></tr></thead><tbody>` +
      cabs.map(c => `<tr><td><b>${esc(shortCab(c))}</b></td>${k12.map(m => { const v = sumOf(tbOf(c, m), x => x.jumlah), t = sumOf(S.tbg.filter(x => x.cabang === c && x.tipe === "tarik" && x.periode === m), x => x.jumlah);
        return `<td class="q">${v ? `<b>${rpShort(v).replace("Rp ", "")}</b>` : `<span class="na">–</span>`}${t ? `<small class="dn-r">−${rpShort(t).replace("Rp ", "")}</small>` : ""}</td>`; }).join("")}<td class="r num"><b>${fmt(tbSaldo(c))}</b></td></tr>`).join("") + `</tbody>`;
    // riwayat
    const L = [...S.tbg].sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || "") || (b.at || "").localeCompare(a.at || ""));
    $("tsList").innerHTML = !S.tbgLoaded ? `<tr><td class="empty">Memuat…</td></tr>` : L.length ? `<thead><tr><th>Tanggal</th><th>Cabang</th><th>Jenis</th><th>Keterangan</th><th class="r">Jumlah</th><th></th></tr></thead><tbody>` +
      L.map(x => `<tr><td class="num">${esc(fmtDate(x.tanggal))}<small>periode ${esc(mName(x.periode || perOf(x.tanggal)))}</small></td><td>${esc(shortCab(x.cabang))}</td><td>${x.tipe === "tarik" ? `<span class="pill warn">Penarikan</span>` : `<span class="pill ok">Setoran</span>`}</td>
        <td class="k">${esc(x.keterangan || "")}<small>${esc(x.tipe === "tarik" ? "dari " : "ke ") + esc(x.rek || "")}${x.biayaId ? " · dicatat biaya sewa cabang" : ""}</small></td><td class="r num ${x.tipe === "tarik" ? "dn-r" : ""}">${x.tipe === "tarik" ? "−" : ""}${fmt(x.jumlah)}</td>
        <td class="r"><button class="btn ghost danger" type="button" data-tsdel="${esc(x.id)}">Hapus</button></td></tr>`).join("") + `</tbody>` : `<tr><td class="empty">Belum ada setoran tabungan sewa.</td></tr>`;
    // form
    fillSelect($("tsCab"), cabs.length ? cabs : cabList(), $("tsCab").value); if (!$("tsTgl").value) $("tsTgl").value = inPer(todayISO(), mk) ? todayISO() : perEnd(mk);
    if (!$("tsJml").value) $("tsJml").value = fmt(tbAmt($("tsCab").value));
    $("tsRek").placeholder = tbRek();
    if (!$("tsCfg").contains(document.activeElement)) $("tsCfg").innerHTML = cabList().map(c => `<label class="ts-cfg"><input type="checkbox" data-tscab="${esc(c)}" ${cabs.includes(c) ? "checked" : ""}> <span>${esc(shortCab(c))}</span><input type="text" inputmode="numeric" data-tsamt="${esc(c)}" value="${fmt(tbAmt(c))}" aria-label="Setoran per bulan ${esc(shortCab(c))}"></label>`).join("");
    if (!$("tsCfgRek").value) $("tsCfgRek").value = tbRek();
  }
  ["tsJml"].forEach(id => $(id).addEventListener("input", e => { const n = parseRp(e.target.value); e.target.value = n ? fmt(n) : ""; }));
  $("tsCfg").addEventListener("input", e => { if (e.target.dataset.tsamt != null) { const n = parseRp(e.target.value); e.target.value = n ? fmt(n) : ""; } });
  $("tsCab").addEventListener("change", () => { $("tsJml").value = fmt(tbAmt($("tsCab").value)); });
  $("tsTipe").addEventListener("change", () => { $("tsBiayaNote").hidden = $("tsTipe").value !== "setor"; });
  async function tbSave({ tipe, cabang, tanggal, jumlah, rek, ket }){
    if (!validISO(tanggal)) throw new Error("Isi tanggal."); if (!(jumlah > 0)) throw new Error("Isi jumlah."); if (!cabang) throw new Error("Pilih cabang.");
    const periode = perOf(tanggal), at = new Date().toISOString(), by = actorName();
    if (tipe === "tarik" && jumlah > tbSaldo(cabang)) throw new Error("Penarikan melebihi saldo tabungan " + shortCab(cabang) + " (" + rp(tbSaldo(cabang)) + ").");
    let biayaId = null;
    if (tipe === "setor") { const lk = lockOf(tanggal); if (lk) throw new Error(lk);
      const ref = await S.db.collection("pusat").add({ unit: cabang, kategori: "Sewa / mortgage", tanggal, bulan: tanggal.slice(0, 7), jumlah, keterangan: TB_KET, nota: "", dana: "Tabungan sewa → " + (rek || tbRek()), pengisi: by, tabungan: true, by: S.uid || null, at, contoh: false }); biayaId = ref.id; }
    const ref2 = await S.db.collection("tabungan").add({ tipe, cabang, tanggal, periode, jumlah, rek: rek || tbRek(), keterangan: ket || (tipe === "setor" ? TB_KET + " " + mName(periode) : "Pembayaran sewa tahunan"), biayaId, pengisi: by, by: S.uid || null, at });
    if (biayaId) await S.db.doc("pusat/" + biayaId).update({ tabunganId: ref2.id }).catch(() => {});
  }
  document.addEventListener("click", async e => { const b = e.target.closest("[data-tsq]"); if (!b) return; const c = b.dataset.tsq, mk = S.month; b.disabled = true;
    try { await tbSave({ tipe: "setor", cabang: c, tanggal: inPer(todayISO(), mk) ? todayISO() : perEnd(mk), jumlah: tbAmt(c) }); toast("Setoran " + shortCab(c) + " " + mName(mk) + " tercatat"); }
    catch (err) { toast(err?.message || "Gagal"); b.disabled = false; } });
  $("tsForm").addEventListener("submit", async e => { e.preventDefault(); const msg = $("tsMsg");
    try { await tbSave({ tipe: $("tsTipe").value, cabang: $("tsCab").value, tanggal: $("tsTgl").value, jumlah: parseRp($("tsJml").value), rek: $("tsRek").value.trim(), ket: $("tsKet").value.trim() });
      $("tsKet").value = ""; $("tsJml").value = ""; msg.textContent = ""; toast("Tersimpan"); }
    catch (err) { msg.textContent = err?.message || "Gagal menyimpan."; } });
  $("tsList").addEventListener("click", async e => { const b = e.target.closest("[data-tsdel]"); if (!b) return; const x = S.tbg.find(t => t.id === b.dataset.tsdel); if (!x) return;
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = x.biayaId ? "Hapus + biaya sewa?" : "Yakin?"; setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.textContent = "Hapus"; } }, 3500); return; }
    if (x.biayaId) { const lk = lockOf(x.tanggal); if (lk) { toast(lk); return; } }
    try { if (x.biayaId) await S.db.doc("pusat/" + x.biayaId).delete().catch(() => {}); await S.db.doc("tabungan/" + x.id).delete(); toast("Dihapus"); } catch (err) { toast(err?.message || "Gagal menghapus"); } });
  $("tsCfgSave").addEventListener("click", async () => { const cab = {}; $("tsCfg").querySelectorAll("[data-tscab]").forEach(c => { if (c.checked) cab[c.dataset.tscab] = parseRp($("tsCfg").querySelector(`[data-tsamt="${CSS.escape(c.dataset.tscab)}"]`).value) || 10000000; });
    const doc = { tabungan: { cabang: cab, rek: $("tsCfgRek").value.trim() || "Rekening pribadi Kevin" } };
    try { if (S.bkCfg) await S.db.doc("bankcfg/main").update(doc); else await S.db.doc("bankcfg/main").set(doc); $("tsCfgMsg").textContent = ""; toast("Pengaturan tabungan tersimpan"); }
    catch (err) { $("tsCfgMsg").textContent = err?.message || "Gagal menyimpan."; } });

  /* ---------- v1.1 · logo perusahaan (bisa diganti dari Pengaturan → Integrasi & logo) ---------- */
  S.brand = null;
  function logoSrc(){ return S.brand?.logo || "img/logo.svg"; }
  function logoHtml(){ return `<div class="rp-logo rb"><img src="${esc(logoSrc())}" alt="Lash Bounty"></div>`; }
  function applyBrand(){ document.querySelectorAll("img.brand-logo").forEach(i => { if (i.getAttribute("src") !== logoSrc()) i.src = logoSrc(); }); }
  $("brLogoFile").addEventListener("change", async e => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const msg = $("brMsg");
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(f.type)) { msg.textContent = "Pakai file PNG, JPG, WEBP, atau SVG."; return; }
    let url;
    if (f.type === "image/svg+xml") { if (f.size > 150000) { msg.textContent = "SVG terlalu besar (maks 150 KB)."; return; } const t = await f.text(); if (/<script|on\w+=/i.test(t)) { msg.textContent = "SVG berisi script, tidak bisa dipakai."; return; } url = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(t))); }
    else { const bmp = await createImageBitmap(f).catch(() => null); if (!bmp) { msg.textContent = "Gambar tidak terbaca."; return; }
      const sc = Math.min(1, 480 / bmp.width, 480 / bmp.height), c = document.createElement("canvas"); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc); c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); url = c.toDataURL("image/png"); }
    try { await S.db.doc("settings/brand").set({ ...(S.brand || {}), logo: url, logoAt: new Date().toISOString(), logoBy: actorName() }); msg.textContent = ""; toast("Logo diganti"); }
    catch (err) { msg.textContent = err?.message || "Gagal menyimpan logo."; } });
  $("brLogoReset").addEventListener("click", async () => { try { await S.db.doc("settings/brand").set({ ...(S.brand || {}), logo: "" }); toast("Logo kembali ke bawaan"); } catch (err) { toast(err?.message || "Gagal"); } });

  /* ---------- v1.1 · Dashboard mobile (preview iOS / Android + pasang di HP) ---------- */
  const mbDev = () => ls.get("lb-mbdev") || "ios";
  function renderMobile(){
    if (S.leaf !== "dash/mobile") return; if (!adminGate("mbBody", "mbRO")) return;
    const dev = mbDev(); document.querySelectorAll("#mbDev [data-mbdev]").forEach(b => b.setAttribute("aria-pressed", b.dataset.mbdev === dev)); $("mbFrame").dataset.dev = dev;
    const D = dashData(), k = D.k, t = todayISO(), I = incomeStmt(cabList(), k), today = sumOf(D.ms.filter(s => s.tanggal === t), s => s.total);
    const exTot = sumOf(D.ex, l => l.jumlah), maxC = Math.max(1, ...cabList().map(D.omCab));
    const alerts = [];
    const telat = (S.minta || []).filter(mtLate).length; if (telat) alerts.push(["no", telat + " permintaan barang terlambat", "inv/minta"]);
    const rf = (S.refund || []).filter(r => r.status === "diajukan").length; if (rf) alerts.push(["warn", rf + " refund menunggu owner", "acc/refund"]);
    try { const ab = abUnread(); if (ab) alerts.push(["warn", ab + " Ask Boss belum dibaca", "ask/boss"]); } catch {}
    try { const bo = bankOpen(); if (bo) alerts.push(["warn", bo + " temuan crosscheck bank", "bank/cocok"]); } catch {}
    const ts = typeof tbCabs === "function" && S.bkCfgLoaded ? tbCabs().filter(c => !tbOf(c, S.month).length) : []; if (ts.length && S.tbgLoaded) alerts.push(["warn", "Tabungan sewa belum disetor: " + ts.map(shortCab).join(", "), "bank/tabungan"]);
    const st = stageOf(S.month); if (st < 3 && +t.slice(8, 10) >= 27) alerts.push(["warn", "Tutup buku " + mName(S.month) + " belum final", "acc/tutup/cek"]);
    $("mbScreen").innerHTML = `<div class="mb-top"><img class="brand-logo" src="${esc(logoSrc())}" alt=""><div><b>Lash Bounty</b><small>${esc(perName(k))}</small></div><span class="mb-ava">${esc((me()?.nama || "LB").slice(0, 2).toUpperCase())}</span></div>
      <div class="mb-hero"><small>Omzet periode</small><b class="num">${rp(D.omzet)}</b><span>Hari ini ${rpShort(today)} · ${esc(perRange(k))}</span></div>
      <div class="mb-kpis"><div><small>Pengeluaran cabang</small><b class="num">${rpShort(exTot)}</b></div><div><small>Laba cabang sementara</small><b class="num ${I.net < 0 ? "dn-r" : ""}">${rpShort(I.net)}</b></div></div>
      <div class="mb-card"><div class="mb-h">Omzet per cabang</div>${cabList().map((c) => `<div class="mb-bar"><span>${esc(shortCab(c))}</span><i><em style="width:${(D.omCab(c) / maxC * 100).toFixed(1)}%;background:${grupCol(grupOf(c))}"></em></i><b class="num">${rpShort(D.omCab(c))}</b></div>`).join("") || `<span class="note">Belum ada cabang.</span>`}</div>
      <div class="mb-card"><div class="mb-h">Perlu perhatian</div>${alerts.length ? alerts.map(([ty, l, g]) => `<button type="button" class="mb-al" data-goleaf="${g}"><span class="pill ${ty}">${ty === "no" ? "Penting" : "Cek"}</span>${esc(l)}<i>›</i></button>`).join("") : `<span class="note">Semua aman ✓</span>`}</div>
      <div class="mb-nav">${[["dash/ringkasan", "Dashboard"], ["acc/omzet/report", "Omzet"], ["acc/tutup/cek", "Tutup buku"], ["ask/ai", "Ask Me!"]].map(([g, l]) => `<button type="button" data-goleaf="${g}">${l}</button>`).join("")}</div>`;
    const url = ARTIFACT_URL; $("mbUrl").textContent = url; $("mbQr").innerHTML = qrBtn(url, "Buka Lash Bounty ERP di HP");
    $("mbHttps").hidden = /^https:|^http:\/\/(localhost|127\.)/.test(location.href);
  }
  $("mbDev").addEventListener("click", e => { const b = e.target.closest("[data-mbdev]"); if (!b) return; ls.set("lb-mbdev", b.dataset.mbdev); renderMobile(); });
  // service worker kecil supaya bisa dipasang sebagai aplikasi (PWA) di Android; data tetap selalu dari server
  if (false && (location.protocol === "https:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) navigator.serviceWorker.register("sw.js").catch(() => {});

  /* ---------- v1.1 · Pengaturan → Integrasi (Telegram, email, Google Sheet, backup) ---------- */
  S.integ = null; S.integAt = 0; S.notifyCfg = null;
  async function loadInteg(force){ if (!S.admin || (!force && Date.now() - S.integAt < 20000)) return; S.integAt = Date.now();
    try { S.integ = await srv("integrations"); } catch (err) { S.integ = { error: err.message }; } renderInteg(); }
  const NT_EV = [["bigExpense", "Pengeluaran besar (ke owner)"], ["askBoss", "Ask Boss baru & balasan"], ["permintaan", "Permintaan barang"], ["refund", "Refund"], ["closing", "Tutup buku final"], ["reminder", "Pengingat harian jam " + "09:00"]];
  function renderInteg(){
    if (S.leaf !== "set/integrasi") return; if (!adminGate("igBody", "igRO")) return; if (!S.integ) { loadInteg(); $("igCards").innerHTML = `<div class="empty">Memuat…</div>`; return; }
    const I = S.integ, ok = b => b ? `<span class="pill ok">Aktif</span>` : `<span class="pill">Belum diatur</span>`;
    if (I.error) { $("igCards").innerHTML = `<div class="empty">${esc(I.error)}</div>`; return; }
    $("igCards").innerHTML = [
      ["Telegram", ok(I.telegram?.configured), I.telegram?.configured ? (I.telegram.bot ? "Bot @" + I.telegram.bot : "Bot aktif") : "Isi TELEGRAM_BOT_TOKEN di file .env", I.telegram?.error],
      ["Email (SMTP)", ok(I.email?.configured), I.email?.configured ? "Pengirim: " + (I.email.from || "") : "Isi SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM di .env", ""],
      ["Google Sheet", ok(I.sheets?.configured), I.sheets?.configured ? (I.sheets.lastSync ? "Sinkron terakhir " + new Date(I.sheets.lastSync).toLocaleString("id-ID") : "Belum pernah sinkron") + " · tiap " + I.sheets.intervalMin + " menit" : "Isi GOOGLE_SHEET_ID & kunci service account di .env", I.sheets?.error],
      ["AI (Claude)", ok(I.ai?.configured), I.ai?.configured ? "Model " + I.ai.model : "Isi ANTHROPIC_API_KEY di .env", ""],
      ["Backup otomatis", `<span class="pill ok">Jam ${String(I.backupHour).padStart(2, "0")}:00</span>`, (I.backups?.[0] ? "Terakhir: " + I.backups[0].replace(/\.json$/, "") : "Belum ada backup") + " · zona " + I.tz, ""]
    ].map(([t, p, s, er]) => `<div class="ig-card"><div class="ig-h"><b>${t}</b>${p}</div><span class="note">${esc(s)}</span>${er ? `<small class="dn-r">${esc(er)}</small>` : ""}</div>`).join("");
    $("igSheetEmail").textContent = I.sheets?.email ? `Bagikan Google Sheet ke ${I.sheets.email} sebagai Editor.` : "";
    $("igSheetOpen").hidden = !I.sheets?.sheetId; if (I.sheets?.sheetId) $("igSheetOpen").href = "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(I.sheets.sheetId);
    $("igBackups").innerHTML = (I.backups || []).length ? I.backups.map(f => `<li class="num">${esc(f)}</li>`).join("") : `<li class="note">Belum ada.</li>`;
    $("igLog").innerHTML = (I.log || []).length ? `<thead><tr><th>Waktu</th><th>Kejadian</th><th>Judul</th><th>Terkirim</th></tr></thead><tbody>` + I.log.map(x => `<tr><td class="num">${esc(new Date(x.at).toLocaleString("id-ID"))}</td><td>${esc(x.event)}</td><td class="k">${esc(x.subject)}</td><td>${x.tg ? "Telegram " + x.tg : ""}${x.tg && x.email ? " · " : ""}${x.email ? "Email " + x.email : ""}${!x.tg && !x.email ? `<span class="note">–</span>` : ""}${x.errors?.length ? `<small class="dn-r">${esc(x.errors.join("; "))}</small>` : ""}</td></tr>`).join("") + `</tbody>` : `<tr><td class="empty">Belum ada notifikasi terkirim sejak server jalan.</td></tr>`;
    // chat telegram yang pernah menyapa bot
    const tg = [...(S.tgchats || [])].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
    $("igTg").innerHTML = tg.length ? `<thead><tr><th>Chat ID</th><th>Nama Telegram</th><th>Terakhir</th><th>Dipakai oleh</th><th></th></tr></thead><tbody>` + tg.map(c => { const u = S.users.find(x => String(x.tgChat) === String(c.id)), k = kyList().find(x => String(x.tgChat) === String(c.id));
      return `<tr><td class="num">${esc(c.id)}</td><td>${esc(c.nama || c.username || "")}${c.username ? `<small>@${esc(c.username)}</small>` : ""}</td><td class="num">${esc(c.at ? new Date(c.at).toLocaleString("id-ID") : "")}</td><td>${u ? "Akun " + esc(u.nama) : k ? "Karyawan " + esc(k.nama) : `<span class="note">belum dihubungkan</span>`}</td>
        <td class="r"><select data-tglink="${esc(c.id)}" aria-label="Hubungkan ke akun"><option value="">Hubungkan ke akun…</option>${S.users.map(x => `<option value="${esc(x.id)}">${esc(x.nama)} (${esc(roleLabel(x.role))})</option>`).join("")}</select></td></tr>`; }).join("") + `</tbody>`
      : `<tr><td class="empty">${I.telegram?.configured ? "Belum ada yang menyapa bot. Minta owner/admin buka Telegram, cari @" + esc(I.telegram.bot || "bot") + ", lalu kirim /start." : "Telegram belum diaktifkan."}</td></tr>`;
    // pilihan notifikasi
    const N = S.notifyCfg || {}, ev = N.events || {};
    $("igEv").innerHTML = NT_EV.map(([k2, l]) => `<label class="chk"><input type="checkbox" data-ntev="${k2}" ${ev[k2] === false ? "" : "checked"}> ${esc(l.replace("09:00", String(I.reminderHour).padStart(2, "0") + ":00"))}</label>`).join("");
    $("igTgOff").checked = N.telegramOff === true; $("igMailOff").checked = N.emailOff === true;
    if (document.activeElement?.id !== "igExtra") $("igExtra").value = [...(N.owner?.email || []), ...(N.owner?.tg || [])].join(", ");
    $("igMe").textContent = me()?.email || me()?.tgChat ? "Tes dikirim ke: " + [me()?.tgChat ? "Telegram " + me().tgChat : "", me()?.email || ""].filter(Boolean).join(" · ") : "Isi email / chat Telegram di akun kamu dulu (Akun login → Edit).";
    $("igBrandImg").src = logoSrc();
  }
  document.addEventListener("change", async e => { const s = e.target.closest("[data-tglink]"); if (!s || !s.value) return;
    try { await S.db.doc("users/" + s.value).update({ tgChat: s.dataset.tglink }); toast("Telegram dihubungkan ke akun"); } catch (err) { toast(err?.message || "Gagal"); } });
  $("igRefresh").addEventListener("click", () => loadInteg(true));
  document.addEventListener("click", async e => { const b = e.target.closest("[data-igtest]"); if (!b) return; const ch = b.dataset.igtest, u = me(); b.disabled = true; $("igMsg").textContent = "Memproses…";
    try { const to = ch === "telegram" ? u?.tgChat : ch === "email" ? u?.email : ""; if ((ch === "telegram" || ch === "email") && !to) throw new Error(ch === "email" ? "Akun kamu belum punya email." : "Akun kamu belum terhubung ke Telegram.");
      const r = ch === "sheets" ? await srv("sheets/sync", {}) : await srv("integrations/test", { channel: ch, to });
      $("igMsg").textContent = ch === "backup" ? "Backup dibuat: " + (r.file || "-") : ch === "reminder" ? r.count + " pengingat dikirim" : ch === "sheets" ? (r.skipped ? "Sinkron sedang berjalan, coba sebentar lagi." : "Sinkron selesai: " + (r.tabs || 0) + " tab diperbarui") : "Terkirim ✓";
      loadInteg(true); }
    catch (err) { $("igMsg").textContent = err?.message || "Gagal."; } finally { b.disabled = false; } });
  $("igSave").addEventListener("click", async () => { const ev = {}; $("igEv").querySelectorAll("[data-ntev]").forEach(c => ev[c.dataset.ntev] = c.checked);
    const ex = $("igExtra").value.split(/[,;\s]+/).filter(Boolean), em = ex.filter(x => /@/.test(x)), tg = ex.filter(x => /^-?\d{5,}$/.test(x));
    const doc = { ...(S.notifyCfg || {}), events: ev, telegramOff: $("igTgOff").checked, emailOff: $("igMailOff").checked, owner: { email: em, tg } };
    try { await S.db.doc("settings/notify").set(doc); $("igSaveMsg").textContent = ""; toast("Pengaturan notifikasi tersimpan"); } catch (err) { $("igSaveMsg").textContent = err?.message || "Gagal menyimpan."; } });

  /* ---------- v1.1 · piutang kasbon di halaman Aset ---------- */
  function renderAsKasbon(){ if (S.pSub !== "aset" || !$("asKasbon") || document.body.classList.contains("staff")) return; const L = kbAll().filter(x => x.saldo > 0).sort((a, b) => b.saldo - a.saldo);
    $("asKasbonHint").textContent = "Total " + rp(piutangKasbon()); $("asKasbon").innerHTML = L.length ? `<thead><tr><th>Karyawan</th><th>Cabang</th><th class="r">Kasbon</th><th class="r">Sudah kembali</th><th class="r">Sisa piutang</th></tr></thead><tbody>` +
      L.map(x => `<tr><td><b>${esc(x.nama)}</b></td><td>${esc(shortCab(x.cabang || "Pusat"))}</td><td class="r num">${fmt(x.pinjam)}</td><td class="r num">${fmt(x.bayar)}</td><td class="r num"><b>${fmt(x.saldo)}</b></td></tr>`).join("") + `<tr class="total"><td colspan="4">Total piutang kasbon karyawan</td><td class="r num">${fmt(piutangKasbon())}</td></tr></tbody>`
      : `<tr><td class="empty">Tidak ada kasbon berjalan.</td></tr>`; }

  /* ---------- v1.1 · render & data tambahan ---------- */
  function renderV11(){ applyBrand(); { const tl = (S.tgchats || []).map(c => `<option value="${esc(c.id)}">${esc(c.nama || c.username || "")}</option>`).join(""); if ($("tgList").dataset.v !== tl) { $("tgList").innerHTML = tl; $("tgList").dataset.v = tl; } } renderAkun(); renderKasbon(); renderUmum(); renderAiImp(); renderRefund(); renderTbEdit(); renderRiwayat(); renderRpTtd(); renderMinta(); renderGrafik(); renderMusnah(); renderAsKasbon(); renderTabungan(); renderMobile(); renderInteg(); }
  function bootV11(db){
    db.doc("settings/brand").onSnapshot(s => { S.brand = s.exists ? s.data() : null; applyBrand(); renderV11(); }, () => {});
    db.doc("settings/emailtpl").onSnapshot(s => { S.mailTpl = s.exists ? s.data() : null; }, () => {});
    if (SA.level >= 1) db.collection("permintaan").limit(1000).onSnapshot(sn => { S.minta = sn.docs.map(d => ({ id: d.id, ...d.data() })); S.mintaLoaded = true; renderV11(); renderNav(); }, () => { S.mintaLoaded = true; renderV11(); });
    if (S.admin) {
      const live = (c, set) => db.collection(c).limit(2000).onSnapshot(sn => { set(sn.docs.map(d => ({ id: d.id, ...d.data() }))); renderV11(); renderNav(); }, () => { set(null); renderV11(); });
      live("refund", L => { S.refund = L || []; S.refundLoaded = true; });
      live("kasbon", L => { S.kasbon = L || []; S.kasbonLoaded = true; });
      live("pemusnahan", L => { S.musnah = L || []; S.musnahLoaded = true; });
      live("pengumuman", L => { S.umum = L || []; S.umumLoaded = true; });
      live("tgchats", L => { S.tgchats = L || []; });
      db.collection("payroll").limit(500).onSnapshot(sn => { S.prAll = {}; sn.docs.forEach(d => S.prAll[d.id] = d.data()); renderV11(); }, () => {});
      db.doc("settings/notify").onSnapshot(s => { S.notifyCfg = s.exists ? s.data() : null; renderInteg(); }, () => {});
    }
    if (["owner", "head"].includes(SA.user?.role)) db.collection("tabungan").limit(2000).onSnapshot(sn => { S.tbg = sn.docs.map(d => ({ id: d.id, ...d.data() })); S.tbgLoaded = true; renderV11(); }, () => { S.tbgLoaded = true; renderV11(); });
  }

  // slip gaji → kirim (WA / email / salin)
  $("slipSend").addEventListener("click", () => { if (!S.slip) return; const C = S.slip, D = slipData(C), k = kyRec(C.r.id) || {};
    openSend({ title: "Kirim slip gaji", sub: (C.r.nama || "") + " · " + perName(C.k), kind: "slip", text: slipText(), waTo: C.r.wa || k.hp || "", emailTo: k.email ? [k.email] : [],
      vars: { nama: C.r.nama || "", periode: mName(C.k), isi: slipText().replace(/\*/g, "") } }); void D; });

  renderAll();

  /* ---------- boot capabilities ---------- */
  (async () => {
    const C = window.claude; if (!C?.use) { S.booted=true; renderAll(); return; }
    const [db, user, sample, dl] = await Promise.all(["db","user","sample","downloads"].map(n=>C.use(n).catch(()=>null)));
    S.db = db ? wrapDb(db) : null; S.user=user; S.sample=sample; S.dl=dl;
    if (dl) { $("loCsv").hidden=false; $("csvBtn").hidden=false; $("stCsvBtn").hidden=false; $("jmCsv").hidden=false; $("prCsv").hidden=false; $("dCsv").hidden=false; ["asCsv","abCsv","tbCsv","cmpCsv"].forEach(id => $(id).hidden = false); }
    if (!sample) { $("aiBtn").hidden=true; $("aiHint").textContent="Ringkasan AI tidak tersedia di tampilan ini."; }
    else { try { const lim = await sample.limits(); if (lim?.images) { S.scanAvail=true; $("scanBox").hidden=$("fNoStruk").checked; $("scanFile").accept = lim.images.mediaTypes.join(","); $("opScan").hidden=false; $("opPhoto").accept = lim.images.mediaTypes.join(","); ["pcScanBox","bcScanBox"].forEach(id => $(id).hidden = false); ["pcScan","bcScan"].forEach(id => $(id).accept = lim.images.mediaTypes.join(",")); } } catch {} }
    if (user) { try { S.uid = await user.id(); S.admin = await user.canEdit(); S.isOwner = await user.isOwner(); S.me = await user.me(); } catch {} }
    $("who").textContent = S.admin ? "Accounting · Persediaan · HRD" : "Accounting · Persediaan · HRD";
    S.booted=true;
    if (!db) { renderAll(); return; }
    db.doc("settings/main").onSnapshot(s => { S.cfg = s.exists ? s.data() : null; S.cfgLoaded=true; renderAll(); }, () => { S.cfgLoaded=true; renderAll(); });
    db.doc("settings/roles").onSnapshot(s => { S.roles = s.exists ? s.data() : null; renderAll(); renderLogin(); }, () => {});
    db.collection("users").limit(500).onSnapshot(sn => { S.users = sn.docs.map(d => ({ id:d.id, ...d.data() })); S.usersLoaded = true;
      const had = !!S.appUser; restoreSession(); if (had && !S.appUser) toast("Sesi berakhir. Silakan login lagi."); renderLogin(); renderAll(); }, () => { S.usersLoaded = true; renderLogin(); });
    if (S.admin) db.collection("pwreq").limit(200).onSnapshot(sn => { S.pwreq = sn.docs.map(d => ({ id:d.id, ...d.data() })).sort((a, b) => (b.at || "").localeCompare(a.at || "")); renderUsers(); renderNav(); }, () => {});
    if (S.admin) { const L2 = { log: [], logadm: [] }, mergeLog = () => { S.logs = [...L2.log, ...L2.logadm].sort((a, b) => (b.at || "").localeCompare(a.at || "")).slice(0, 400); S.logLoaded = true; renderLog(); };
      ["log","logadm"].forEach(c => db.collection(c).orderBy("at", "desc").limit(300).onSnapshot(sn => { L2[c] = sn.docs.map(d => ({ id:d.id, ...d.data() })); mergeLog(); }, () => mergeLog())); }
    db.doc("settings/hr").onSnapshot(s => { S.hr = s.exists ? s.data() : null; renderAll(); }, () => {});
    db.doc("settings/karyawan").onSnapshot(s => { S.ky = s.exists ? s.data() : null; S.kyLoaded = true; renderAll(); }, () => { S.kyLoaded = true; renderAll(); });
    db.collection("closing").limit(500).onSnapshot(sn => { S.closing = {}; sn.docs.forEach(d => S.closing[d.id] = d.data()); renderAll(); }, () => {});
    if (S.admin) { db.doc("bankcfg/main").onSnapshot(s => { S.bkCfg = s.exists ? s.data() : null; S.bkCfgLoaded = true; renderAll(); }, () => { S.bkCfgLoaded = true; });
      db.collection("bankflag").limit(1000).onSnapshot(sn => { S.bkFlags = {}; sn.docs.forEach(d => S.bkFlags[d.id] = d.data()); renderAll(); }, () => {});
      db.collection("cust").limit(200).onSnapshot(sn => { S.cust = {}; sn.docs.forEach(d => S.cust[d.id] = d.data()); S.custLoaded = true; renderAll(); }, () => { S.custLoaded = true; renderAll(); });
      db.collection("askboss").limit(500).onSnapshot(sn => { S.abAll = sn.docs.map(d => ({ id: d.id, ...d.data() })); S.abAllLoaded = true; renderAll(); }, () => { S.abAllLoaded = true; renderAll(); }); }
    if (S.uid) db.doc("askboss/" + S.uid).onSnapshot(s => { S.abDoc = s.exists ? s.data() : null; renderAll(); }, () => {});
    if (S.admin) db.collection("aset").limit(1000).onSnapshot(sn => { S.aset = sn.docs.map(d => ({ id:d.id, ...d.data() })); S.asetLoaded = true; renderAll(); }, () => { S.asetLoaded = true; renderAll(); });
    db.doc("settings/stok").onSnapshot(s => { S.stok = s.exists ? s.data() : null; S.stokLoaded=true; renderAll(); }, () => { S.stokLoaded=true; renderAll(); });
    db.collection("opname").limit(1000).onSnapshot(snap => { S.opn = snap.docs.map(d => ({ id:d.id, ...d.data() })); S.opnLoaded=true; renderAll(); }, () => { S.opnLoaded=true; renderAll(); });
    subscribeSales();
    subscribeRows();
    subscribePusat();
    subscribeHr();
    bootV11(db);
    if (!document.body.classList.contains("staff")) go(S.tabFromUser ? S.leaf : (perm("dash") ? "dash/ringkasan" : "acc/jurnal/input"));
    renderLogin();
  })();
})();
