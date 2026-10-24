"use strict";
// Export seluruh data ke satu file JSON. Pakai: npm run backup [-- nama-file.json]
const fs = require("fs");
const path = require("path");
const config = require("../server/config");
const { Store } = require("../server/store");

const store = new Store(config.dataDir, { backupKeep: config.backupKeep });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const out = path.resolve(process.argv[2] || path.join(config.dataDir, "backups", `manual-${stamp}.json`));
fs.mkdirSync(path.dirname(out), { recursive: true });
const snap = store.snapshot();
fs.writeFileSync(out, JSON.stringify({ app: "lash-bounty-erp", version: config.version, at: new Date().toISOString(), collections: snap }, null, 1));
console.log(`Backup tersimpan: ${out}`);
console.log(Object.entries(snap).map(([c, d]) => `  ${c}: ${Object.keys(d).length} dokumen`).join("\n") || "  (data kosong)");
