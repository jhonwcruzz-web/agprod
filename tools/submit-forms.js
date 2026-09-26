/**
 * Envio real de formularios, como o navegador faz (sem JavaScript).
 *
 * O smoke-ui so' abre as paginas; este script ENVIA os formularios —
 * inclusive nas variacoes em que campos condicionais ficam escondidos,
 * que foi onde o bug "expected nonoptional" se escondeu.
 *
 * Exige o servidor rodando (npm run dev). Uso: node tools/submit-forms.js
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true })
const { createClient } = require('@supabase/supabase-js')
const { Client } = require('pg')

const SUPA_URL = process.env.SUPABASE_URL
const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000'
const REF = new URL(SUPA_URL).hostname.split('.')[0]
const admin = createClient(SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

let passed = 0
let failed = 0

function sessionCookies(session) {
  const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64')
  const name = `sb-${REF}-auth-token`
  const MAX = 3180
  if (value.length <= MAX) return `${name}=${value}`
  const parts = []
  for (let i = 0; i < value.length; i += MAX) parts.push(`${name}.${parts.length}=${value.slice(i, i + MAX)}`)
  return parts.join('; ')
}

const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

/** Campos ocultos do Server Action do formulario que contem `field`. */
function actionFields(html, field) {
  const forms = html.split('<form').slice(1)
  const form = forms.find((f) => f.includes(`name="${field}"`))
  if (!form) throw new Error(`formulario com o campo "${field}" nao encontrado`)
  const out = []
  for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = /name="([^"]*)"/.exec(m[0])?.[1]
    const value = /value="([^"]*)"/.exec(m[0])?.[1] ?? ''
    if (name && name.startsWith('$ACTION')) out.push([name, decode(value)])
  }
  if (out.length === 0) throw new Error('campos do Server Action nao encontrados')
  return out
}

async function submit(cookie, pagePath, fields, anchorField) {
  const page = await fetch(BASE + pagePath, {
    headers: { cookie },
    signal: AbortSignal.timeout(180_000),
  })
  const html = await page.text()
  const body = new FormData()
  for (const [k, v] of actionFields(html, anchorField)) body.append(k, v)
  // So' os campos que o formulario REALMENTE mostra nessa variacao.
  for (const [k, v] of Object.entries(fields)) body.append(k, v)
  const res = await fetch(BASE + pagePath, {
    method: 'POST',
    headers: { cookie },
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(180_000),
  })
  return { status: res.status, location: res.headers.get('location'), html: await res.text() }
}

function expectOk(label, r, successText) {
  const bad = /expected nonoptional|Invalid input/.exec(r.html)
  const redirected = r.status >= 300 && r.status < 400
  // successText null = o sucesso desse formulario e' redirecionar.
  const ok = successText === null ? redirected : redirected || (!bad && r.html.includes(successText))
  if (ok) {
    passed++
    console.log(`  OK   ${label}${r.status >= 300 && r.status < 400 ? ` (redireciona ${r.location})` : ''}`)
  } else {
    failed++
    const err = /role="alert"[^>]*>(?:<svg[\s\S]*?<\/svg>)?([^<]*)/.exec(r.html)?.[1]
    console.log(`  FALHA ${label}: HTTP ${r.status} ${bad ? '— ' + bad[0] : ''} ${err ?? ''}`)
  }
}

