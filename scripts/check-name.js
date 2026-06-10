const Database = require('better-sqlite3');
const db = new Database('data/store.db');
const row = db.prepare("SELECT value FROM settings WHERE key = 'storeName'").get();
console.log('Raw value:', JSON.stringify(row));
console.log('Literal:', row.value);
console.log('Char codes:', [...row.value].map(c => c.charCodeAt(0)));
