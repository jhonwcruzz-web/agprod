/**
 * Popula uma propriedade com um ano de dados ficticios para demonstracao:
 * safras 2026.1 e 2026.2, 10 talhoes de uva e manga, operacoes de campo,
 * estoque, colheitas, vendas, contas e maquinas (via seed-machines.js).
 *
 * Uso: node tools/seed-demo.js <farm_id> [--reset]
 *
 * Grava com a service_role, mas pelas mesmas tabelas que o app usa: os
 * triggers de baixa de estoque, custo por talhao, receita e auditoria rodam
 * normalmente, entao os numeros fecham do mesmo jeito que num uso real.
 * --reset apaga os lancamentos da propriedade e os talhoes criados aqui
 * (mantem a propriedade e os talhoes cadastrados pelo usuario).
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true })
const { createClient } = require('@supabase/supabase-js')
const { seedMachines, resetMachines } = require('./seed-machines')

const FARM = process.argv[2]
const RESET = process.argv.includes('--reset')
if (!FARM) {
  console.error('Uso: node tools/seed-demo.js <farm_id> [--reset]')
  process.exit(1)
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const TODAY = '2026-09-22'
const S2_FROM = '2026-05-01' // lancamentos gerais antes disso contam na 2026.1

// ------------------------------------------------------------ utilitarios
let seed = 20260922
function rnd() {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const vary = (v, pct) => v * (1 + (rnd() * 2 - 1) * pct)
const r2 = (v) => Math.round(v * 100) / 100
const r1 = (v) => Math.round(v * 10) / 10
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

async function must(promise, label) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}
async function insertAll(table, rows, label = table) {
  for (let i = 0; i < rows.length; i += 200) {
    await must(db.from(table).insert(rows.slice(i, i + 200)), label)
  }
  console.log(`  ${String(rows.length).padStart(4)}  ${label}`)
}

// ------------------------------------------------------------ catalogo
const PRODUCTS = {
  // defensivos (dose por ha)
  cianamida: { name: 'Cianamida hidrogenada', category: 'defensivo', unit: 'L', cost: 38, ai: 'Cianamida hidrogenada 52%' },
  ga3: { name: 'Ácido giberélico 10%', category: 'defensivo', unit: 'g', cost: 5.8, ai: 'Ácido giberélico' },
  mancozebe: { name: 'Mancozebe 800 WP', category: 'defensivo', unit: 'kg', cost: 42, ai: 'Mancozebe' },
  tebuconazol: { name: 'Tebuconazol 200 EC', category: 'defensivo', unit: 'L', cost: 96, ai: 'Tebuconazol' },
  azoxi: { name: 'Azoxistrobina + Difenoconazol', category: 'defensivo', unit: 'L', cost: 265, ai: 'Azoxistrobina + Difenoconazol' },
  abamectina: { name: 'Abamectina 18 EC', category: 'defensivo', unit: 'L', cost: 112, ai: 'Abamectina' },
  enxofre: { name: 'Enxofre molhável 80%', category: 'defensivo', unit: 'kg', cost: 14.5, ai: 'Enxofre' },
  fosfito: { name: 'Fosfito de potássio', category: 'defensivo', unit: 'L', cost: 32, ai: 'Fosfito de potássio' },
  espinetoram: { name: 'Espinetoram 250 WG', category: 'defensivo', unit: 'kg', cost: 890, ai: 'Espinetoram' },
  pbz: { name: 'Paclobutrazol 25%', category: 'defensivo', unit: 'L', cost: 185, ai: 'Paclobutrazol' },
  // fertilizantes
  map: { name: 'MAP purificado', category: 'fertilizante', unit: 'kg', cost: 7.6 },
  nitcalcio: { name: 'Nitrato de cálcio', category: 'fertilizante', unit: 'kg', cost: 4.3 },
  sulfk: { name: 'Sulfato de potássio', category: 'fertilizante', unit: 'kg', cost: 6.9 },
  ureia: { name: 'Ureia', category: 'fertilizante', unit: 'kg', cost: 3.9 },
  sulfmg: { name: 'Sulfato de magnésio', category: 'fertilizante', unit: 'kg', cost: 2.8 },
  nitk: { name: 'Nitrato de potássio', category: 'fertilizante', unit: 'kg', cost: 7.3 },
  composto: { name: 'Composto orgânico (esterco curtido)', category: 'fertilizante', unit: 't', cost: 290 },
}

const SUPPLIER = {
  defensivo: 'Defensa Agro Distribuidora',
  fertilizante: 'Nutri Solo Fertilizantes',
}

const BUYERS = {
  valefruit: { name: 'Vale Fruit Export Ltda', location: 'Petrolina/PE', phone: '(87) 3861-4400', notes: 'Exportadora — uva sem semente para Europa e Reino Unido', factor: 1.0, terms: 45, method: 'Transferência' },
  sertao: { name: 'Frutas Sertão Exportadora', location: 'Juazeiro/BA', phone: '(74) 3611-2090', notes: 'Compra uva e manga para exportação', factor: 0.97, terms: 30, method: 'Boleto' },
  ceasa: { name: 'Ceasa Recife — Box 27 (Seu Antônio)', location: 'Recife/PE', phone: '(81) 9 9731-5520', notes: 'Mercado interno, compra em caixa de 8 kg', factor: 0.84, terms: 7, method: 'Pix' },
  atacadao: { name: 'Atacadão das Frutas Juazeiro', location: 'Juazeiro/BA', phone: '(74) 9 8812-3307', notes: 'Atacado regional', factor: 0.8, terms: 15, method: 'Prazo' },
  mandacaru: { name: 'Rede Supermercados Mandacaru', location: 'Salvador/BA', phone: '(71) 3322-8100', notes: 'Rede varejista, pagamento em 28 dias', factor: 0.9, terms: 28, method: 'Boleto' },
}

// Talhoes novos (os ja' cadastrados pelo usuario sao mantidos).
const NEW_PLOTS = [
  { code: 'P2A', variety: 'Arra 15', rootstock: 'Paulsen 1103', crop: 'uva', area: 4.5, planting: '2019-08-15', rs: 3.5, ps: 2.0 },
  { code: 'P2B', variety: 'Sugraone', rootstock: 'Harmony', crop: 'uva', area: 4.0, planting: '2017-06-10', rs: 3.5, ps: 2.0 },
  { code: 'P3A', variety: 'BRS Vitória', rootstock: 'IAC 766 (Campinas)', crop: 'uva', area: 5.0, planting: '2021-03-20', rs: 3.5, ps: 2.0 },
  { code: 'P3B', variety: 'Crimson Seedless', rootstock: 'IAC 572 (Jales)', crop: 'uva', area: 3.8, planting: '2018-09-05', rs: 3.5, ps: 2.0 },
  { code: 'P4A', variety: 'Sweet Globe', rootstock: 'Paulsen 1103', crop: 'uva', area: 4.2, planting: '2022-04-12', rs: 3.5, ps: 2.0 },
  { code: 'M1', variety: 'Palmer', rootstock: 'Espada', crop: 'manga', area: 7.0, planting: '2015-02-10', rs: 8, ps: 5 },
  { code: 'M2', variety: 'Tommy Atkins', rootstock: 'Espada', crop: 'manga', area: 6.5, planting: '2012-05-18', rs: 8, ps: 5 },
  { code: 'M3', variety: 'Keitt', rootstock: 'Espada', crop: 'manga', area: 5.0, planting: '2016-11-02', rs: 8, ps: 5 },
]
const SEEDED_CODES = NEW_PLOTS.map((p) => p.code)

// Ciclos de uva: poda -> colheita. yield em kg/ha, price em R$/kg.
const GRAPE_CYCLES = {
  P1A: [
    { season: 's1', prune: '2025-12-10', harvest: '2026-04-08', yield: 19000, price: 7.4 },
    { season: 's2', prune: '2026-06-15', harvest: '2026-10-12', yield: 22000, price: 8.2 },
  ],
  P1B: [
    { season: 's1', formation: true, from: '2025-12-01', to: '2026-04-30' },
    { season: 's2', prune: '2026-05-05', harvest: '2026-09-01', yield: 8000, price: 8.0, young: true },
  ],
  P2A: [
    { season: 's1', prune: '2025-11-20', harvest: '2026-03-16', yield: 26000, price: 8.4 },
    { season: 's2', prune: '2026-04-25', harvest: '2026-08-20', yield: 27500, price: 9.1 },
  ],
  P2B: [
    { season: 's1', prune: '2026-01-10', harvest: '2026-05-06', yield: 11000, price: 4.3, problem: true },
    { season: 's2', prune: '2026-05-20', harvest: '2026-09-10', yield: 19000, price: 7.6 },
  ],
  P3A: [
    { season: 's1', prune: '2025-12-01', harvest: '2026-03-26', yield: 30000, price: 5.4 },
    { season: 's2', prune: '2026-05-10', harvest: '2026-08-28', yield: 31000, price: 5.9 },
  ],
  P3B: [
    { season: 's1', prune: '2026-01-20', harvest: '2026-05-28', yield: 22000, price: 7.7 },
    { season: 's2', prune: '2026-07-05', harvest: '2026-11-10', yield: 23000, price: 8.3 },
  ],
  P4A: [
    { season: 's1', prune: '2025-12-20', harvest: '2026-04-22', yield: 25000, price: 9.4 },
    { season: 's2', prune: '2026-06-01', harvest: '2026-09-26', yield: 26000, price: 10.2 },
  ],
}

// Manga: eventos explicitos por safra.
const MANGO_CYCLES = {
  M1: {
    price: 2.6,
    s1: {
      ferts: ['2025-10-05', '2025-10-25', '2025-11-12'], foliarK: ['2025-11-20', '2025-11-30', '2025-12-10'],
      sprays: ['2025-12-20', '2026-01-05', '2026-01-20'], harvest: '2026-02-10', days: 6, yield: 28000,
    },
    s2: {
      pruning: '2026-03-25', ferts: ['2026-04-08', '2026-04-28', '2026-05-18'], pbz: '2026-06-05',
      foliarK: ['2026-08-28', '2026-09-08', '2026-09-18'], sprays: ['2026-09-12', '2026-09-24', '2026-10-06'],
    },
  },
  M2: {
    price: 1.9,
    s1: { pruning: '2025-10-20', ferts: ['2025-11-10', '2025-12-05', '2026-01-08', '2026-02-10'], sprays: ['2026-01-15', '2026-02-20'] },
    s2: {
      pbz: '2026-03-05', ferts: ['2026-04-02', '2026-05-04'], foliarK: ['2026-05-20', '2026-05-30', '2026-06-10'],
      sprays: ['2026-06-20', '2026-07-05', '2026-07-20', '2026-08-05'], harvest: '2026-08-12', days: 7, yield: 32000,
    },
  },
  M3: {
    price: 2.3,
    s1: {
      foliarK: ['2025-10-01', '2025-10-11'], sprays: ['2025-11-10', '2025-11-28', '2025-12-15'],
      harvest: '2026-01-10', days: 6, yield: 25000, pruning: '2026-02-20', ferts: ['2026-03-10', '2026-04-05'],
    },
    s2: { ferts: ['2026-05-15', '2026-06-20'], pbz: '2026-07-10', sprays: ['2026-09-10', '2026-09-23'] },
  },
}

// ------------------------------------------------------------ reset
async function reset() {
  console.log('Limpando lancamentos anteriores...')
  // Maquinas antes das despesas: o cascade apaga o diario e o trigger
  // apaga as despesas que o diario gerou — nada fica orfao.
  await resetMachines(db, FARM)
  for (const t of ['sales', 'production_records', 'applications', 'fertilizations', 'irrigation_records', 'expenses', 'inventory_movements', 'products', 'buyers', 'activities']) {
    await must(db.from(t).delete().eq('farm_id', FARM), `reset ${t}`)
  }
  await must(db.from('plots').delete().eq('farm_id', FARM).in('code', SEEDED_CODES), 'reset plots')
  await must(db.from('seasons').delete().eq('farm_id', FARM).eq('name', '2026.2'), 'reset season')
}

// ------------------------------------------------------------ main
;(async () => {
  const farm = await must(db.from('farms').select('id, name, created_by').eq('id', FARM).single(), 'farm')
  const USER = farm.created_by

  if (RESET) await reset()
  const { count } = await db.from('production_records').select('id', { count: 'exact', head: true }).eq('farm_id', FARM)
  if (count > 0) {
    console.error('A propriedade ja tem colheitas lancadas. Use --reset para recriar os dados.')
    process.exit(1)
  }

  console.log(`Populando "${farm.name}"...`)

  // ---------- catalogo global
  const crops = await must(db.from('crops').select('id, slug'), 'crops')
  const cropId = Object.fromEntries(crops.map((c) => [c.slug, c.id]))
  const varieties = await must(db.from('varieties').select('id, name, crop_id').is('farm_id', null), 'varieties')
  const rootstocks = await must(db.from('rootstocks').select('id, name, crop_id').is('farm_id', null), 'rootstocks')
  const varietyId = (crop, name) => varieties.find((v) => v.crop_id === cropId[crop] && v.name === name).id
  const rootstockId = (crop, name) => rootstocks.find((v) => v.crop_id === cropId[crop] && v.name === name).id

  // ---------- safras
  const seasons = await must(db.from('seasons').select('*').eq('farm_id', FARM), 'seasons')
  let s1 = seasons.find((s) => s.name === '2026.1')
  const s1Patch = { start_date: '2025-10-01', end_date: '2026-06-30', is_active: true, notes: 'Safra do primeiro semestre' }
  if (s1) await must(db.from('seasons').update(s1Patch).eq('id', s1.id), 'season 1')
  else s1 = await must(db.from('seasons').insert({ farm_id: FARM, name: '2026.1', ...s1Patch }).select().single(), 'season 1')
  let s2 = seasons.find((s) => s.name === '2026.2')
  const s2Patch = { start_date: '2026-04-15', end_date: '2026-12-31', is_active: true, notes: 'Safra do segundo semestre — em andamento' }
  if (s2) await must(db.from('seasons').update(s2Patch).eq('id', s2.id), 'season 2')
  else s2 = await must(db.from('seasons').insert({ farm_id: FARM, name: '2026.2', ...s2Patch }).select().single(), 'season 2')
  const SEASON = { s1: s1.id, s2: s2.id }
  const seasonByDate = (d) => (d < S2_FROM ? s1.id : s2.id)

  // ---------- talhoes
  await insertAll(
    'plots',
    NEW_PLOTS.map((p) => ({
      farm_id: FARM,
      code: p.code,
      area: p.area,
      area_unit: 'ha',
      crop_id: cropId[p.crop],
      variety_id: varietyId(p.crop, p.variety),
      rootstock_id: rootstockId(p.crop, p.rootstock),
      planting_date: p.planting,
      plant_count: Math.round((p.area * 10000) / (p.rs * p.ps)),
      row_spacing: p.rs,
      plant_spacing: p.ps,
      irrigation_system: p.crop === 'uva' ? 'Gotejamento' : 'Microaspersão',
      training_system: p.crop === 'uva' ? 'Latada' : 'Copa aberta',
      status: 'producao',
    })),
    'talhoes',
  )
  const plots = await must(db.from('plots').select('id, code, area, crop_id, variety_id').eq('farm_id', FARM), 'plots')
  const plot = Object.fromEntries(plots.map((p) => [p.code, { ...p, area: Number(p.area) }]))
  for (const code of [...Object.keys(GRAPE_CYCLES), ...Object.keys(MANGO_CYCLES)]) {
    if (!plot[code]) throw new Error(`Talhao ${code} nao encontrado na propriedade`)
  }

  // ---------- ciclos (talhao x safra)
  const cycleRows = []
  for (const [code, cycles] of Object.entries(GRAPE_CYCLES)) {
    for (const c of cycles) {
      const start = c.formation ? c.from : c.prune
      const end = c.formation ? c.to : addDays(c.harvest, 18)
      cycleRows.push({ code, season: c.season, start_date: start, end_date: end <= TODAY ? end : null, status: end <= TODAY ? 'concluido' : 'em_andamento', notes: c.formation ? 'Formação — sem colheita' : c.problem ? 'Míldio e rachadura de bagas na pré-colheita' : null })
    }
  }
  for (const code of Object.keys(MANGO_CYCLES)) {
    cycleRows.push({ code, season: 's1', start_date: '2025-10-01', end_date: '2026-04-30', status: 'concluido', notes: null })
    cycleRows.push({ code, season: 's2', start_date: '2026-03-01', end_date: null, status: 'em_andamento', notes: null })
  }
  await must(
    db.from('crop_cycles').upsert(
      cycleRows.map((c) => ({
        farm_id: FARM,
        plot_id: plot[c.code].id,
        season_id: SEASON[c.season],
        crop_id: plot[c.code].crop_id,
        variety_id: plot[c.code].variety_id,
        start_date: c.start_date,
        end_date: c.end_date,
        status: c.status,
        notes: c.notes,
      })),
      { onConflict: 'plot_id,season_id' },
    ),
    'crop_cycles',
  )
  console.log(`  ${String(cycleRows.length).padStart(4)}  ciclos`)
  const cycles = await must(db.from('crop_cycles').select('id, plot_id, season_id').eq('farm_id', FARM), 'cycles')
  const cycleId = (plotId, seasonId) => cycles.find((c) => c.plot_id === plotId && c.season_id === seasonId)?.id ?? null

  // ---------- geracao das operacoes em memoria
  const apps = []
  const ferts = []
  const labor = [] // despesas diretas
  const harvests = []

  function spray(code, season, date, key, dosePerHa, doseUnit, extra = {}) {
    const p = plot[code]
    const prod = PRODUCTS[key]
    const qty = r1(dosePerHa * p.area)
    const scheduled = date > TODAY
    if (scheduled && daysBetween(TODAY, date) > 14) return // programacao so' das proximas duas semanas
    apps.push({
      key,
      farm_id: FARM,
      plot_id: p.id,
      season_id: SEASON[season],
      crop_id: p.crop_id,
      product_name: prod.name,
      active_ingredient: prod.ai ?? null,
      dose: dosePerHa,
      dose_unit: doseUnit,
      area: p.area,
      total_quantity: qty,
      spray_volume: r1(p.area * (key === 'pbz' ? 400 : 800)),
      equipment: key === 'pbz' ? 'Aplicação no solo (colo da planta)' : pick(['Turbo atomizador 2000 L', 'Turbo atomizador 2000 L', 'Pulverizador costal motorizado']),
      responsible: pick(['Cícero', 'Damião', 'Cícero']),
      cost: r2(qty * prod.cost),
      status: scheduled ? 'programada' : 'realizada',
      scheduled_date: scheduled ? date : null,
      application_date: scheduled ? null : date,
      notes: extra.notes ?? null,
      created_by: USER,
    })
  }

  function fert(code, season, date, key, dosePerHa, type, method) {
    if (date > TODAY) return
    const p = plot[code]
    const prod = PRODUCTS[key]
    const qty = r1(dosePerHa * p.area)
    ferts.push({
      key,
      farm_id: FARM,
      plot_id: p.id,
      season_id: SEASON[season],
      product_name: prod.name,
      fert_type: type,
      quantity: qty,
      unit: prod.unit,
      dose_per_ha: dosePerHa,
      area: p.area,
      cost: r2(qty * prod.cost),
      application_method: method,
      responsible: pick(['Damião', 'Rosângela']),
      fertilization_date: date,
      created_by: USER,
    })
  }

  function laborCost(code, season, date, category, description, amount, supplier = 'Diaristas da comunidade') {
    if (date > TODAY) return
    labor.push({
      farm_id: FARM,
      plot_id: code ? plot[code].id : null,
      season_id: season ? SEASON[season] : seasonByDate(date),
      category,
      description,
      amount: r2(amount),
      expense_date: date,
      status: 'pago',
      paid_amount: r2(amount),
      paid_date: date,
      supplier,
      is_production_cost: true,
      created_by: USER,
    })
  }

  const GRAPE_SPRAYS = [
    ['mancozebe', 3, 'kg/ha'], ['enxofre', 4, 'kg/ha'], ['tebuconazol', 1, 'L/ha'], ['abamectina', 0.8, 'L/ha'],
    ['azoxi', 0.5, 'L/ha'], ['fosfito', 3, 'L/ha'], ['espinetoram', 0.2, 'kg/ha'], ['mancozebe', 3, 'kg/ha'],
    ['tebuconazol', 1, 'L/ha'], ['fosfito', 3, 'L/ha'], ['azoxi', 0.5, 'L/ha'],
  ]
  const GRAPE_FERTS = [
    ['map', 25], ['nitcalcio', 40], ['sulfk', 35], ['ureia', 20], ['sulfmg', 25], ['nitk', 30],
  ]

  for (const [code, list] of Object.entries(GRAPE_CYCLES)) {
    const area = plot[code].area
    for (const c of list) {
      const s = c.season
      if (c.formation) {
        // talhao jovem: conducao, adubacao leve e protecao sanitaria
        let i = 0
        for (let d = c.from; d <= c.to; d = addDays(d, 14), i++) {
          const [k, dose] = GRAPE_FERTS[i % GRAPE_FERTS.length]
          fert(code, s, d, k, dose * 0.5, 'Fertirrigação', 'Gotejamento')
          if (i % 2 === 0) {
            const [sk, sd, su] = GRAPE_SPRAYS[i % GRAPE_SPRAYS.length]
            spray(code, s, addDays(d, 3), sk, sd * 0.6, su)
          }
          if (i % 3 === 0) laborCost(code, s, addDays(d, 5), 'mao_de_obra', 'Condução e desbrota (formação)', vary(900 * area, 0.1))
        }
        continue
      }

      const d0 = c.prune
      if (s === 's1') fert(code, s, addDays(d0, -8), 'composto', 10, 'Orgânico', 'Distribuição na linha')
      laborCost(code, s, d0, 'mao_de_obra', 'Poda de produção', vary(3500 * area, 0.06))
      spray(code, s, addDays(d0, 1), 'cianamida', 20, 'L/ha', { notes: 'Quebra de dormência' })
      laborCost(code, s, addDays(d0, 22), 'mao_de_obra', 'Desbrota e desfolha', vary(3000 * area, 0.08))
      spray(code, s, addDays(d0, 30), 'ga3', 60, 'g/ha', { notes: 'Alongamento do cacho' })
      spray(code, s, addDays(d0, 42), 'ga3', 60, 'g/ha', { notes: 'Crescimento de baga' })
      laborCost(code, s, addDays(d0, 50), 'mao_de_obra', 'Raleio de cachos e bagas', vary((c.young ? 9000 : 14000) * area, 0.07))
      laborCost(code, s, addDays(d0, 66), 'mao_de_obra', 'Amarrio e condução dos cachos', vary(5000 * area, 0.08))

      // fitossanitarias a cada ~10 dias; no talhao problema, a cada 6 dias no pico do mildio
      let i = 0
      for (let d = addDays(d0, 12); d <= addDays(c.harvest, -12); i++) {
        const [k, dose, unit] = GRAPE_SPRAYS[i % GRAPE_SPRAYS.length]
        spray(code, s, d, k, dose, unit, c.problem && i >= 4 && i <= 8 ? { notes: 'Reforço — foco de míldio' } : {})
        d = addDays(d, c.problem && i >= 4 && i <= 8 ? 6 : 9 + Math.floor(rnd() * 3))
      }
      // fertirrigacao semanal
      i = 0
      for (let d = addDays(d0, 5); d <= addDays(c.harvest, -10); d = addDays(d, 8), i++) {
        const [k, dose] = GRAPE_FERTS[i % GRAPE_FERTS.length]
        fert(code, s, d, k, c.young ? dose * 0.7 : dose, 'Fertirrigação', 'Gotejamento')
      }
      if (c.problem) laborCost(code, s, addDays(c.harvest, -6), 'mao_de_obra', 'Limpeza de cachos (bagas rachadas)', vary(4800 * area, 0.05))

      // colheita em 5 passadas
      const total = vary(c.yield * area, 0.05)
      const split = [0.14, 0.24, 0.26, 0.21, 0.15]
      split.forEach((share, k) => {
        const date = addDays(c.harvest, k * 4 + Math.floor(rnd() * 2))
        if (date >= TODAY) return
        harvests.push({ code, season: s, date, kg: Math.round(total * share), price: c.price, crop: 'uva', problem: c.problem })
      })
    }
  }

  const MANGO_SPRAYS = [['mancozebe', 3, 'kg/ha'], ['azoxi', 0.5, 'L/ha'], ['tebuconazol', 1, 'L/ha'], ['fosfito', 3, 'L/ha'], ['abamectina', 0.8, 'L/ha']]
  const MANGO_FERTS = [['ureia', 60], ['sulfk', 70], ['map', 40], ['sulfmg', 40]]
  for (const [code, m] of Object.entries(MANGO_CYCLES)) {
    const area = plot[code].area
    for (const s of ['s1', 's2']) {
      const c = m[s]
      if (c.pruning) {
        laborCost(code, s, c.pruning, 'mao_de_obra', 'Poda pós-colheita', vary(1800 * area, 0.08))
        fert(code, s, addDays(c.pruning, 10), 'composto', 12, 'Orgânico', 'Coroamento')
      }
      ;(c.ferts ?? []).forEach((d, i) => {
        const [k, dose] = MANGO_FERTS[i % MANGO_FERTS.length]
        fert(code, s, d, k, dose, 'Fertirrigação', 'Microaspersão')
      })
      if (c.pbz) {
        spray(code, s, c.pbz, 'pbz', 4, 'L/ha', { notes: 'Indução floral' })
        laborCost(code, s, c.pbz, 'mao_de_obra', 'Aplicação de paclobutrazol', vary(450 * area, 0.1))
      }
      ;(c.foliarK ?? []).forEach((d) => fert(code, s, d, 'nitk', 40, 'Foliar', 'Pulverização — quebra de dormência'))
      ;(c.sprays ?? []).forEach((d, i) => {
        const [k, dose, unit] = MANGO_SPRAYS[i % MANGO_SPRAYS.length]
        spray(code, s, d, k, dose, unit)
      })
      if (c.harvest) {
        const total = vary(c.yield * area, 0.05)
        for (let k = 0; k < c.days; k++) {
          const date = addDays(c.harvest, k * 5)
          if (date >= TODAY) continue
          const share = k === 0 || k === c.days - 1 ? 0.6 / c.days : (1 + 0.8 / (c.days - 2)) / c.days
          harvests.push({ code, season: s, date, kg: Math.round(total * share), price: m.price, crop: 'manga' })
        }
      }
    }
  }

  // ---------- colheita, custos de colheita e vendas
  const production = []
  const sales = []
  const sold = { overduePartial: false }
  const grapeBuyers = ['valefruit', 'valefruit', 'valefruit', 'sertao', 'sertao', 'ceasa', 'atacadao']
  const mangoBuyers = ['sertao', 'sertao', 'atacadao', 'mandacaru']
  for (const h of harvests.sort((a, b) => a.date.localeCompare(b.date))) {
    const p = plot[h.code]
    const grape = h.crop === 'uva'
    production.push({
      farm_id: FARM,
      plot_id: p.id,
      season_id: SEASON[h.season],
      crop_cycle_id: cycleId(p.id, SEASON[h.season]),
      crop_id: p.crop_id,
      variety_id: p.variety_id,
      harvest_date: h.date,
      quantity: h.kg,
      unit: 'kg',
      quantity_kg: h.kg,
      production_type: h.problem ? 'Mercado interno (qualidade inferior)' : 'Comercial',
      team: pick(['Turma do Zé Carlos', 'Turma da Graça']),
      destination: grape ? 'Packing house' : 'Galpão de embalagem',
      created_by: USER,
    })
    laborCost(h.code, h.season, h.date, 'mao_de_obra', 'Colheita', h.kg * (grape ? 0.6 : 0.12), 'Turma de colheita')
    laborCost(h.code, h.season, h.date, 'embalagens', grape ? 'Caixas, cumbucas e sacos' : 'Caixas de papelão', h.kg * (grape ? 1.1 : 0.2), 'Embalagens Nordeste')
    laborCost(h.code, h.season, addDays(h.date, 1), 'frete', 'Frete até o comprador', h.kg * (grape ? 0.3 : 0.14), 'Transportadora Rota do Vale')

    // venda: 95% do colhido (descarte de 5%)
    const saleDate = addDays(h.date, 1) <= TODAY ? addDays(h.date, 1) : h.date
    const buyerKey = h.problem ? pick(['ceasa', 'atacadao']) : pick(grape ? grapeBuyers : mangoBuyers)
    const b = BUYERS[buyerKey]
    const kgSold = Math.round(h.kg * 0.95)
    const price = r2(vary(h.price * b.factor, 0.04))
    const inBoxes = buyerKey === 'ceasa'
    const qty = inBoxes ? Math.round(kgSold / 8) : kgSold
    const totalAmount = r2((inBoxes ? qty * 8 : qty) * price)
    const due = addDays(saleDate, b.terms)
    let received = 0
    let receivedDate = null
    if (due < TODAY) {
      received = totalAmount
      receivedDate = due
      // uma venda do atacado recebida so' pela metade e atrasada
      if (buyerKey === 'atacadao' && due >= '2026-08-20' && !sold.overduePartial) {
        received = r2(totalAmount / 2)
        sold.overduePartial = true
      }
    } else if (buyerKey === 'valefruit' && daysBetween(saleDate, TODAY) > 20) {
      received = r2(totalAmount * 0.4) // adiantamento da exportadora
      receivedDate = addDays(saleDate, 10)
    }
    sales.push({
      buyerKey,
      farm_id: FARM,
      season_id: SEASON[h.season],
      plot_id: p.id,
      crop_id: p.crop_id,
      variety_id: p.variety_id,
      sale_date: saleDate,
      quantity: qty,
      unit: inBoxes ? 'caixa' : 'kg',
      unit_weight_kg: inBoxes ? 8 : null,
      price_per_kg: price,
      total_amount: totalAmount,
      payment_method: b.method,
      due_date: due,
      received_amount: received,
      received_date: receivedDate,
      notes: h.problem ? 'Uva com rachadura — preço de mercado interno' : null,
      created_by: USER,
    })
  }

  // ---------- custos gerais mensais (sem talhao)
  for (let m = 0; m < 12; m++) {
    const base = new Date(Date.UTC(2025, 9 + m, 1)).toISOString().slice(0, 8)
    laborCost(null, null, base + '05', 'servicos', 'Assistência técnica agronômica', 3800, 'Eng. Agr. Marcos Vinícius')
    laborCost(null, null, base + '10', 'mao_de_obra', 'Folha fixa — encarregado e vigia', 7400, 'Folha de pagamento')
    laborCost(null, null, base + '15', 'combustivel', 'Óleo diesel do trator', vary(2600, 0.15), 'Posto Chapada')
    laborCost(null, null, base + '18', 'energia', 'Energia da sede e do galpão', vary(480, 0.1), 'Neoenergia')
    if (m % 2 === 1) laborCost(null, null, base + '22', 'maquinas', pick(['Revisão do trator', 'Manutenção do turbo atomizador', 'Troca de pneus da carreta']), vary(1600, 0.4), 'Oficina Agro Petrolina')
    if (m % 3 === 0) laborCost(null, null, base + '25', 'manutencao', 'Manutenção do sistema de irrigação', vary(2200, 0.3), 'Irriga Vale Serviços')
  }

  // ---------- irrigacao
  const irrigation = []
  for (const code of Object.keys(plot)) {
    const p = plot[code]
    const grape = !code.startsWith('M')
    const perHaDay = code === 'P1B' ? 18 : grape ? 30 : 25
    // M3 com a bomba em manutencao: ultima irrigacao ha' 7 dias
    const stop = code === 'M3' ? '2026-09-15' : '2026-09-21'
    let d = '2025-10-01'
    while (d <= stop) {
      const step = d < '2026-09-01' ? 7 : 2
      const volume = r1(vary(perHaDay * step * p.area, 0.08))
      irrigation.push({
        farm_id: FARM,
        plot_id: p.id,
        season_id: seasonByDate(d),
        irrigation_date: d,
        duration_minutes: Math.round(step * (grape ? 150 : 180)),
        volume_m3: volume,
        method: grape ? 'Gotejamento' : 'Microaspersão',
        cost: r2(volume * 0.29),
        responsible: 'Rosângela',
        created_by: USER,
      })
      d = addDays(d, step)
    }
  }

  // ---------- estoque: compras antes do uso
  const productRows = Object.entries(PRODUCTS).map(([key, p]) => ({
    key,
    farm_id: FARM,
    name: p.name,
    category: p.category,
    unit: p.unit,
    active_ingredient: p.ai ?? null,
    unit_cost: p.cost,
    min_stock: 0,
    location: p.category === 'defensivo' ? 'Depósito de defensivos' : 'Galpão de insumos',
  }))
  const uses = [
    ...apps.filter((a) => a.status === 'realizada').map((a) => ({ key: a.key, date: a.application_date, qty: a.total_quantity })),
    ...ferts.map((f) => ({ key: f.key, date: f.fertilization_date, qty: f.quantity })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const annual = {}
  for (const u of uses) annual[u.key] = (annual[u.key] ?? 0) + u.qty
  const lot = (key) => {
    const raw = annual[key] / 4
    const mag = Math.pow(10, Math.floor(Math.log10(raw)))
    return Math.ceil(raw / mag) * mag
  }
  const stock = {}
  const purchases = []
  for (const u of uses) {
    stock[u.key] = stock[u.key] ?? 0
    while (stock[u.key] < u.qty) {
      const q = lot(u.key)
      purchases.push({ key: u.key, date: addDays(u.date, -(3 + Math.floor(rnd() * 8))), qty: q })
      stock[u.key] += q
    }
    stock[u.key] -= u.qty
  }
  // minimos: ~6 semanas de consumo; mancozebe fica critico e nitrato de calcio baixo
  for (const row of productRows) {
    const a = annual[row.key] ?? 0
    const final = stock[row.key] ?? 0
    let min = Math.round((a / 52) * 6)
    if (row.key === 'mancozebe') min = Math.max(Math.round(final / 0.35), 30)
    else if (row.key === 'nitcalcio') min = Math.round(final / 0.8)
    else if (final < min) {
      const q = Math.ceil((min * 1.6 - final) / 10) * 10
      purchases.push({ key: row.key, date: '2026-09-09', qty: q })
      stock[row.key] = final + q
    }
    row.min_stock = min
  }

  await insertAll('products', productRows.map(({ key, ...r }) => r), 'insumos')
  const prodDb = await must(db.from('products').select('id, name').eq('farm_id', FARM), 'products')
  const productId = (key) => prodDb.find((p) => p.name === PRODUCTS[key].name).id

  await insertAll('buyers', Object.values(BUYERS).map((b) => ({ farm_id: FARM, name: b.name, location: b.location, phone: b.phone, notes: b.notes })), 'compradores')
  const buyersDb = await must(db.from('buyers').select('id, name').eq('farm_id', FARM), 'buyers')
  const buyerId = (key) => buyersDb.find((b) => b.name === BUYERS[key].name).id

  // compras: entrada no estoque + saida de caixa que nao e' custo de producao
  purchases.sort((a, b) => a.date.localeCompare(b.date))
  const lastFertBeforeAug20 = [...purchases].reverse().find((p) => PRODUCTS[p.key].category === 'fertilizante' && p.date < '2026-08-20')
  const movements = []
  const purchaseExpenses = []
  for (const pu of purchases) {
    const prod = PRODUCTS[pu.key]
    const unitCost = r2(vary(prod.cost, 0.03))
    const total = r2(pu.qty * unitCost)
    movements.push({
      farm_id: FARM,
      product_id: productId(pu.key),
      movement_type: 'entrada',
      quantity: pu.qty,
      unit_cost: unitCost,
      total_cost: total,
      movement_date: pu.date,
      notes: `NF ${Math.floor(10000 + rnd() * 89999)}`,
      created_by: USER,
    })
    let status = 'pago'
    let due = null
    if (pu === lastFertBeforeAug20) {
      status = 'pendente'
      due = '2026-09-12' // boleto vencido
    } else if (pu.date >= '2026-09-01') {
      status = 'pendente'
      due = addDays(pu.date, 30)
    }
    purchaseExpenses.push({
      farm_id: FARM,
      plot_id: null,
      season_id: seasonByDate(pu.date),
      category: prod.category === 'fertilizante' ? 'adubacao' : 'fitossanidade',
      description: `Compra: ${prod.name}`,
      amount: total,
      expense_date: pu.date,
      due_date: due,
      status,
      paid_amount: status === 'pago' ? total : 0,
      paid_date: status === 'pago' ? pu.date : null,
      supplier: SUPPLIER[prod.category],
      is_production_cost: false,
      created_by: USER,
    })
  }

  // contas em aberto do mes
  labor.push(
    { farm_id: FARM, plot_id: plot.M3.id, season_id: SEASON.s2, category: 'manutencao', description: 'Conserto da bomba do M3 (rebobinagem do motor)', amount: 3850, expense_date: '2026-09-16', due_date: '2026-09-30', status: 'pendente', paid_amount: 0, paid_date: null, supplier: 'Irriga Vale Serviços', is_production_cost: true, created_by: USER },
    { farm_id: FARM, plot_id: null, season_id: SEASON.s2, category: 'mao_de_obra', description: 'Diárias da quinzena (colheita P2B e P1B)', amount: 9640, expense_date: '2026-09-20', due_date: '2026-09-26', status: 'pendente', paid_amount: 0, paid_date: null, supplier: 'Diaristas da comunidade', is_production_cost: true, created_by: USER },
  )

  const activities = [
    ['2026-09-15', 'Aferir o turbo atomizador', 'Cícero', true, null],
    ['2026-09-16', 'Chamar técnico para a bomba do M3', 'Rosângela', true, 'M3'],
    ['2026-09-17', 'Separar caixas para a Vale Fruit', 'Graça', true, null],
    ['2026-09-18', 'Coletar amostra de solo', 'Damião', true, 'P3A'],
    ['2026-09-19', 'Conferir brix antes da colheita', 'Zé Carlos', true, 'P4A'],
    ['2026-09-20', 'Religar irrigação do M3 após o conserto', 'Rosângela', false, 'M3'],
    ['2026-09-21', 'Cobrar o Atacadão pela parcela em atraso', 'Jhon', false, null],
    ['2026-09-24', 'Iniciar colheita do P4A', 'Zé Carlos', false, 'P4A'],
    ['2026-09-26', 'Poda pós-colheita do M2', 'Damião', false, 'M2'],
    ['2026-09-29', 'Reunião com a exportadora sobre a janela de outubro', 'Jhon', false, null],
  ].map(([due, title, who, done, code]) => ({
    farm_id: FARM,
    plot_id: code ? plot[code].id : null,
    season_id: SEASON.s2,
    type: 'tarefa',
    title,
    due_date: due,
    done,
    done_date: done ? due : null,
    responsible: who,
    created_by: USER,
  }))

  // ---------- gravacao (compras antes das operacoes que consomem)
  await insertAll('inventory_movements', movements, 'compras de insumo')
  await insertAll('expenses', purchaseExpenses, 'despesas de compra')
  await insertAll('applications', apps.map(({ key, ...a }) => ({ ...a, product_id: productId(key) })), 'aplicações')
  await insertAll('fertilizations', ferts.map(({ key, ...f }) => ({ ...f, product_id: productId(key) })), 'adubações')
  await insertAll('irrigation_records', irrigation, 'irrigações')
  await insertAll('expenses', labor, 'despesas diretas')
  await insertAll('production_records', production.map(({ quantity_kg, ...r }) => r), 'colheitas')
  await insertAll('sales', sales.map(({ buyerKey, ...s }) => ({ ...s, buyer_id: buyerId(buyerKey) })), 'vendas')
  await insertAll('activities', activities, 'tarefas')

  const m = await seedMachines(db, FARM)
  console.log(`maquinas: ${m.machines} cadastradas, ${m.logs} registros de manutencao e abastecimento`)

  // ---------- resumo
  const overview = await must(db.from('v_farm_overview').select('*').eq('farm_id', FARM), 'overview')
  for (const o of overview) {
    const name = o.season_id === s1.id ? '2026.1' : '2026.2'
    console.log(
      `\n${name}: ${Math.round(o.production_kg).toLocaleString('pt-BR')} kg | receita R$ ${Math.round(o.revenue).toLocaleString('pt-BR')} | ` +
        `custo prod. R$ ${Math.round(o.production_cost).toLocaleString('pt-BR')} | custo/kg ${o.cost_per_kg} | resultado R$ ${Math.round(o.result).toLocaleString('pt-BR')} | a receber R$ ${Math.round(o.receivable).toLocaleString('pt-BR')}`,
    )
  }
  const perf = await must(db.from('v_plot_performance').select('code, production_kg, cost_per_kg, result').eq('farm_id', FARM).order('code'), 'perf')
  console.log('\nTalhão  produção kg  custo/kg  resultado')
  for (const p of perf) console.log(`${p.code.padEnd(7)} ${String(Math.round(p.production_kg)).padStart(11)} ${String(p.cost_per_kg ?? '-').padStart(9)} ${String(Math.round(p.result)).padStart(10)}`)
  const stockDb = await must(db.from('v_stock_status').select('name, current_stock, min_stock, stock_level').eq('farm_id', FARM), 'stock')
  const neg = stockDb.filter((s) => Number(s.current_stock) < 0)
  console.log(`\nEstoque: ${stockDb.filter((s) => s.stock_level !== 'normal').map((s) => `${s.name} (${s.stock_level})`).join(', ') || 'tudo normal'}${neg.length ? ' | NEGATIVO: ' + neg.map((s) => s.name).join(', ') : ''}`)
})().catch((e) => {
  console.error('FALHA:', e.message)
  process.exit(1)
})
