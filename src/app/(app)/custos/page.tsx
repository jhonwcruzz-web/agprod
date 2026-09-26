import Link from 'next/link'
import type { Route } from 'next'
import type { Metadata } from 'next'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { getFormOptions } from '@/lib/queries/options'
import { getPlotPerformance } from '@/lib/queries/plot-performance'
import { date, EXPENSE_LABEL, kg, money, num } from '@/lib/format'
import { PageHeader, EmptyState, Badge, Metric, MetricStrip, Section } from '@/components/ui/Layout'
import { ButtonLink } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { ExpenseForm } from '@/components/forms/OperationForms'

export const metadata: Metadata = { title: 'Custos' }

const TABS = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'categorias', label: 'Por categoria' },
  { key: 'talhoes', label: 'Por talhão' },
  { key: 'lancamentos', label: 'Lançamentos' },
]

export default async function CustosPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; novo?: string }>
}) {
  const [ctx, sp] = await Promise.all([requireFarm(), searchParams])
  const supabase = await createClient()
  const tab = sp.aba ?? 'resumo'

  const seasonMatch = ctx.season ? { season_id: ctx.season.id } : {}
  const LIST_LIMIT = 400

  // Totais vem de v_expense_summary (somados no banco, sem limite de linhas).
  // A lista de lancamentos e' so' para exibir — antes os totais eram somados
  // a partir dela e, com mais de 400 despesas, saiam subcontados.
  const [options, expenses, summary, plots, overview] = await Promise.all([
    getFormOptions(ctx.farm.id),
    supabase
      .from('expenses')
      .select('*, plots(code)', { count: 'exact' })
      .eq('farm_id', ctx.farm.id)
      .match(seasonMatch)
      .order('expense_date', { ascending: false })
      .limit(LIST_LIMIT),
    supabase.from('v_expense_summary').select('*').eq('farm_id', ctx.farm.id).match(seasonMatch),
    getPlotPerformance(ctx.farm.id, ctx.season?.id),
    ctx.season
      ? supabase
          .from('v_farm_overview')
          .select('production_kg')
          .eq('farm_id', ctx.farm.id)
          .eq('season_id', ctx.season.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const rows = expenses.data ?? []
  const totalEntries = expenses.count ?? rows.length
  const sums = summary.data ?? []

  const productionCost = sums
    .filter((r) => r.is_production_cost)
    .reduce((s, r) => s + Number(r.amount ?? 0), 0)
  const cashOut = sums.reduce((s, r) => s + Number(r.amount ?? 0), 0)
  // Producao da safra inteira (mesmo numero do painel), nao so' dos talhoes.
  const totalProduction = overview.data
    ? Number(overview.data.production_kg ?? 0)
    : plots.reduce((s, p) => s + Number(p.production_kg ?? 0), 0)
  const totalArea = plots.reduce((s, p) => s + Number(p.area ?? 0), 0)

  const byCategory = new Map<string, number>()
  for (const r of sums) {
    if (!r.is_production_cost || !r.category) continue
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + Number(r.amount ?? 0))
  }

  const unallocated = sums
    .filter((r) => r.is_production_cost && r.unallocated)
    .reduce((s, r) => s + Number(r.amount ?? 0), 0)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Custos"
        subtitle={ctx.season ? `Safra ${ctx.season.name}` : undefined}
        actions={<ButtonLink href="/custos?novo=1">Registrar despesa</ButtonLink>}
      />

      {sp.novo === '1' && <ExpenseForm plots={options.plots} closeHref="/custos" />}

      <MetricStrip>
        <Metric label="Custo de produção" value={money(productionCost, { compact: true })} />
        <Metric
          label="Custo por kg"
          value={totalProduction > 0 ? money(productionCost / totalProduction) : '—'}
        />
        <Metric
          label="Custo por hectare"
          value={totalArea > 0 ? money(productionCost / totalArea, { compact: true }) : '—'}
        />
        <Metric label="Saída de caixa" value={money(cashOut, { compact: true })} />
        <Metric label="Produção" value={kg(totalProduction, { asTon: true })} />
      </MetricStrip>

      <Tabs items={TABS} />

      {tab === 'resumo' && (
        <>
          <Section
            title="Como o custo se divide"
            description="Aplicações, adubações e irrigações lançam o custo aqui automaticamente."
          >
            {byCategory.size === 0 ? (
              <EmptyState
                title="Nenhum custo lançado"
                description="Registre a primeira despesa — mão de obra, diesel, energia — e o custo por quilo passa a ser calculado."
                action={<ButtonLink href="/custos?novo=1">Registrar despesa</ButtonLink>}
              />
            ) : (
              <ul className="divide-y divide-line">
                {[...byCategory.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amount]) => {
                    const share = (amount / productionCost) * 100
                    return (
                      <li key={cat} className="py-3">
                        <div className="flex items-baseline justify-between gap-4 text-sm">
                          <span>{EXPENSE_LABEL[cat] ?? cat}</span>
                          <span className="num font-medium">{money(amount)}</span>
                          <span className="num w-12 shrink-0 text-right text-xs text-text-faint">
                            {share.toFixed(0)}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-bg-sunken">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${share.toFixed(1)}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
              </ul>
            )}
          </Section>

          {cashOut > productionCost && (
            <Section title="Compras para estoque">
              <p className="max-w-[70ch] text-sm leading-relaxed text-text-muted">
                {money(cashOut - productionCost)} saíram do caixa para comprar insumos que ainda
                estão no estoque. Esse valor aparece no Financeiro, mas ainda não entra no custo
                por quilo — ele será contado quando o insumo for aplicado no talhão.
              </p>
            </Section>
          )}
        </>
      )}

      {tab === 'categorias' && (
        <Section title="Custo por categoria">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[420px] table-fixed border-collapse text-sm">
              <colgroup>
                <col style={{ width: '46%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-line-strong text-left">
                  {['Categoria', 'Valor', 'Por hectare', '%'].map((h, i) => (
                    <th
                      key={h}
                      className={`pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-faint ${i > 0 ? 'text-right' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...byCategory.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amount]) => (
                    <tr key={cat}>
                      <td className="py-2.5">{EXPENSE_LABEL[cat] ?? cat}</td>
                      <td className="num py-2.5 text-right">{money(amount)}</td>
                      <td className="num py-2.5 text-right text-text-muted">
                        {totalArea > 0 ? money(amount / totalArea) : '—'}
                      </td>
                      <td className="num py-2.5 text-right text-text-faint">
                        {((amount / productionCost) * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line-strong font-medium">
                  <td className="py-2.5">Total</td>
                  <td className="num py-2.5 text-right">{money(productionCost)}</td>
                  <td className="num py-2.5 text-right">
                    {totalArea > 0 ? money(productionCost / totalArea) : '—'}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Section>
      )}

      {tab === 'talhoes' && (
        <Section
          title="Custo por talhão"
          description={
            unallocated > 0
              ? `${money(unallocated)} em custos gerais ainda não vinculados a um talhão.`
              : undefined
          }
        >
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[560px] table-fixed border-collapse text-sm">
              <colgroup>
                <col style={{ width: '16%' }} />
                <col style={{ width: '21%' }} />
                <col style={{ width: '21%' }} />
                <col style={{ width: '21%' }} />
                <col style={{ width: '21%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-line-strong text-left">
                  {['Talhão', 'Custo', 'Produção', 'Custo/kg', 'Custo/ha'].map((h, i) => (
                    <th
                      key={h}
                      className={`pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-faint ${i > 0 ? 'text-right' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {plots.map((p) => (
                  <tr key={p.plot_id} className="transition-colors hover:bg-bg-sunken/60">
                    <td className="py-2.5">
                      <Link
                        href={`/talhoes/${p.plot_id}?aba=custos` as Route}
                        className="num font-medium hover:text-accent-text"
                      >
                        {p.code}
                      </Link>
                    </td>
                    <td className="num py-2.5 text-right">{money(Number(p.total_cost ?? 0))}</td>
                    <td className="num py-2.5 text-right text-text-muted">
                      {kg(Number(p.production_kg ?? 0))}
                    </td>
                    <td className="num py-2.5 text-right font-medium">
                      {p.cost_per_kg ? money(Number(p.cost_per_kg)) : '—'}
                    </td>
                    <td className="num py-2.5 text-right text-text-muted">
                      {Number(p.area ?? 0) > 0
                        ? money(Number(p.total_cost ?? 0) / Number(p.area))
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tab === 'lancamentos' && (
        <Section
          title="Lançamentos"
          description={
            totalEntries > rows.length
              ? `Mostrando os ${rows.length} mais recentes de ${totalEntries}. Os totais acima somam todos.`
              : undefined
          }
        >
          {rows.length === 0 ? (
            <EmptyState title="Nenhuma despesa registrada" />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                  <span className="num w-20 shrink-0 text-text-muted">{date(r.expense_date)}</span>
                  <span className="w-14 shrink-0 text-xs text-text-faint">
                    {(r.plots as { code: string } | null)?.code ?? '—'}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{r.description}</span>
                  <span className="shrink-0 text-xs text-text-faint">
                    {EXPENSE_LABEL[r.category] ?? r.category}
                  </span>
                  {!r.is_production_cost && <Badge>estoque</Badge>}
                  {r.status !== 'pago' && <Badge tone="warn">a pagar</Badge>}
                  <span className="num w-24 shrink-0 text-right font-medium">
                    {money(Number(r.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  )
}
