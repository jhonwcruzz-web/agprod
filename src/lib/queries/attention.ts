import { createClient } from '@/lib/supabase/server'
import { money, kg, relativeDay } from '@/lib/format'

export type AttentionItem = {
  id: string
  severity: 'critico' | 'atencao' | 'ok'
  text: string
  href?: string
}

const DAYS_WITHOUT_IRRIGATION = 3

/**
 * "O que precisa da minha atencao?" (secao 24).
 *
 * O painel nao mostra graficos: mostra problemas. Cada item precisa ser
 * acionavel — por isso todos levam para a tela onde se resolve.
 */
export async function getAttentionItems(farmId: string, seasonId?: string) {
  const supabase = await createClient()
  const todayIso = new Date().toISOString().slice(0, 10)

  const [stock, openSales, dueExpenses, scheduled, plots, week] = await Promise.all([
    supabase
      .from('v_stock_status')
      .select('product_id, name, current_stock, min_stock, unit, stock_level')
      .eq('farm_id', farmId)
      .in('stock_level', ['baixo', 'critico']),

    supabase
      .from('sales')
      .select('id, total_amount, received_amount')
      .eq('farm_id', farmId)
      .neq('status', 'pago'),

    supabase
      .from('expenses')
      .select('id, amount, paid_amount')
      .eq('farm_id', farmId)
      .neq('status', 'pago')
      .not('due_date', 'is', null)
      .lte('due_date', todayIso),

    supabase
      .from('applications')
      .select('id, product_name, scheduled_date, plot_id')
      .eq('farm_id', farmId)
      .eq('status', 'programada')
      .not('scheduled_date', 'is', null)
      .lte('scheduled_date', new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10))
      .order('scheduled_date'),

    supabase.from('plots').select('id, code, status').eq('farm_id', farmId).eq('status', 'producao'),

    supabase
      .from('activities')
      .select('id, done')
      .eq('farm_id', farmId)
      .gte('due_date', new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10))
      .lte('due_date', todayIso),
  ])

  const items: AttentionItem[] = []

  // --- estoque abaixo do minimo
  for (const p of stock.data ?? []) {
    items.push({
      id: `estoque-${p.product_id}`,
      severity: p.stock_level === 'critico' ? 'critico' : 'atencao',
      text: `${p.name} ${p.stock_level === 'critico' ? 'em nível crítico' : 'abaixo do mínimo'} — ${p.current_stock} ${p.unit} de ${p.min_stock} ${p.unit}`,
      href: '/estoque?aba=alertas',
    })
  }

  // --- a receber
  const receivable = (openSales.data ?? []).reduce(
    (s, v) => s + (Number(v.total_amount) - Number(v.received_amount)),
    0,
  )
  if (receivable > 0) {
    items.push({
      id: 'a-receber',
      severity: 'atencao',
      text: `${openSales.data!.length} venda${openSales.data!.length > 1 ? 's' : ''} sem recebimento — ${money(receivable)} a receber`,
      href: '/comercializacao?aba=receber',
    })
  }

  // --- contas vencidas
  const overdue = (dueExpenses.data ?? []).reduce(
    (s, v) => s + (Number(v.amount) - Number(v.paid_amount)),
    0,
  )
  if (overdue > 0) {
    items.push({
      id: 'vencidas',
      severity: 'critico',
      text: `${money(overdue)} em contas vencidas`,
      href: '/financeiro?aba=pagar',
    })
  }

  // --- aplicacoes programadas
  for (const a of scheduled.data ?? []) {
    items.push({
      id: `aplic-${a.id}`,
      severity: 'atencao',
      text: `Aplicação de ${a.product_name} prevista ${relativeDay(a.scheduled_date)}`,
      href: '/aplicacoes?aba=programadas',
    })
  }

  // --- talhoes sem irrigacao registrada
  const plotList = plots.data ?? []
  if (plotList.length > 0) {
    const { data: lastIrrigation } = await supabase
      .from('irrigation_records')
      .select('plot_id, irrigation_date')
      .eq('farm_id', farmId)
      .order('irrigation_date', { ascending: false })

    const lastByPlot = new Map<string, string>()
    for (const r of lastIrrigation ?? []) {
      if (r.plot_id && !lastByPlot.has(r.plot_id)) lastByPlot.set(r.plot_id, r.irrigation_date!)
    }

    // So' alerta quando ja' existe historico: uma propriedade que nunca
    // registrou irrigacao nao deve receber um alerta por talhao.
    if (lastByPlot.size > 0) {
      for (const p of plotList) {
        const last = lastByPlot.get(p.id)
        if (!last) continue
        const days = Math.round(
          (Date.parse(todayIso) - Date.parse(last)) / 86_400_000,
        )
        if (days >= DAYS_WITHOUT_IRRIGATION) {
          items.push({
            id: `irrig-${p.id}`,
            severity: days >= DAYS_WITHOUT_IRRIGATION * 2 ? 'critico' : 'atencao',
            text: `${p.code} sem irrigação registrada há ${days} dias`,
            href: `/talhoes/${p.id}?aba=irrigacao`,
          })
        }
      }
    }
  }

  // --- manutencao de maquina vencida ou chegando (horas ou data)
  const { data: machines } = await supabase
    .from('v_machine_status')
    .select('machine_id, name, due_level, next_due_date, next_due_meter, meter_type')
    .eq('farm_id', farmId)
    .in('due_level', ['vencida', 'proxima'])

  for (const m of machines ?? []) {
    const unit = m.meter_type === 'km' ? 'km' : 'h'
    const when =
      m.next_due_date && m.next_due_meter != null
        ? `${relativeDay(m.next_due_date)} ou com ${m.next_due_meter} ${unit}`
        : m.next_due_date
          ? relativeDay(m.next_due_date)
          : `com ${m.next_due_meter} ${unit}`
    items.push({
      id: `maquina-${m.machine_id}`,
      severity: m.due_level === 'vencida' ? 'critico' : 'atencao',
      text:
        m.due_level === 'vencida'
          ? `Manutenção do ${m.name} vencida (${when})`
          : `Manutenção do ${m.name} vence ${when}`,
      href: `/maquinas/${m.machine_id}`,
    })
  }

  // --- percentual de atividades concluidas na semana
  const weekRows = week.data ?? []
  const done = weekRows.filter((a) => a.done).length
  const completion = weekRows.length > 0 ? Math.round((done / weekRows.length) * 100) : null

  const order = { critico: 0, atencao: 1, ok: 2 }
  items.sort((a, b) => order[a.severity] - order[b.severity])

  return { items, completion, seasonId }
}

/** Situacao de cada talhao para o semaforo do painel (secao 23). */
export function plotLevel(alerts: AttentionItem[], plotCode: string, plotId: string) {
  const mine = alerts.filter((a) => a.id.endsWith(plotId) || a.text.startsWith(plotCode + ' '))
  if (mine.some((a) => a.severity === 'critico')) return 'critico' as const
  if (mine.length > 0) return 'atencao' as const
  return 'normal' as const
}

export { money, kg }
