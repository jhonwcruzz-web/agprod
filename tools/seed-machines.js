/**
 * Maquinas e implementos ficticios para a propriedade de demonstracao:
 * 5 maquinas, 5 implementos e um ano de diario (manutencao, consertos,
 * revisoes e abastecimentos).
 *
 * Uso: node tools/seed-machines.js <farm_id> [--reset]
 *
 * Grava pelas mesmas tabelas do app: os triggers lancam cada registro em
 * Custos (maquinas / combustivel) e avancam o horimetro, entao os numeros
 * fecham como num uso real. --reset apaga as maquinas da propriedade; o
 * cascade leva o diario e o trigger leva as despesas geradas por ele.
 *
 * Tambem e' chamado pelo seed-demo.js, para o --reset de la' recriar as
 * maquinas junto com o resto.
 */
const path = require('path')

// Diesel e gasolina na regiao de Petrolina/PE (R$/L).
const DIESEL = 6.35
const GASOLINA = 6.45

const MACHINES = [
  {
    key: 'mf', class: 'maquina', kind: 'Trator', name: 'Trator MF 4275',
    brand: 'Massey Ferguson', model: 'MF 4275', year: 2016, identifier: 'CHS-MF4275-16-0381',
    power_hp: 75, meter_type: 'horas', meterStart: 5760, perDay: 3.0,
    acquisition_date: '2016-03-14', acquisition_value: 145000,
    fuel: { every: 11, liters: [70, 110], price: DIESEL },
    // troca de oleo a cada 250 h; a ultima deixa a proxima ja' vencida
    service: { everyMeter: 250, cost: [780, 980], text: 'Troca de óleo do motor e filtros (óleo, combustível e ar)' },
    extra: [
      { daysAgo: 142, type: 'corretiva', text: 'Troca da bomba hidráulica', cost: 3850, supplier: 'Oficina Irmãos Coelho' },
      { daysAgo: 60, type: 'corretiva', text: 'Reparo no sistema de freio', cost: 1240, supplier: 'Oficina Irmãos Coelho' },
    ],
    supplier: 'Posto São Francisco', shop: 'Oficina Irmãos Coelho',
    notes: 'Trator mais antigo; usado na roçadeira, na grade e na carreta.',
    lastDueOverdue: true,
  },
  {
    key: 'nh', class: 'maquina', kind: 'Trator', name: 'Trator NH TT4.75',
    brand: 'New Holland', model: 'TT4.75', year: 2021, identifier: 'CHS-TT475-21-1127',
    power_hp: 75, meter_type: 'horas', meterStart: 1310, perDay: 2.9,
    acquisition_date: '2021-07-02', acquisition_value: 235000,
    fuel: { every: 10, liters: [65, 105], price: DIESEL },
    service: { everyMeter: 250, cost: [820, 1020], text: 'Troca de óleo do motor e filtros' },
    extra: [
      { daysAgo: 200, type: 'revisao', text: 'Revisão de 2.000 h na concessionária', cost: 4680, supplier: 'Concessionária Agrovale' },
    ],
    supplier: 'Posto São Francisco', shop: 'Concessionária Agrovale',
    notes: 'Trator principal das pulverizações (atomizador).',
  },
  {
    key: 'hilux', class: 'maquina', kind: 'Veículo', name: 'Caminhonete Hilux',
    brand: 'Toyota', model: 'Hilux SR 2.8 4x4', year: 2019, identifier: 'PEB-4J27',
    power_hp: 177, meter_type: 'km', meterStart: 121500, perDay: 72,
    acquisition_date: '2019-05-20', acquisition_value: 210000,
    fuel: { every: 9, liters: [50, 75], price: DIESEL },
    service: { everyMeter: 10000, cost: [690, 890], text: 'Troca de óleo e filtros' },
    extra: [
      { daysAgo: 95, type: 'corretiva', text: 'Troca dos 4 pneus', cost: 3720, supplier: 'Pneus Petrolina' },
      { daysAgo: 250, type: 'revisao', text: 'Revisão de 130.000 km (freios, suspensão e correia)', cost: 2890, supplier: 'Toyota Juazeiro' },
    ],
    supplier: 'Posto Via Petrolina', shop: 'Toyota Juazeiro',
    notes: 'Transporte de insumos, equipe e entregas no packing house.',
  },
  {
    key: 'bomba', class: 'maquina', kind: 'Motobomba', name: 'Motobomba da irrigação',
    brand: 'Schneider', model: 'BC-22 R 15 cv', year: 2018, identifier: 'SCH-BC22-18-7753',
    power_hp: 15, meter_type: 'horas', meterStart: 14100, perDay: 13,
    acquisition_date: '2018-09-10', acquisition_value: 18500,
    // motor eletrico: sem abastecimento (a energia entra como custo de irrigacao)
    fuel: null,
    service: { everyMeter: 1500, cost: [420, 620], text: 'Revisão do selo mecânico e lubrificação dos rolamentos' },
    extra: [
      { daysAgo: 176, type: 'corretiva', text: 'Rebobinamento do motor elétrico', cost: 2950, supplier: 'Eletromotores Vale' },
    ],
    shop: 'Eletromotores Vale',
    notes: 'Bomba principal do sistema de gotejamento.',
  },
  {
    key: 'moto', class: 'maquina', kind: 'Motocicleta', name: 'Moto Bros',
    brand: 'Honda', model: 'NXR 160 Bros', year: 2022, identifier: 'PEC-2H91',
    power_hp: 15, meter_type: 'km', meterStart: 29800, perDay: 24,
    acquisition_date: '2022-02-11', acquisition_value: 17800,
    fuel: { every: 12, liters: [9, 12], price: GASOLINA },
    service: { everyMeter: 3000, cost: [110, 170], text: 'Troca de óleo e regulagem da corrente' },
    extra: [
      { daysAgo: 120, type: 'corretiva', text: 'Troca do kit relação (coroa, pinhão e corrente)', cost: 390, supplier: 'Moto Peças Sertão' },
    ],
    supplier: 'Posto Via Petrolina', shop: 'Moto Peças Sertão',
    notes: 'Ronda dos talhões e recados.',
  },

  // -------------------------------------------------------- implementos
  {
    key: 'atomizador', class: 'implemento', kind: 'Atomizador', name: 'Atomizador Arbus 2000',
    brand: 'Jacto', model: 'Arbus 2000 Valley', year: 2021, identifier: 'JAC-ARB2000-21-0442',
    coupledTo: 'nh', acquisition_date: '2021-08-05', acquisition_value: 98000,
    // manutencao por data: troca de bicos e revisao da bomba a cada ~90 dias
    service: { everyDays: 90, cost: [680, 1150], text: 'Troca dos bicos, membranas e revisão da bomba de pistão' },
    extra: [],
    shop: 'Jacto Revenda Petrolina',
    notes: 'Pulverização de uva e manga.',
    nextDueInDays: 5,
  },
  {
    key: 'rocadeira', class: 'implemento', kind: 'Roçadeira', name: 'Roçadeira RT 150',
    brand: 'Tatu Marchesan', model: 'RT 150', year: 2017, identifier: 'TAT-RT150-17-2210',
    coupledTo: 'mf', acquisition_date: '2017-02-18', acquisition_value: 12000,
    service: { everyDays: 120, cost: [240, 380], text: 'Afiação das facas e lubrificação do cardã' },
    extra: [
      { daysAgo: 8, type: 'corretiva', text: 'Troca das facas e da cruzeta do cardã', cost: 980, supplier: 'Oficina Irmãos Coelho' },
    ],
    shop: 'Oficina Irmãos Coelho',
    notes: 'Roçagem das entrelinhas.',
    status: 'manutencao',
  },
  {
    key: 'grade', class: 'implemento', kind: 'Grade', name: 'Grade aradora 14 discos',
    brand: 'Baldan', model: 'GAPCR 14x26', year: 2015, identifier: 'BAL-GAP14-15-0918',
    coupledTo: 'mf', acquisition_date: '2015-11-03', acquisition_value: 24000,
    service: { everyDays: 180, cost: [350, 520], text: 'Troca de rolamentos e aperto dos discos' },
    extra: [],
    shop: 'Oficina Irmãos Coelho',
    notes: 'Preparo de solo nas reformas de talhão.',
  },
  {
    key: 'carreta', class: 'implemento', kind: 'Carreta', name: 'Carreta agrícola 4 t',
    brand: 'Triton', model: 'CT 4000', year: 2019, identifier: 'TRI-CT4000-19-3316',
    coupledTo: 'mf', acquisition_date: '2019-01-22', acquisition_value: 15500,
    service: { everyDays: 150, cost: [180, 320], text: 'Lubrificação, calibragem e revisão dos rolamentos das rodas' },
    extra: [
      { daysAgo: 210, type: 'corretiva', text: 'Solda no chassi e troca da lona', cost: 860, supplier: 'Serralheria Nordeste' },
    ],
    shop: 'Oficina Irmãos Coelho',
    notes: 'Transporte de caixas da colheita até o galpão.',
  },
  {
    key: 'distribuidor', class: 'implemento', kind: 'Distribuidor de adubo', name: 'Distribuidor Lancer 600',
    brand: 'Jan', model: 'Lancer 600', year: 2022, identifier: 'JAN-LAN600-22-0571',
    coupledTo: 'nh', acquisition_date: '2022-06-09', acquisition_value: 16000,
    service: { everyDays: 120, cost: [160, 290], text: 'Limpeza anticorrosão e lubrificação do disco' },
    extra: [],
    shop: 'Jan Revenda Petrolina',
    notes: 'Adubação de cobertura a lanço.',
  },
]

