// Uso: node tools/db.js "SQL"   (le SUPABASE_DB_URL do ../.env)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(process.argv[2]);
  console.log(JSON.stringify(Array.isArray(r) ? r.map(x => x.rows) : r.rows, null, 2));
  await c.end();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
