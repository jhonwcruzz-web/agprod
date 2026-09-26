/**
 * Teste de fumaca autenticado.
 *
 * Cria um produtor com dados reais, monta o cookie de sessao no mesmo
 * formato do @supabase/ssr e busca as paginas do app, conferindo se os
 * numeros aparecem renderizados no HTML.
 *
 * Exige o servidor rodando (npm run dev). Uso: node tools/smoke-ui.js
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true })
const { createClient } = require('@supabase/supabase-js')
const { Client } = require('pg')

const SUPA_URL = process.env.SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.SUPABASE_ANON_KEY
const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000'
const REF = new URL(SUPA_URL).hostname.split('.')[0]

const admin = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } })

let passed = 0
let failed = 0

function contains(label, html, needle) {
  if (html.includes(needle)) {
    passed++
    console.log(`  OK   ${label}`)
  } else {
    failed++
    console.log(`  FALHA ${label}: não encontrei "${needle}"`)
  }
}

function status(label, actual, expected) {
  if (actual === expected) {
    passed++
    console.log(`  OK   ${label} (HTTP ${actual})`)
  } else {
    failed++
    console.log(`  FALHA ${label}: HTTP ${actual}, esperado ${expected}`)
  }
}

/** Reproduz o formato de cookie do @supabase/ssr (base64- + chunking). */
function sessionCookies(session) {
  const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64')
  const name = `sb-${REF}-auth-token`
  const MAX = 3180

  if (value.length <= MAX) return [`${name}=${value}`]

  const chunks = []
  for (let i = 0; i < value.length; i += MAX) chunks.push(value.slice(i, i + MAX))
  return chunks.map((c, i) => `${name}.${i}=${c}`)
}

