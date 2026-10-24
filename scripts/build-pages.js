"use strict";
// GitHub Pages menyajikan index root; aplikasi server tetap memakai public/index.html.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
let bridge = read("public/js/lb-standalone.js");
const originalCall = "  async function call(pathname, body, opts = {}) {";
const originalStream = "  function connectStream() {";
if (!bridge.includes(originalCall) || !bridge.includes(originalStream)) throw new Error("Bridge berubah; periksa build pratinjau.");
const callEnd = bridge.indexOf("\n  const SA =", bridge.indexOf(originalCall));
const streamStart = bridge.indexOf(originalStream);
const streamEnd = bridge.indexOf("\n  function docSnap", streamStart);
if (callEnd < 0 || streamEnd < 0) throw new Error("Batas bridge pratinjau tidak ditemukan.");
bridge = bridge.slice(0, streamStart) + originalStream + `
    if (!es) es = window.LB_DEMO.onChange(m => { for (const s of subs) if (s.c === m.c) s.kick(); });
  }
` + bridge.slice(streamEnd);
bridge = bridge.slice(0, bridge.indexOf(originalCall)) + originalCall + `
    if (opts.signal?.aborted) throw err("cancelled", "Dibatalkan");
    return window.LB_DEMO.call(pathname, body === undefined ? undefined : JSON.parse(JSON.stringify(body)), { token, device: deviceId });
  }
` + bridge.slice(callEnd);
// Sesi demo tidak berbagi token dengan instalasi server di origin yang sama.
bridge = bridge.replaceAll('"lb-token"', '"lb-preview-token"');
fs.writeFileSync(path.join(root, "preview/lb-preview.js"), bridge);
let html = read("public/index.html");
html = html.replace("<head>", '<head>\n<base href="./public/">\n<meta name="robots" content="noindex">');
html = html.replace("<title>Lash Bounty ERP</title>", "<title>Lash Bounty ERP · Pratinjau</title>");
html = html.replace("</head>", '<link rel="stylesheet" href="../preview/demo.css">\n</head>');
html = html.replace('<script src="js/lb-standalone.js"></script>', '<script src="../preview/demo-backend.js"></script>\n<script src="../preview/lb-preview.js"></script>');
html = html.replace('<script src="js/app.js"></script>', '<script src="js/app.js"></script>\n<script src="../preview/demo-ui.js"></script>');
fs.writeFileSync(path.join(root, "index.html"), html);
fs.writeFileSync(path.join(root, ".nojekyll"), "");
console.log("Pratinjau Pages siap: index.html + public/ + preview/. Tidak memakai API server.");