async function main() {
  const email = `forms.${Date.now()}@example.test`
  const password = 'Senha-Forte-321'
  const { data: u, error: ue } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: 'Teste Formularios' },
  })
  if (ue) throw new Error(ue.message)

  const c = createClient(SUPA_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data: s } = await c.auth.signInWithPassword({ email, password })
  const cookie = sessionCookies(s.session)

  const { data: farm } = await c.from('farms')
    .insert({ name: 'Fazenda Formularios', total_area: 5, created_by: u.user.id }).select('id').single()
  await c.from('seasons').insert({ farm_id: farm.id, name: '2026.1', is_active: true })
  const { data: crop } = await c.from('crops').select('id').eq('slug', 'uva').single()
  const { data: plot } = await c.from('plots')
    .insert({ farm_id: farm.id, code: 'P-01', area: 2, crop_id: crop.id }).select('id').single()
  const { data: buyer } = await c.from('buyers')
    .insert({ farm_id: farm.id, name: 'Comprador X' }).select('id').single()
  const { data: product } = await c.from('products')
    .insert({ farm_id: farm.id, name: 'Adubo X', category: 'fertilizante', unit: 'kg' }).select('id').single()
  const { data: tractor } = await c.from('machines')
    .insert({ farm_id: farm.id, class: 'maquina', name: 'Trator T', meter_type: 'horas', current_meter: 100 })
    .select('id').single()

  const today = new Date().toISOString().slice(0, 10)

  try {
    console.log('\nMáquinas')
    // Caso do bug: implemento nao mostra potencia nem horimetro.
    expectOk('cadastrar implemento (sem potência/horímetro na tela)',
      await submit(cookie, '/maquinas/nova?classe=implemento', {
        class: 'implemento', kind: 'Grade', name: 'Grade teste', brand: '', model: '', year: '',
        identifier: '', coupled_to: tractor.id, acquisition_date: '', acquisition_value: '',
        status: 'operacional', notes: '',
      }, 'name'), null)
    // Maquina com "nao controlo": sem campo de horimetro.
    expectOk('cadastrar máquina sem controle de uso',
      await submit(cookie, '/maquinas/nova', {
        class: 'maquina', kind: 'Veículo', name: 'Moto', brand: '', model: '', year: '2020',
        identifier: '', power_hp: '', meter_type: 'nenhum', acquisition_date: '',
        acquisition_value: '', status: 'operacional', notes: '',
      }, 'name'), null)
    // Abastecimento: sem descricao nem proxima manutencao.
    expectOk('registrar abastecimento',
      await submit(cookie, '/maquinas?registro=1&tipo=abastecimento', {
        machine_id: tractor.id, log_type: 'abastecimento', log_date: today,
        meter_reading: '110', liters: '50', cost: '300', supplier: '', plot_id: '', responsible: '',
      }, 'log_type'), 'Abastecimento registrado')
    // Manutencao: sem litros.
    expectOk('registrar manutenção',
      await submit(cookie, '/maquinas?registro=1', {
        machine_id: tractor.id, log_type: 'preventiva', log_date: today, meter_reading: '',
        description: 'Troca de óleo', cost: '500', supplier: '', next_due_date: '',
        next_due_meter: '350', plot_id: '', responsible: '',
      }, 'log_type'), 'Registro salvo')

    console.log('\nProdução e vendas')
    // Colheita em kg: o campo "peso de cada caixa" nao aparece.
    expectOk('colheita em kg (sem peso por caixa na tela)',
      await submit(cookie, '/producao?novo=1', {
        harvest_date: today, plot_id: plot.id, variety_id: '', quantity: '900', unit: 'kg',
        destination: 'Packing house', team: '',
      }, 'harvest_date'), 'Colheita registrada')
    expectOk('colheita em caixa (com peso por caixa)',
      await submit(cookie, '/producao?novo=1', {
        harvest_date: today, plot_id: plot.id, variety_id: '', quantity: '100', unit: 'caixa',
        unit_weight_kg: '8,5', destination: '', team: '',
      }, 'harvest_date'), 'Colheita registrada')
    // Venda ja' recebida: sem vencimento nem valor parcial.
    expectOk('venda recebida à vista',
      await submit(cookie, '/comercializacao?novo=1', {
        sale_date: today, buyer_id: buyer.id, quantity: '500', unit: 'kg', price_per_kg: '6,20',
        total_amount: '', plot_id: plot.id, variety_id: '', payment_method: 'Pix',
        received_full: 'on', received_date: today, notes: '',
      }, 'sale_date'), 'Venda registrada')
    expectOk('venda a prazo',
      await submit(cookie, '/comercializacao?novo=1', {
        sale_date: today, buyer_id: buyer.id, quantity: '200', unit: 'kg', price_per_kg: '6',
        total_amount: '', plot_id: '', variety_id: '', payment_method: '', due_date: today, notes: '',
      }, 'sale_date'), 'Venda registrada')

    console.log('\nCustos, campo e estoque')
    // Despesa paga: sem vencimento.
    expectOk('despesa já paga (sem vencimento na tela)',
      await submit(cookie, '/custos?novo=1', {
        category: 'mao_de_obra', description: 'Diária', amount: '2400', expense_date: today,
        plot_id: '', status: 'pago', supplier: '',
      }, 'expense_date'), 'Despesa registrada')
    expectOk('aplicação realizada (sem data prevista na tela)',
      await submit(cookie, '/aplicacoes?novo=1', {
        status: 'realizada', application_date: today, plot_id: plot.id, product_id: '',
        product_name: 'Produto Y', active_ingredient: '', dose: '2', dose_unit: 'L/ha', area: '',
        total_quantity: '', spray_volume: '', cost: '150', equipment: '', responsible: '',
      }, 'product_name'), 'Aplicação registrada')
    expectOk('aplicação programada (sem data realizada na tela)',
      await submit(cookie, '/aplicacoes?novo=1', {
        status: 'programada', scheduled_date: today, plot_id: plot.id, product_id: '',
        product_name: 'Produto Z', active_ingredient: '', dose: '', dose_unit: 'L/ha', area: '',
        total_quantity: '', spray_volume: '', cost: '', equipment: '', responsible: '',
      }, 'product_name'), 'Aplicação programada')
    expectOk('adubação',
      await submit(cookie, '/adubacao?novo=1', {
        fertilization_date: today, plot_id: plot.id, product_id: product.id, product_name: 'Adubo X',
        quantity: '10', unit: 'kg', fert_type: '', application_method: '', cost: '', area: '',
        responsible: '',
      }, 'fertilization_date'), 'Adubação registrada')
    expectOk('irrigação',
      await submit(cookie, '/irrigacao?novo=1', {
        irrigation_date: today, plot_id: plot.id, duration_minutes: '', volume_m3: '', method: '',
        cost: '', responsible: '',
      }, 'irrigation_date'), 'Irrigação registrada')
    // Ajuste de inventario: sem custo unitario nem total na tela.
    expectOk('ajuste de estoque (sem custo na tela)',
      await submit(cookie, '/estoque?novo=1', {
        movement_type: 'ajuste', product_id: product.id, quantity: '40', movement_date: today, notes: '',
      }, 'movement_type'), 'Movimento registrado')
    expectOk('compra para o estoque',
      await submit(cookie, '/estoque?novo=1', {
        movement_type: 'entrada', product_id: product.id, quantity: '20', movement_date: today,
        unit_cost: '230', total_cost: '', notes: '', register_expense: 'on',
      }, 'movement_type'), 'Movimento registrado')
  } finally {
    const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
    await pg.connect()
    await pg.query('delete from public.farms where id = $1', [farm.id])
    await pg.end()
    await admin.auth.admin.deleteUser(u.user.id)
  }

  console.log(`\n${'='.repeat(52)}\n${passed} envios passaram, ${failed} falharam\n${'='.repeat(52)}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('\nERRO FATAL:', e.message)
  process.exit(1)
})