async function main() {
  const email = `smoke.${Date.now()}@example.test`
  const password = 'Senha-Forte-789'

  console.log('\n1. Preparando produtor com dados')
  const { data: u, error: ue } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: 'Produtor Fumaca' },
  })
  if (ue) throw new Error(ue.message)

  const c = createClient(SUPA_URL, ANON, { auth: { persistSession: false } })
  const { data: s, error: se } = await c.auth.signInWithPassword({ email, password })
  if (se) throw new Error(se.message)

  const { data: farm } = await c.from('farms').insert({
    name: 'Fazenda Boa Esperança', trade_name: 'Boa Esperança',
    owner_name: 'João da Silva', city: 'Petrolina', state: 'PE',
    community: 'Maria Tereza', total_area: 12.4, created_by: u.user.id,
  }).select('id').single()

  const { data: season } = await c.from('seasons')
    .insert({ farm_id: farm.id, name: '2026.1', is_active: true })
    .select('id').single()

  const { data: crop } = await c.from('crops').select('id').eq('slug', 'uva').single()
  const { data: variety } = await c.from('varieties')
    .select('id').eq('crop_id', crop.id).eq('name', 'Vitória').single()

  const { data: plot } = await c.from('plots').insert({
    farm_id: farm.id, code: 'P-03', area: 3.2, crop_id: crop.id,
    variety_id: variety.id, plant_count: 4850, irrigation_system: 'Gotejamento',
    training_system: 'Latada', planting_date: '2024-08-15', status: 'producao',
  }).select('id').single()

  await c.from('production_records').insert({
    farm_id: farm.id, plot_id: plot.id, season_id: season.id, crop_id: crop.id,
    variety_id: variety.id, harvest_date: '2026-09-18', quantity: 6420, unit: 'kg',
  })

  await c.from('expenses').insert({
    farm_id: farm.id, plot_id: plot.id, season_id: season.id, category: 'mao_de_obra',
    description: 'Turma da colheita', amount: 5460, expense_date: '2026-09-18',
    status: 'pago', paid_amount: 5460,
  })

  const { data: buyer } = await c.from('buyers')
    .insert({ farm_id: farm.id, name: 'Comprador A' }).select('id').single()

  await c.from('sales').insert({
    farm_id: farm.id, buyer_id: buyer.id, season_id: season.id, plot_id: plot.id,
    sale_date: '2026-09-19', quantity: 6420, unit: 'kg', price_per_kg: 6.33,
  })

  await c.from('machines').insert({
    farm_id: farm.id, class: 'maquina', kind: 'Trator', name: 'Trator azul',
    meter_type: 'horas', current_meter: 1200,
  })

  await c.from('products').insert({
    farm_id: farm.id, name: 'Produto X', category: 'defensivo', unit: 'L',
    min_stock: 20, unit_cost: 50,
  })

  const cookies = sessionCookies(s.session).join('; ')
  const get = async (p) => {
    // Timeout largo: em dev o Next compila a rota na primeira visita.
    const res = await fetch(BASE + p, {
      headers: { cookie: cookies },
      redirect: 'manual',
      signal: AbortSignal.timeout(120_000),
    })
    return { code: res.status, html: await res.text() }
  }

  console.log('\n2. Painel principal')
  const home = await get('/')
  status('painel carrega', home.code, 200)
  contains('nome da propriedade', home.html, 'Fazenda Boa Esperança')
  contains('localidade', home.html, 'Maria Tereza')
  contains('área da propriedade', home.html, '12,4 ha')
  contains('produção total', home.html, '6.420 kg')
  contains('seção de atenção', home.html, 'O que precisa da minha atenção')
  contains('talhão listado', home.html, 'P-03')
  contains('atalho da IA', home.html, 'Perguntar sobre minha fazenda')

  console.log('\n3. Central do talhão')
  const plotPage = await get(`/talhoes/${plot.id}`)
  status('talhão carrega', plotPage.code, 200)
  contains('código do talhão', plotPage.html, 'P-03')
  contains('abas do talhão', plotPage.html, 'Aplicações')
  contains('plantas', plotPage.html, '4.850')
  contains('sistema de condução', plotPage.html, 'Latada')

  const plotCosts = await get(`/talhoes/${plot.id}?aba=custos`)
  contains('aba de custos', plotCosts.html, 'Mão de obra')
  contains('custo por kg do talhão', plotCosts.html, 'Custo por kg')

  console.log('\n4. Demais módulos')
  for (const [label, p, needle] of [
    ['produção', '/producao', 'Produtividade'],
    ['aplicações', '/aplicacoes', 'Custo acumulado'],
    ['adubação', '/adubacao', 'Total aplicado'],
    ['irrigação', '/irrigacao', 'Situação dos talhões'],
    ['estoque', '/estoque', 'Produto X'],
    ['custos', '/custos', 'Custo de produção'],
    ['comercialização', '/comercializacao', 'Comprador A'],
    ['financeiro', '/financeiro', 'Saldo em caixa'],
    ['safras', '/safras', '2026.1'],
    ['fazenda', '/fazenda', 'João da Silva'],
    ['máquinas', '/maquinas', 'Trator azul'],
    ['assistente', '/assistente', 'Pergunte sobre sua fazenda'],
    ['conta', '/conta', 'Minha conta'],
  ]) {
    const t0 = Date.now()
    const r = await get(p)
    console.log(`       ${p} em ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    status(`${label} carrega`, r.code, 200)
    contains(`${label}: conteúdo esperado`, r.html, needle)
  }

  console.log('\n5. Formulário de lançamento rápido')
  const novo = await get('/producao?novo=1')
  contains('painel de colheita abre', novo.html, 'Registrar colheita')
  contains('talhão disponível no select', novo.html, 'P-03')
  contains('destino com opções padrão', novo.html, 'Packing house')
  contains('botão + para novo destino', novo.html, 'Novo destino')
  contains('variedade vem do talhão', novo.html, 'Vem do cadastro do talhão')

  console.log('\n5b. Previsão x realizado')
  const prev = await get('/producao?aba=previsao')
  status('aba de previsão carrega', prev.code, 200)
  contains('tabela de previsão', prev.html, '% da previsão')
  contains('campo t/ha por talhão', prev.html, 'Previsão em t/ha do talhão P-03')
  const vari = await get('/producao?aba=variedades')
  contains('comparativo por variedade', vari.html, 'Previsão x realizado por variedade')
  contains('variedade listada', vari.html, 'Vitória')

  console.log('\n6. Limpeza')
  const pg = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  })
  await pg.connect()
  await pg.query('delete from public.farms where id = $1', [farm.id])
  await pg.end()
  await admin.auth.admin.deleteUser(u.user.id)
  console.log('  removido')

  console.log(`\n${'='.repeat(52)}`)
  console.log(`${passed} verificações passaram, ${failed} falharam`)
  console.log('='.repeat(52))
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('\nERRO FATAL:', e.message)
  process.exit(1)
})
