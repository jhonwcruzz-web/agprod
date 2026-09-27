import Link from 'next/link'
import type { Metadata, Route } from 'next'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { getFormOptions } from '@/lib/queries/options'
import { byDate, eqIf, readFilters } from '@/lib/filters'
import { closeLink, editLink } from '@/lib/url'
import { date, money, num, UNIT_LABEL } from '@/lib/format'
import { EmptyState, Metric, MetricStrip, PageHeader, Section } from '@/components/ui/Layout'
import { ButtonLink } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { FilterBar } from '@/components/ui/FilterBar'
import { RowActions } from '@/components/ui/RowActions'
import { FertilizationForm } from '@/components/forms/FertilizationForm'

export const metadata: Metadata = { title: 'Adubação' }

type SP = Record<string, string | undefined>

const TABS = [
  { key: 'lancamentos', label: 'Lançamentos' },
  { key: 'talhoes', label: 'Por talhão' },
  { key: 'produtos', label: 'Por produto' },
]

export default async function AdubacaoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [ctx, sp] = await Promise.all([requireFarm(), searchParams])
  const supabase = await createClient()
  const tab = sp.aba ?? 'lancamentos'
  const f = readFilters(sp)

  let q = supabase
    .from('fertilizations')
    .select(
      '*, plots(code, name), machine:machines!fertilizations_machine_id_fkey(name), implement:machines!fertilizations_implement_id_fkey(name)',
      { count: 'exact' },
    )
    .eq('farm_id', ctx.farm.id)
  if (ctx.season) q = q.eq('season_id', ctx.season.id)
  q = eqIf(eqIf(eqIf(byDate(q, 'fertilization_date', f), 'plot_id', f.talhao), 'machine_id', f.maquina), 'product_id', f.produto)

  const [options, ferts, editing] = await Promise.all([
    getFormOptions(ctx.farm.id),
    q.order('fertilization_date', { ascending: false }).limit(1000),
    sp.editar
      ? supabase.from('fertilizations').select('*').eq('id', sp.editar).eq('farm_id', ctx.farm.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const rows = ferts.data ?? []
  const total = ferts.count ?? rows.length
  const totalCost = rows.reduce((s, r) => s + Number(r.cost), 0)
  const plotsArea = options.plots.reduce((s, p) => s + Number(p.area), 0)

  const byPlot = new Map<string, { code: string; amount: number; qty: number }>()
  for (const r of rows) {
    const key = (r.plots as { code: string } | null)?.code ?? 'Sem talhão'
    const cur = byPlot.get(key) ?? { code: key, amount: 0, qty: 0 }
    cur.amount += Number(r.cost)
    cur.qty += Number(r.quantity)
    byPlot.set(key, cur)
  }
  const byProduct = new Map<string, { amount: number; qty: number; unit: string }>()
  for (const r of rows) {
    const cur = byProduct.get(r.product_name) ?? { amount: 0, qty: 0, unit: r.unit }
    cur.amount += Number(r.cost)
    cur.qty += Number(r.quantity)
    byProduct.set(r.product_name, cur)
  }

  const formProps = {
    plots: options.plots,
    products: options.products,
    tractors: options.tractors,
    implements: options.implements,
    closeHref: closeLink('/adubacao', sp),
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Adubação"
        subtitle={`${ctx.season ? `Safra ${ctx.season.name}` : 'Todas as safras'}${
          total > rows.length ? ` · mostrando ${rows.length} de ${total}` : ''
        }`}
        actions={<ButtonLink href="/adubacao?novo=1">Registrar adubação</ButtonLink>}
      />

      {sp.novo === '1' && <FertilizationForm {...formProps} />}
      {editing.data && <FertilizationForm key={editing.data.id} {...formProps} initial={editing.data} />}

      <MetricStrip>
        <Metric label="Lançamentos" value={num(rows.length)} />
        <Metric label="Custo" value={money(totalCost, { compact: true })} />
        <Metric label="Custo por hectare" value={plotsArea > 0 ? money(totalCost / plotsArea) : '—'} />
      </MetricStrip>

      <FilterBar
        exportType="adubacoes"
        selects={[
          { param: 'talhao', label: 'Talhão', options: options.plots.map((p) => ({ value: p.id, label: p.code })) },
          { param: 'produto', label: 'Produto', options: options.products.map((p) => ({ value: p.id, label: p.name })) },
          { param: 'maquina', label: 'Trator', options: options.tractors.map((m) => ({ value: m.id, label: m.name })) },
        ]}
      />

      <Tabs items={TABS} />

      {tab === 'lancamentos' && (
        <Section>
          {rows.length === 0 ? (
            <EmptyState
              title="Nenhuma adubação no período"
              description="Escolha o fertilizante do estoque e a dose: a baixa e o custo acontecem sozinhos."
              action={<ButtonLink href="/adubacao?novo=1">Registrar adubação</ButtonLink>}
            />
          ) : (
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[860px] table-fixed border-collapse text-sm">
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '8%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-line-strong text-left">
                    {[
                      ['Data', ''], ['Talhão', ''], ['Produto', ''], ['Quantidade', 'text-right'],
                      ['Dose/ha', 'text-right'], ['Trator / implemento', 'pl-4'], ['Custo', 'text-right'], ['', ''],
                    ].map(([h, cls], i) => (
                      <th key={i} className={`pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-faint ${cls}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => {
                    const plot = r.plots as { code: string } | null
                    const machine = (r.machine as { name: string } | null)?.name
                    const impl = (r.implement as { name: string } | null)?.name
                    return (
                      <tr key={r.id} className="transition-colors hover:bg-bg-sunken/60">
                        <td className="num py-2.5 text-text-muted">{date(r.fertilization_date)}</td>
                        <td className="num py-2.5">
                          {plot ? (
                            <Link href={`/talhoes/${r.plot_id}?aba=adubacao` as Route} className="font-medium hover:text-accent-text">
                              {plot.code}
                            </Link>
                          ) : (
                            <span className="text-text-faint">—</span>
                          )}
                        </td>
                        <td className="truncate py-2.5 pr-3">
                          {r.product_name}
                          {r.fert_type && <span className="ml-2 text-xs text-text-faint">{r.fert_type}</span>}
                        </td>
                        <td className="num py-2.5 text-right">
                          {num(Number(r.quantity), 2)} {UNIT_LABEL[r.unit]}
                        </td>
                        <td className="num py-2.5 text-right text-text-muted">
                          {r.dose_per_ha ? num(Number(r.dose_per_ha), 2) : '—'}
                        </td>
                        <td className="truncate py-2.5 pl-4 text-text-muted">
                          {[machine, impl].filter(Boolean).join(' + ') || '—'}
                        </td>
                        <td className="num py-2.5 text-right font-medium">{money(Number(r.cost))}</td>
                        <td className="py-2 text-right">
                          <RowActions id={r.id} kind="adubacao" editHref={editLink('/adubacao', sp, r.id)} confirm="Excluir? O estoque volta." />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {tab === 'talhoes' && (
        <Section title="Adubação por talhão">
          <ul className="divide-y divide-line">
            {[...byPlot.values()]
              .sort((a, b) => b.amount - a.amount)
              .map((r) => (
                <li key={r.code} className="flex items-baseline gap-4 py-3 text-sm">
                  <span className="num w-14 font-medium">{r.code}</span>
                  <span className="num flex-1 text-text-muted">{num(r.qty)}</span>
                  <span className="num font-medium">{money(r.amount)}</span>
                </li>
              ))}
          </ul>
        </Section>
      )}

      {tab === 'produtos' && (
        <Section title="Adubação por produto">
          <ul className="divide-y divide-line">
            {[...byProduct.entries()]
              .sort((a, b) => b[1].amount - a[1].amount)
              .map(([name, r]) => (
                <li key={name} className="flex items-baseline gap-4 py-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <span className="num text-text-muted">
                    {num(r.qty, 2)} {UNIT_LABEL[r.unit]}
                  </span>
                  <span className="num w-28 text-right font-medium">{money(r.amount)}</span>
                </li>
              ))}
          </ul>
        </Section>
      )}
    </div>
  )
}
