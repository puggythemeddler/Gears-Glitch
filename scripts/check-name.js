const Database = require('better-sqlite3');
try {
  const db = new Database('data/store.db');
  const row = db.prepare("SELECT value FROM settings WHERE key = 'storeName'").get();
  if (!row) {
    console.log('storeName setting not found');
  } else {
    console.log('Raw value:', JSON.stringify(row));
    console.log('Literal:', row.value);
    console.log('Char codes:', [...row.value].map(c => c.charCodeAt(0)));
  }
  db.close();
} catch (err) {
  console.error('Error:', err.message);
}