// ----------------------------------------------------------- utilitarios
function makeRandom(seedValue) {
  let seed = seedValue
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const r2 = (v) => Math.round(v * 100) / 100
const r1 = (v) => Math.round(v * 10) / 10
function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const todayIso = () => new Date().toISOString().slice(0, 10)

/**
 * Safra de uma data. Nas sobreposicoes (2026.2 comeca em 15/04, antes de a
 * 2026.1 terminar), a safra nova so' assume depois de 16 dias — a mesma
 * regra do seed-demo (lancamentos gerais a partir de 01/05 vao para 2026.2).
 */
function seasonFor(seasons, day) {
  const hits = seasons.filter(
    (s) => (!s.start_date || s.start_date <= day) && (!s.end_date || s.end_date >= day),
  )
  if (hits.length === 0) return null
  hits.sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))
  const newest = hits[0]
  if (hits.length > 1 && newest.start_date && day < addDays(newest.start_date, 16)) return hits[1].id
  return newest.id
}

async function must(promise, label) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

// ------------------------------------------------------------------ core
async function resetMachines(db, farmId) {
  // Implementos primeiro nao e' preciso: coupled_to e' "on delete set null".
  await must(db.from('machines').delete().eq('farm_id', farmId), 'reset maquinas')
}

async function seedMachines(db, farmId) {
  const farm = await must(db.from('farms').select('id, name, created_by').eq('id', farmId).single(), 'farm')
  const seasons = await must(db.from('seasons').select('id, name, start_date, end_date').eq('farm_id', farmId), 'safras')
  const USER = farm.created_by
  const rnd = makeRandom(20260926)
  const between = ([a, b]) => a + rnd() * (b - a)
  const END = todayIso()
  // Um ano de diario, mas nunca antes da primeira safra: registro sem safra
  // sumiria das telas filtradas por safra.
  const firstSeason = seasons.map((x) => x.start_date).filter(Boolean).sort()[0]
  const yearAgo = addDays(END, -365)
  const START = firstSeason && firstSeason > yearAgo ? firstSeason : yearAgo

  // 1. maquinas (implementos depois, para acoplar)
  const ids = {}
  for (const cls of ['maquina', 'implemento']) {
    for (const m of MACHINES.filter((x) => x.class === cls)) {
      const row = await must(
        db.from('machines').insert({
          farm_id: farmId, class: m.class, kind: m.kind, name: m.name, brand: m.brand, model: m.model,
          year: m.year, identifier: m.identifier, power_hp: m.class === 'maquina' ? m.power_hp : null,
          meter_type: m.class === 'maquina' ? m.meter_type : 'nenhum',
          // leitura de um ano atras; o diario leva ate' a leitura de hoje
          current_meter: m.class === 'maquina' ? m.meterStart : 0,
          acquisition_date: m.acquisition_date, acquisition_value: m.acquisition_value,
          coupled_to: m.coupledTo ? ids[m.coupledTo] : null,
          status: m.status ?? 'operacional', notes: m.notes,
        }).select('id').single(),
        `maquina ${m.name}`,
      )
      ids[m.key] = row.id
    }
  }

  // 2. diario de um ano
  const logs = []
  const meterAt = (m, day) => r1(m.meterStart + m.perDay * ((Date.parse(day) - Date.parse(START)) / 86_400_000))
  const push = (m, day, fields) =>
    logs.push({
      farm_id: farmId, machine_id: ids[m.key], season_id: seasonFor(seasons, day),
      log_date: day, created_by: USER, ...fields,
    })

  for (const m of MACHINES) {
    const tracks = m.class === 'maquina'

    // abastecimentos
    if (m.fuel) {
      for (let day = addDays(START, Math.floor(rnd() * m.fuel.every)); day <= END; day = addDays(day, m.fuel.every + Math.round(rnd() * 4 - 2))) {
        const liters = r1(between(m.fuel.liters))
        push(m, day, {
          log_type: 'abastecimento', liters, cost: r2(liters * m.fuel.price * (0.97 + rnd() * 0.06)),
          meter_reading: meterAt(m, day), supplier: m.supplier, responsible: 'Genivaldo',
        })
      }
    }

    // manutencao preventiva periodica
    const s = m.service
    const services = []
    if (s.everyMeter) {
      // proxima troca a partir da leitura de um ano atras
      let next = Math.ceil(m.meterStart / s.everyMeter) * s.everyMeter
      const endMeter = meterAt(m, END)
      while (next <= endMeter) {
        const day = addDays(START, Math.floor((next - m.meterStart) / m.perDay))
        services.push({ day, meter: next })
        next += s.everyMeter
      }
    } else {
      for (let day = addDays(START, 20 + Math.floor(rnd() * 30)); day <= END; day = addDays(day, s.everyDays)) {
        services.push({ day })
      }
    }
    // MF: a ultima troca de oleo nao foi feita — o horimetro passou da hora
    // e o painel mostra a manutencao vencida.
    if (m.lastDueOverdue) services.pop()

    services.forEach((sv, i) => {
      const isLast = i === services.length - 1
      let nextDueMeter = null
      let nextDueDate = null
      if (s.everyMeter) {
        nextDueMeter = sv.meter + s.everyMeter
      } else {
        nextDueDate = isLast && m.nextDueInDays != null ? addDays(END, m.nextDueInDays) : addDays(sv.day, s.everyDays)
      }
      push(m, sv.day, {
        log_type: 'preventiva', description: s.text, cost: r2(between(s.cost)),
        meter_reading: tracks ? (sv.meter ?? meterAt(m, sv.day)) : null,
        next_due_meter: tracks ? nextDueMeter : null, next_due_date: nextDueDate,
        supplier: m.shop, responsible: 'Genivaldo',
      })
    })

    // consertos e revisoes pontuais
    for (const e of m.extra) {
      const day = addDays(END, -e.daysAgo)
      push(m, day, {
        log_type: e.type, description: e.text, cost: e.cost,
        meter_reading: tracks ? meterAt(m, day) : null, supplier: e.supplier, responsible: 'Genivaldo',
      })
    }
  }

  logs.sort((a, b) => a.log_date.localeCompare(b.log_date))
  for (let i = 0; i < logs.length; i += 200) {
    await must(db.from('machine_logs').insert(logs.slice(i, i + 200)), 'diario das maquinas')
  }

  return { machines: MACHINES.length, logs: logs.length }
}

