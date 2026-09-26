/**
 * Verificacao ponta a ponta contra o banco real.
 *
 * 1. Cria dois produtores e duas propriedades.
 * 2. Lanca colheita, aplicacao, adubacao, compra, venda e despesa.
 * 3. Confere se os numeros fecham (estoque, custo/kg, a receber, resultado).
 * 4. Confere se o RLS isola de fato uma propriedade da outra.
 *
 * Limpa tudo o que criou ao final. Uso: node tools/verify.js
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true })
const { createClient } = require('@supabase/supabase-js')
const { Client } = require('pg')

const URL = process.env.SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.SUPABASE_ANON_KEY

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

const STAMP = Date.now()
const USERS = [
  { email: `verify.a.${STAMP}@example.test`, password: 'Senha-Forte-123', name: 'Produtor A' },
  { email: `verify.b.${STAMP}@example.test`, password: 'Senha-Forte-456', name: 'Produtor B' },
]

let passed = 0
let failed = 0

function check(label, actual, expected, tolerance = 0.01) {
  const ok =
    typeof expected === 'number'
      ? Math.abs(Number(actual) - expected) <= tolerance
      : actual === expected
  if (ok) {
    passed++
    console.log(`  OK   ${label} = ${actual}`)
  } else {
    failed++
    console.log(`  FALHA ${label}: esperado ${expected}, obtido ${actual}`)
  }
}

function checkTrue(label, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  OK   ${label}`)
  } else {
    failed++
    console.log(`  FALHA ${label} ${detail}`)
  }
}

async function signIn(user) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data, error } = await c.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  })
  if (error) throw new Error(`login ${user.email}: ${error.message}`)
  return { client: c, userId: data.user.id }
}

async function main() {
  const created = []

  // ---------------------------------------------------------- 1. usuarios
  console.log('\n1. Criando produtores de teste')
  for (const u of USERS) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.name },
    })
    if (error) throw new Error(`criar usuario: ${error.message}`)
    u.id = data.user.id
    created.push(data.user.id)
    console.log(`  criado ${u.email}`)
  }

  const a = await signIn(USERS[0])
  const b = await signIn(USERS[1])

  // Trigger de signup deve ter criado o profile.
  const { data: profA } = await a.client.from('profiles').select('full_name').eq('id', a.userId).maybeSingle()
  check('profile criado no signup', profA?.full_name, 'Produtor A')

  // ------------------------------------------------------- 2. propriedades
  console.log('\n2. Criando propriedades')
  const { data: farmA, error: farmErrA } = await a.client
    .from('farms')
    .insert({ name: 'Fazenda Verificacao A', city: 'Petrolina', state: 'PE', total_area: 10, created_by: a.userId })
    .select('id')
    .single()
  if (farmErrA) throw new Error(`criar fazenda A: ${farmErrA.message}`)

  const { data: farmB, error: farmErrB } = await b.client
    .from('farms')
    .insert({ name: 'Fazenda Verificacao B', city: 'Juazeiro', state: 'BA', total_area: 5, created_by: b.userId })
    .select('id')
    .single()
  if (farmErrB) throw new Error(`criar fazenda B: ${farmErrB.message}`)

  // O trigger on_farm_created deve ter vinculado o criador como owner.
  const { data: roleA } = await a.client
    .from('farm_users')
    .select('role')
    .eq('farm_id', farmA.id)
    .maybeSingle()
  check('criador vira owner automaticamente', roleA?.role, 'owner')

  const { data: season } = await a.client
    .from('seasons')
    .insert({ farm_id: farmA.id, name: '2026.1', is_active: true })
    .select('id')
    .single()

  const { data: crop } = await a.client.from('crops').select('id').eq('slug', 'uva').single()
  const { data: variety } = await a.client
    .from('varieties')
    .select('id')
    .eq('crop_id', crop.id)
    .eq('name', 'Vitória')
    .single()

  const { data: plot, error: plotErr } = await a.client
    .from('plots')
    .insert({
      farm_id: farmA.id, code: 'P-03', area: 3.2, crop_id: crop.id,
      variety_id: variety.id, plant_count: 4850, status: 'producao',
    })
    .select('id')
    .single()
  if (plotErr) throw new Error(`criar talhao: ${plotErr.message}`)

  // ---------------------------------------------- 3. estoque automatico
  console.log('\n3. Estoque: entrada, baixa por aplicacao e por adubacao')
  const { data: product } = await a.client
    .from('products')
    .insert({ farm_id: farmA.id, name: 'Produto X', category: 'defensivo', unit: 'L', min_stock: 20, unit_cost: 50 })
    .select('id')
    .single()

  // compra de 100 L
  await a.client.from('inventory_movements').insert({
    farm_id: farmA.id, product_id: product.id, movement_type: 'entrada',
    quantity: 100, unit_cost: 50, total_cost: 5000, movement_date: '2026-09-01',
  })

  let { data: stock } = await a.client.from('products').select('current_stock').eq('id', product.id).single()
  check('estoque apos compra de 100 L', Number(stock.current_stock), 100)

  // aplicacao consome 15 L (secao 20 do escopo)
  const { data: app, error: appErr } = await a.client
    .from('applications')
    .insert({
      farm_id: farmA.id, plot_id: plot.id, season_id: season.id, product_id: product.id,
      product_name: 'Produto X', dose: 2.5, dose_unit: 'L/ha', area: 3.2,
      total_quantity: 15, cost: 750, status: 'realizada', application_date: '2026-09-18',
    })
    .select('id')
    .single()
  if (appErr) throw new Error(`criar aplicacao: ${appErr.message}`)

  ;({ data: stock } = await a.client.from('products').select('current_stock').eq('id', product.id).single())
  check('estoque apos aplicar 15 L', Number(stock.current_stock), 85)

  // a aplicacao tambem deve ter virado despesa atribuida ao talhao
  const { data: appExpense } = await a.client
    .from('expenses')
    .select('amount, category, plot_id, is_production_cost')
    .eq('source_table', 'applications')
    .eq('source_id', app.id)
    .maybeSingle()
  check('aplicacao gera despesa', Number(appExpense?.amount), 750)
  check('despesa na categoria certa', appExpense?.category, 'fitossanidade')
  check('despesa atribuida ao talhao', appExpense?.plot_id, plot.id)

  // adubacao
  const { data: fert } = await a.client
    .from('products')
    .insert({ farm_id: farmA.id, name: '20-05-20', category: 'fertilizante', unit: 'kg', min_stock: 100, unit_cost: 11.5 })
    .select('id')
    .single()

  await a.client.from('inventory_movements').insert({
    farm_id: farmA.id, product_id: fert.id, movement_type: 'entrada',
    quantity: 200, unit_cost: 11.5, total_cost: 2300, movement_date: '2026-09-02',
  })

  await a.client.from('fertilizations').insert({
    farm_id: farmA.id, plot_id: plot.id, season_id: season.id, product_id: fert.id,
    product_name: '20-05-20', quantity: 150, unit: 'kg', cost: 1725,
    fertilization_date: '2026-09-10',
  })

  const { data: fertStock } = await a.client.from('products').select('current_stock').eq('id', fert.id).single()
  check('estoque de adubo apos aplicar 150 kg', Number(fertStock.current_stock), 50)

  // semaforo de estoque
  const { data: levels } = await a.client
    .from('v_stock_status')
    .select('name, stock_level')
    .eq('farm_id', farmA.id)
  const fertLevel = levels.find((l) => l.name === '20-05-20')
  check('adubo abaixo do minimo vira critico', fertLevel?.stock_level, 'critico')

  // ------------------------------------------------- 4. producao e venda
  console.log('\n4. Producao, venda e recebimento')

  // colheita em caixas: exige peso unitario para normalizar em kg
  await a.client.from('production_records').insert({
    farm_id: farmA.id, plot_id: plot.id, season_id: season.id, crop_id: crop.id,
    variety_id: variety.id, harvest_date: '2026-09-18',
    quantity: 100, unit: 'caixa', unit_weight_kg: 8.5,
  })

  const { data: prod } = await a.client
    .from('production_records')
    .select('quantity_kg')
    .eq('plot_id', plot.id)
    .single()
  check('100 caixas de 8,5 kg viram kg', Number(prod.quantity_kg), 850)

  const { data: buyer } = await a.client
    .from('buyers')
    .insert({ farm_id: farmA.id, name: 'Comprador Teste' })
    .select('id')
    .single()

  // venda de 800 kg a R$ 6,20 — total calculado pelo trigger
  const { data: sale } = await a.client
    .from('sales')
    .insert({
      farm_id: farmA.id, buyer_id: buyer.id, season_id: season.id, plot_id: plot.id,
      sale_date: '2026-09-19', quantity: 800, unit: 'kg', price_per_kg: 6.2,
    })
    .select('id, total_amount, status')
    .single()
  check('total da venda calculado sozinho', Number(sale.total_amount), 4960)
  check('venda nasce pendente', sale.status, 'pendente')

  // a venda deve ter gerado a receita correspondente
  const { data: rev } = await a.client
    .from('revenues')
    .select('amount, status')
    .eq('sale_id', sale.id)
    .maybeSingle()
  check('venda gera receita', Number(rev?.amount), 4960)

  // recebimento parcial
  await a.client.from('sales').update({ received_amount: 3000 }).eq('id', sale.id)
  const { data: partial } = await a.client.from('sales').select('status').eq('id', sale.id).single()
  check('recebimento parcial muda status', partial.status, 'parcial')

  // despesa manual de mao de obra
  await a.client.from('expenses').insert({
    farm_id: farmA.id, plot_id: plot.id, season_id: season.id, category: 'mao_de_obra',
    description: 'Turma da colheita', amount: 2400, expense_date: '2026-09-18',
    status: 'pago', paid_amount: 2400,
  })

  // compra para estoque lancada como caixa, mas NAO como custo de producao
  await a.client.from('expenses').insert({
    farm_id: farmA.id, season_id: season.id, category: 'adubacao',
    description: 'Compra: 20-05-20', amount: 2300, expense_date: '2026-09-02',
    status: 'pago', paid_amount: 2300, is_production_cost: false,
  })

  // ------------------------------------------------ 5. numeros fechando
  console.log('\n5. Os numeros fecham?')
  const { data: perf } = await a.client
    .from('v_plot_performance')
    .select('*')
    .eq('plot_id', plot.id)
    .single()

  const expectedCost = 750 + 1725 + 2400 // aplicacao + adubacao + mao de obra
  check('custo do talhao', Number(perf.total_cost), expectedCost)
  check('producao do talhao', Number(perf.production_kg), 850)
  check('custo por kg', Number(perf.cost_per_kg), Number((expectedCost / 850).toFixed(2)))
  check('receita do talhao', Number(perf.revenue), 4960)
  check('resultado do talhao', Number(perf.result), 4960 - expectedCost)
  check('produtividade por hectare', Number(perf.kg_per_ha), Number((850 / 3.2).toFixed(2)))

  const { data: ov } = await a.client
    .from('v_farm_overview')
    .select('*')
    .eq('farm_id', farmA.id)
    .eq('season_id', season.id)
    .single()

  check('custo de producao da safra', Number(ov.production_cost), expectedCost)
  check('saida de caixa inclui a compra de estoque', Number(ov.cash_out), expectedCost + 2300)
  check('receita da safra', Number(ov.revenue), 4960)
  check('ja recebido', Number(ov.received), 3000)
  check('a receber', Number(ov.receivable), 1960)
  check('resultado da safra', Number(ov.result), 4960 - expectedCost)

  // A compra de insumo nao pode inflar o custo por kg.
  checkTrue(
    'compra de estoque nao entra no custo por kg',
    Number(ov.production_cost) < Number(ov.cash_out),
    `(custo ${ov.production_cost} vs caixa ${ov.cash_out})`,
  )

  // --------------------------------------------- 5b. maquinas e implementos
  // Depois da secao 5 de proposito: o custo de maquina e' da fazenda, nao
  // do talhao, e mudaria os totais de safra conferidos acima.
  console.log('\n5b. Maquinas: horimetro, custos e acoplamento')

  const { data: tractor, error: trErr } = await a.client
    .from('machines')
    .insert({
      farm_id: farmA.id, class: 'maquina', kind: 'Trator', name: 'Trator azul',
      meter_type: 'horas', current_meter: 1200, acquisition_value: 180000,
    })
    .select('id')
    .single()
  if (trErr) throw new Error(`criar trator: ${trErr.message}`)

  const { data: grade, error: grErr } = await a.client
    .from('machines')
    .insert({
      farm_id: farmA.id, class: 'implemento', kind: 'Grade', name: 'Grade 14 discos',
      meter_type: 'nenhum', coupled_to: tractor.id,
    })
    .select('id')
    .single()
  check('implemento acoplado ao trator', grErr ? grErr.message : 'ok', 'ok')

  await a.client.from('machine_logs').insert({
    farm_id: farmA.id, machine_id: tractor.id, season_id: season.id,
    log_type: 'preventiva', log_date: '2026-09-20', description: 'Troca de oleo',
    meter_reading: 1250, cost: 850, next_due_meter: 1500,
  })
  // Registro com leitura menor, digitado depois: nao pode voltar o horimetro.
  await a.client.from('machine_logs').insert({
    farm_id: farmA.id, machine_id: tractor.id, season_id: season.id,
    log_type: 'abastecimento', log_date: '2026-09-21', meter_reading: 1240,
    liters: 80, cost: 520,
  })

  const { data: tr } = await a.client
    .from('machines').select('current_meter').eq('id', tractor.id).single()
  check('horimetro avanca e nao volta', Number(tr.current_meter), 1250)

  const { data: machExp } = await a.client
    .from('expenses')
    .select('category, amount')
    .eq('source_table', 'machine_logs')
    .order('amount', { ascending: false })
  check('manutencao vira custo de maquinas', machExp?.[0]?.category, 'maquinas')
  check('abastecimento vira custo de combustivel', machExp?.[1]?.category, 'combustivel')

  const { data: ms } = await a.client
    .from('v_machine_status')
    .select('maintenance_cost, fuel_cost, fuel_liters, due_level')
    .eq('machine_id', tractor.id)
    .single()
  check('custo de manutencao na view', Number(ms.maintenance_cost), 850)
  check('litros abastecidos na view', Number(ms.fuel_liters), 80)
  check('manutencao ainda longe = ok', ms.due_level, 'ok')

  // --------------------------------------- 5c. previsao x realizado e destinos
  console.log('\n5c. Previsao da safra e destinos da colheita')

  // 25 t/ha em 3,2 ha = 80.000 kg previstos; ja' colhidos 850 kg.
  const { error: ccErr } = await a.client.from('crop_cycles').insert({
    farm_id: farmA.id, plot_id: plot.id, season_id: season.id,
    crop_id: crop.id, variety_id: variety.id, expected_t_ha: 25,
  })
  check('previsao gravada no ciclo do talhao', ccErr ? ccErr.message : 'ok', 'ok')

  const { data: fc } = await a.client
    .from('v_forecast')
    .select('expected_kg, realized_kg, pct_achieved, variety_name')
    .eq('plot_id', plot.id)
    .eq('season_id', season.id)
    .single()
  check('volume previsto = t/ha x area', Number(fc.expected_kg), 80000)
  check('realizado da safra', Number(fc.realized_kg), 850)
  check('% da previsao atingido', Number(fc.pct_achieved), 1.1, 0.05)
  check('previsao carrega a variedade do talhao', fc.variety_name, 'Vitória')

  const { data: globals } = await a.client
    .from('harvest_destinations').select('name').is('farm_id', null)
  checkTrue('destinos padrao visiveis', (globals ?? []).some((d) => d.name === 'Packing house'))

  const { error: destErr } = await a.client
    .from('harvest_destinations').insert({ farm_id: farmA.id, name: 'Feira de Petrolina' })
  check('produtor cria destino proprio', destErr ? destErr.message : 'ok', 'ok')

  const { error: globalErr } = await a.client
    .from('harvest_destinations').insert({ farm_id: null, name: 'Destino global invasor' })
  checkTrue('ninguem altera a lista padrao', !!globalErr, '(insert global aceito!)')

  // ------------------------------------ 5d. numeros por safra e totais no banco
  console.log('\n5d. Numeros por safra e totais agregados')

  const { data: s2 } = await a.client
    .from('seasons').insert({ farm_id: farmA.id, name: '2026.2', is_active: true })
    .select('id').single()
  // colheita e custo na safra 2: nao podem aparecer na safra 1
  await a.client.from('production_records').insert({
    farm_id: farmA.id, plot_id: plot.id, season_id: s2.id, crop_id: crop.id,
    harvest_date: '2026-09-20', quantity: 1000, unit: 'kg',
  })
  await a.client.from('expenses').insert({
    farm_id: farmA.id, plot_id: plot.id, season_id: s2.id, category: 'mao_de_obra',
    description: 'Poda', amount: 1000, expense_date: '2026-09-20', status: 'pago', paid_amount: 1000,
  })

  const { data: psp1 } = await a.client
    .from('v_plot_season_performance').select('production_kg, total_cost')
    .eq('plot_id', plot.id).eq('season_id', season.id).single()
  const { data: psp2 } = await a.client
    .from('v_plot_season_performance').select('production_kg, total_cost')
    .eq('plot_id', plot.id).eq('season_id', s2.id).single()
  const { data: pall } = await a.client
    .from('v_plot_performance').select('production_kg, total_cost').eq('plot_id', plot.id).single()

  check('safra 1 nao ve colheita da safra 2', Number(psp1.production_kg), 850)
  check('safra 2 so com a propria colheita', Number(psp2.production_kg), 1000)
  check('safras somadas = acumulado', Number(psp1.production_kg) + Number(psp2.production_kg), Number(pall.production_kg))
  check('custo por safra somado = acumulado', Number(psp1.total_cost) + Number(psp2.total_cost), Number(pall.total_cost))

  const { data: expRows } = await a.client.from('expenses').select('amount').eq('farm_id', farmA.id)
  const { data: expSum } = await a.client.from('v_expense_summary').select('amount').eq('farm_id', farmA.id)
  const real = (expRows ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const agg = (expSum ?? []).reduce((s, r) => s + Number(r.amount), 0)
  check('resumo de despesas = soma real', agg, real)

  // ------------------------------------------------ 6. isolamento do RLS
  console.log('\n6. RLS: o produtor B enxerga algo do produtor A?')

  for (const v of ['v_plot_season_performance', 'v_expense_summary', 'v_revenue_summary', 'v_sales_summary']) {
    const { data: seen } = await b.client.from(v).select('farm_id').eq('farm_id', farmA.id)
    check(`B nao ve ${v} de A`, (seen ?? []).length, 0)
  }

  const { data: fcSeenByB } = await b.client.from('v_forecast').select('plot_id')
  check('B nao ve a previsao de A', (fcSeenByB ?? []).length, 0)

  const { data: destSeenByB } = await b.client
    .from('harvest_destinations').select('name').eq('name', 'Feira de Petrolina')
  check('B nao ve destino criado por A', (destSeenByB ?? []).length, 0)

  const { error: destByB } = await b.client
    .from('harvest_destinations').insert({ farm_id: farmA.id, name: 'Invasao' })
  checkTrue('B nao cria destino na fazenda de A', !!destByB, '(insert aceito!)')

  const { data: machSeenByB } = await b.client.from('machines').select('id')
  check('B nao ve maquinas de A', machSeenByB.length, 0)

  const { error: logByB } = await b.client.from('machine_logs').insert({
    farm_id: farmA.id, machine_id: tractor.id, log_type: 'corretiva',
    description: 'invasao', cost: 1,
  })
  checkTrue('B nao lanca manutencao na maquina de A', !!logByB, '(insert foi aceito!)')

  // B tenta acoplar implemento proprio no trator de A.
  const { error: coupleByB } = await b.client.from('machines').insert({
    farm_id: farmB.id, class: 'implemento', name: 'Carreta B', coupled_to: tractor.id,
  })
  checkTrue('B nao acopla no trator de A', !!coupleByB, '(acoplamento aceito!)')

  const { data: farmsSeenByB } = await b.client.from('farms').select('id, name')
  checkTrue(
    'B nao ve a fazenda de A',
    !farmsSeenByB.some((f) => f.id === farmA.id),
    `(viu ${farmsSeenByB.length} fazenda(s))`,
  )

  const { data: plotsSeenByB } = await b.client.from('plots').select('id')
  check('B nao ve talhoes de A', plotsSeenByB.length, 0)

  const { data: salesSeenByB } = await b.client.from('sales').select('id')
  check('B nao ve vendas de A', salesSeenByB.length, 0)

  const { data: expSeenByB } = await b.client.from('expenses').select('id')
  check('B nao ve despesas de A', expSeenByB.length, 0)

  const { data: perfSeenByB } = await b.client.from('v_plot_performance').select('plot_id')
  check('views tambem respeitam o RLS', perfSeenByB.length, 0)

  // Leitura direta por id, que e' a tentativa mais obvia de burlar.
  const { data: directRead } = await b.client.from('farms').select('id').eq('id', farmA.id)
  check('B nao le a fazenda de A nem pelo id', directRead.length, 0)

  // Escrita na propriedade alheia.
  const { error: writeErr } = await b.client.from('plots').insert({
    farm_id: farmA.id, code: 'INVASOR', area: 1,
  })
  checkTrue('B nao consegue gravar na fazenda de A', !!writeErr, '(insert foi aceito!)')

  // Atualizacao de linha alheia.
  const { data: updated } = await b.client
    .from('sales')
    .update({ price_per_kg: 0.01 })
    .eq('id', sale.id)
    .select('id')
  check('B nao consegue alterar venda de A', (updated ?? []).length, 0)

  // Papel viewer nao pode escrever.
  await admin.from('farm_users').insert({ farm_id: farmA.id, user_id: b.userId, role: 'viewer' })
  const { data: nowVisible } = await b.client.from('plots').select('id')
  check('viewer convidado passa a ler', nowVisible.length, 1)

  const { error: viewerWrite } = await b.client
    .from('plots')
    .insert({ farm_id: farmA.id, code: 'P-99', area: 1 })
  checkTrue('viewer nao pode gravar', !!viewerWrite, '(insert foi aceito!)')

  // Anonimo nao ve nada.
  const anon = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data: anonFarms, error: anonErr } = await anon.from('farms').select('id')
  checkTrue(
    'usuario deslogado nao ve nada',
    anonErr !== null || (anonFarms ?? []).length === 0,
    `(viu ${(anonFarms ?? []).length})`,
  )

  // ------------------------------------------------------- 7. auditoria
  console.log('\n7. Auditoria')
  const { data: audit } = await a.client
    .from('audit_logs')
    .select('table_name, action')
    .eq('farm_id', farmA.id)
  checkTrue('vendas e despesas ficam auditadas', (audit ?? []).length > 0, `(${(audit ?? []).length} registros)`)

  // --------------------------------------------------------- 8. limpeza
  console.log('\n8. Limpando os dados de teste')
  const pg = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  })
  await pg.connect()
  await pg.query('delete from public.farms where id = any($1)', [[farmA.id, farmB.id]])
  for (const id of created) {
    await admin.auth.admin.deleteUser(id)
  }
  await pg.end()
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
