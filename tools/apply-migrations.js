// Aplica os arquivos .sql de supabase/migrations em ordem, dentro de uma transacao por arquivo.
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { Client } = require('pg');

const dir = path.join(__dirname, '..', 'supabase', 'migrations');
const only = process.argv[2];

(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
    .filter(f => !only || f.includes(only));
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    try {
      await c.query('begin');
      await c.query(sql);
      await c.query('commit');
      console.log('OK  ' + f);
    } catch (e) {
      await c.query('rollback');
      console.error('ERRO ' + f + '\n  ' + e.message + (e.position ? '\n  pos: ' + e.position : ''));
      await c.end();
      process.exit(1);
    }
  }
  // O PostgREST guarda tipos e colunas em cache; sem recarregar, uma migracao
  // que move um tipo (ex.: citext para "extensions") quebra os inserts da API.
  await c.query("notify pgrst, 'reload schema'");
  await c.end();
})().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
