// Gera src/lib/types/database.ts por introspecao do Postgres.
// Substitui `supabase gen types`, que exige Docker local.
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true })
const { Client } = require('pg')

const TS = {
  uuid: 'string', text: 'string', citext: 'string', varchar: 'string', bpchar: 'string',
  name: 'string', date: 'string', timestamptz: 'string', timestamp: 'string',
  time: 'string', timetz: 'string', interval: 'string', inet: 'string',
  numeric: 'number', int2: 'number', int4: 'number', int8: 'number',
  float4: 'number', float8: 'number', money: 'number',
  bool: 'boolean', json: 'Json', jsonb: 'Json', bytea: 'string',
}

const tsType = (udt, isEnum) =>
  isEnum ? `Database['public']['Enums']['${udt}']` : (TS[udt] || 'unknown')

;(async () => {
  const c = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  const { rows: enums } = await c.query(`
    select t.typname as name, array_agg(e.enumlabel::text order by e.enumsortorder) as labels
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    group by t.typname order by t.typname`)

  const enumNames = new Set(enums.map((e) => e.name))

  const { rows: cols } = await c.query(`
    select c.relname as table_name,
           c.relkind  as kind,
           a.attname  as column_name,
           t.typname  as udt,
           not a.attnotnull as is_nullable,
           (a.atthasdef or a.attidentity <> '') as has_default
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    join pg_type t on t.oid = a.atttypid
    where n.nspname = 'public' and c.relkind in ('r','v')
    order by c.relname, a.attnum`)

  // Chaves estrangeiras: sem elas o supabase-js nao consegue tipar embeds
  // como .select('*, crops(name)').
  const { rows: fks } = await c.query(`
    select
      con.conname                                   as fk_name,
      src.relname                                   as table_name,
      tgt.relname                                   as referenced_table,
      array_agg(sa.attname::text order by u.ord)    as columns,
      array_agg(ta.attname::text order by u.ord)    as referenced_columns,
      exists (
        select 1 from pg_constraint uq
        where uq.conrelid = con.conrelid
          and uq.contype in ('p','u')
          and uq.conkey @> con.conkey
          and con.conkey @> uq.conkey
      )                                             as is_one_to_one
    from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_class tgt on tgt.oid = con.confrelid
    join pg_namespace n on n.oid = src.relnamespace
    cross join lateral unnest(con.conkey, con.confkey) with ordinality as u(src_att, tgt_att, ord)
    join pg_attribute sa on sa.attrelid = con.conrelid and sa.attnum = u.src_att
    join pg_attribute ta on ta.attrelid = con.confrelid and ta.attnum = u.tgt_att
    where con.contype = 'f' and n.nspname = 'public'
    group by con.conname, src.relname, tgt.relname, con.conrelid, con.conkey
    order by src.relname, con.conname`)

  await c.end()

  const fkByTable = new Map()
  for (const f of fks) {
    if (!fkByTable.has(f.table_name)) fkByTable.set(f.table_name, [])
    fkByTable.get(f.table_name).push(f)
  }

  const renderRelationships = (table) => {
    const list = fkByTable.get(table) ?? []
    if (list.length === 0) return '        Relationships: []'
    const body = list
      .map(
        (f) =>
          `          {\n` +
          `            foreignKeyName: '${f.fk_name}'\n` +
          `            columns: [${f.columns.map((x) => `'${x}'`).join(', ')}]\n` +
          `            isOneToOne: ${f.is_one_to_one}\n` +
          `            referencedRelation: '${f.referenced_table}'\n` +
          `            referencedColumns: [${f.referenced_columns.map((x) => `'${x}'`).join(', ')}]\n` +
          `          }`,
      )
      .join(',\n')
    return `        Relationships: [\n${body}\n        ]`
  }

  const grouped = new Map()
  for (const r of cols) {
    if (!grouped.has(r.table_name)) grouped.set(r.table_name, { kind: r.kind, cols: [] })
    grouped.get(r.table_name).cols.push(r)
  }

  const tables = []
  const views = []

  for (const [name, { kind, cols: list }] of [...grouped].sort()) {
    const row = list
      .map((r) => {
        const t = tsType(r.udt, enumNames.has(r.udt))
        // Colunas de view sao sempre tratadas como possivelmente nulas:
        // agregacoes e LEFT JOIN nao carregam o NOT NULL da tabela base.
        const nullable = kind === 'v' ? true : r.is_nullable
        return `          ${r.column_name}: ${t}${nullable ? ' | null' : ''}`
      })
      .join('\n')

    if (kind === 'v') {
      views.push(`      ${name}: {\n        Row: {\n${row}\n        }\n${renderRelationships(name)}\n      }`)
      continue
    }

    const insert = list
      .map((r) => {
        const t = tsType(r.udt, enumNames.has(r.udt))
        const optional = r.is_nullable || r.has_default
        return `          ${r.column_name}${optional ? '?' : ''}: ${t}${r.is_nullable ? ' | null' : ''}`
      })
      .join('\n')

    const update = list
      .map((r) => {
        const t = tsType(r.udt, enumNames.has(r.udt))
        return `          ${r.column_name}?: ${t}${r.is_nullable ? ' | null' : ''}`
      })
      .join('\n')

    tables.push(
      `      ${name}: {\n        Row: {\n${row}\n        }\n        Insert: {\n${insert}\n        }\n        Update: {\n${update}\n        }\n${renderRelationships(name)}\n      }`,
    )
  }

  const enumBlock = enums.length
    ? enums.map((e) => `      ${e.name}: ${e.labels.map((l) => `'${l}'`).join(' | ')}`).join('\n')
    : '      [_ in never]: never'

  const out = `// GERADO AUTOMATICAMENTE por tools/gen-types.js — nao editar a mao.
// Regerar apos cada migracao:  node tools/gen-types.js

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
${tables.join('\n')}
    }
    Views: {
${views.join('\n')}
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
${enumBlock}
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])> =
  (PublicSchema['Tables'] & PublicSchema['Views'])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T] extends { Update: infer U } ? U : never

export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]
`

  const dest = path.join(__dirname, '..', 'src', 'lib', 'types', 'database.ts')
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, out)
  console.log(`OK  ${tables.length} tabelas, ${views.length} views, ${enums.length} enums`)
})().catch((e) => {
  console.error('FALHA:', e.message)
  process.exit(1)
})
