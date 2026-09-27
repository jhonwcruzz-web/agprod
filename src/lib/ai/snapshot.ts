import { createClient } from '@/lib/supabase/server'
import type { FarmContext } from '@/lib/farm'
import { getExpenseCategoryNames } from '@/lib/queries/options'
import { getPlotPerformance } from '@/lib/queries/plot-performance'

/**
 * Retrato numerico da propriedade.
 *
 * Todos os calculos acontecem aqui, no Postgres e em JS — a IA nunca faz
 * conta. Ela recebe os numeros ja' fechados e apenas os explica. E' isso
 * que garante que a resposta da IA bate com a tela.
 */
export type FarmSnapshot = {
  farm: { name: string; city: string | null; state: string | null; area: number; areaUnit: string }
  season: string | null
  totals: {
    productionKg: number
    soldKg: number
    revenue: number
    received: number
    receivable: number
    productionCost: number
    cashOut: number
    payable: number
    result: number
    costPerKg: number | null
    avgPricePerKg: number | null
  }
  monthExpenses: { month: string; total: number }
  plots: {
    code: string
    crop: string | null
    variety: string | null
    areaHa: number
    productionKg: number
    cost: number
    costPerKg: number | null
    revenue: number
    result: number
  }[]
  costsByCategory: { category: string; amount: number }[]
  stock: { name: string; current: number; min: number; unit: string; level: string }[]
  buyers: { name: string; kg: number; amount: number; avgPrice: number | null }[]
  openSales: { buyer: string; amount: number; pending: number; dueDate: string | null }[]
}

const n = (v: unknown) => Number(v ?? 0)

export async function buildFarmSnapshot(ctx: FarmContext): Promise<FarmSnapshot> {
  const supabase = await createClient()
  const catNames = await getExpenseCategoryNames()
  const farmId = ctx.farm.id

  const monthStart = new Date()
  monthStart.setDate(1)
  const monthStartIso = monthStart.toISOString().slice(0, 10)

  const [overview, plots, costs, stock, buyers, openSales, monthExp] = await Promise.all([
    supabase
      .from('v_farm_overview')
      .select('*')
      .eq('farm_id', farmId)
      .eq('season_id', ctx.season?.id ?? '')
      .maybeSingle(),
    // Mesma safra dos totais: sem isso a IA citava custo de talhao somado
    // de todas as safras ao lado do total da safra ativa.
    getPlotPerformance(farmId, ctx.season?.id),
    supabase
      .from('v_expense_summary')
      .select('category, amount')
      .eq('farm_id', farmId)
      .eq('is_production_cost', true)
      .match(ctx.season ? { season_id: ctx.season.id } : {}),
    supabase
      .from('v_stock_status')
      .select('name, current_stock, min_stock, unit, stock_level')
      .eq('farm_id', farmId),
    supabase.from('v_buyer_prices').select('*').eq('farm_id', farmId),
    supabase
      .from('sales')
      .select('total_amount, received_amount, due_date, buyers(name)')
      .eq('farm_id', farmId)
      .neq('status', 'pago'),
    supabase
      .from('expenses')
      .select('amount')
      .eq('farm_id', farmId)
      .gte('expense_date', monthStartIso),
  ])

  const o = overview.data
  const byCategory = new Map<string, number>()
  for (const r of costs.data ?? []) {
    if (!r.category) continue
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + n(r.amount))
  }

  return {
    farm: {
      name: ctx.farm.name,
      city: ctx.farm.city,
      state: ctx.farm.state,
      area: n(ctx.farm.total_area),
      areaUnit: ctx.farm.area_unit,
    },
    season: ctx.season?.name ?? null,
    totals: {
      productionKg: n(o?.production_kg),
      soldKg: n(o?.sold_kg),
      revenue: n(o?.revenue),
      received: n(o?.received),
      receivable: n(o?.receivable),
      productionCost: n(o?.production_cost),
      cashOut: n(o?.cash_out),
      payable: n(o?.payable),
      result: n(o?.result),
      costPerKg: o?.cost_per_kg ? n(o.cost_per_kg) : null,
      avgPricePerKg: o?.avg_price_per_kg ? n(o.avg_price_per_kg) : null,
    },
    monthExpenses: {
      month: monthStartIso.slice(0, 7),
      total: (monthExp.data ?? []).reduce((s, r) => s + n(r.amount), 0),
    },
    plots: plots.map((p) => ({
      code: p.code ?? '',
      crop: p.crop_name,
      variety: p.variety_name,
      areaHa: n(p.area),
      productionKg: n(p.production_kg),
      cost: n(p.total_cost),
      costPerKg: p.cost_per_kg ? n(p.cost_per_kg) : null,
      revenue: n(p.revenue),
      result: n(p.result),
    })),
    costsByCategory: [...byCategory.entries()]
      .map(([category, amount]) => ({ category: catNames.get(category) ?? category, amount }))
      .sort((a, b) => b.amount - a.amount),
    stock: (stock.data ?? []).map((s) => ({
      name: s.name ?? '',
      current: n(s.current_stock),
      min: n(s.min_stock),
      unit: s.unit ?? '',
      level: s.stock_level ?? 'normal',
    })),
    buyers: (buyers.data ?? []).map((b) => ({
      name: b.buyer_name ?? 'Sem comprador',
      kg: n(b.total_kg),
      amount: n(b.total_amount),
      avgPrice: b.avg_price_per_kg ? n(b.avg_price_per_kg) : null,
    })),
    openSales: (openSales.data ?? []).map((s) => ({
      buyer: (s.buyers as { name: string } | null)?.name ?? 'Sem comprador',
      amount: n(s.total_amount),
      pending: n(s.total_amount) - n(s.received_amount),
      dueDate: s.due_date,
    })),
  }
}