module.exports = { seedMachines, resetMachines }

// ------------------------------------------------------------------- CLI
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true })
  const { createClient } = require('@supabase/supabase-js')
  const FARM = process.argv[2]
  const RESET = process.argv.includes('--reset')
  if (!FARM) {
    console.error('Uso: node tools/seed-machines.js <farm_id> [--reset]')
    process.exit(1)
  }
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  ;(async () => {
    if (RESET) await resetMachines(db, FARM)
    const { count } = await db.from('machines').select('id', { count: 'exact', head: true }).eq('farm_id', FARM)
    if (count > 0) {
      console.error('A propriedade ja tem maquinas cadastradas. Use --reset para recriar.')
      process.exit(1)
    }
    const r = await seedMachines(db, FARM)
    console.log(`OK  ${r.machines} maquinas/implementos, ${r.logs} registros no diario`)

    const status = await must(
      db.from('v_machine_status')
        .select('class, name, current_meter, meter_type, maintenance_cost, fuel_cost, fuel_liters, due_level, status')
        .eq('farm_id', FARM).order('class').order('name'),
      'situacao',
    )
    console.log('\nclasse      nome                         uso atual     manutencao   combustivel   proxima')
    for (const s of status) {
      const uso = s.meter_type === 'nenhum' ? '—' : `${Math.round(s.current_meter).toLocaleString('pt-BR')} ${s.meter_type === 'km' ? 'km' : 'h'}`
      console.log(
        `${s.class.padEnd(11)} ${s.name.padEnd(28)} ${uso.padStart(11)} ${('R$ ' + Math.round(s.maintenance_cost).toLocaleString('pt-BR')).padStart(12)} ${('R$ ' + Math.round(s.fuel_cost).toLocaleString('pt-BR')).padStart(13)}   ${s.due_level}${s.status !== 'operacional' ? ' (' + s.status + ')' : ''}`,
      )
    }
  })().catch((e) => {
    console.error('FALHA:', e.message)
    process.exit(1)
  })
}
