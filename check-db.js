const Database = require("better-sqlite3");
const db = new Database("data/store.db");
const row = db.prepare("SELECT COUNT(*) as count FROM products").get();
console.log("Products:", row.count);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log("Tables:", tables.map((t) => t.name).join(", "));
db.close();
