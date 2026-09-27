import Link from 'next/link'
import type { Metadata, Route } from 'next'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { getFormOptions } from '@/lib/queries/options'
import { byDate, eqIf, readFilters } from '@/lib/filters'
import { closeLink, editLink } from '@/lib/url'
import { date, money, num, relativeDay } from '@/lib/format'
import { Badge, EmptyState, Metric, MetricStrip, PageHeader, Section } from '@/components/ui/Layout'
import { ButtonLink } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { FilterBar } from '@/components/ui/FilterBar'
import { RowActions } from '@/components/ui/RowActions'
import { SprayForm } from '@/components/forms/SprayForm'
import { CompleteApplicationButton } from './CompleteApplicationButton'

export const metadata: Metadata = { title: 'Pulverização' }

type SP = Record<string, string | undefined>

export default async function PulverizacaoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [ctx, sp] = await Promise.all([requireFarm(), searchParams])
  const supabase = await createClient()
  const tab = sp.aba ?? 'realizadas'
  const f = readFilters(sp)

  let q = supabase
    .from('applications')
    .select(
      '*, plots(code, name), products(unit), machine:machines!applications_machine_id_fkey(name), implement:machines!applications_implement_id_fkey(name)',
      { count: 'exact' },
    )
    .eq('farm_id', ctx.farm.id)
  if (ctx.season) q = q.eq('season_id', ctx.season.id)
  q = eqIf(eqIf(eqIf(byDate(q, 'application_date', f), 'plot_id', f.talhao), 'machine_id', f.maquina), 'product_id', f.produto)

  const [options, apps, editing] = await Promise.all([
    getFormOptions(ctx.farm.id),
    q.order('application_date', { ascending: false, nullsFirst: true }).limit(1000),
    sp.editar
      ? supabase.from('applications').select('*').eq('id', sp.editar).eq('farm_id', ctx.farm.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const rows = apps.data ?? []
  const total = apps.count ?? rows.length
  const done = rows.filter((r) => r.status === 'realizada')
  const scheduled = rows.filter((r) => r.status === 'programada')
  const pending = rows.filter((r) => r.status === 'pendente')
  const totalCost = done.reduce((s, r) => s + Number(r.cost), 0)

  const TABS = [
    { key: 'realizadas', label: 'Realizadas', count: done.length },
    { key: 'programadas', label: 'Programadas', count: scheduled.length },
    { key: 'pendentes', label: 'Pendentes', count: pending.length },
    { key: 'custos', label: 'Custos' },
  ]
  const list = tab === 'programadas' ? scheduled : tab === 'pendentes' ? pending : done

  // Custo acumulado por talhao (aba Custos).
  const byPlot = new Map<string, { code: string; amount: number }>()
  for (const r of done) {
    const key = (r.plots as { code: string } | null)?.code ?? 'Sem talhão'
    const cur = byPlot.get(key) ?? { code: key, amount: 0 }
    cur.amount += Number(r.cost)
    byPlot.set(key, cur)
  }

  const formProps = {
    plots: options.plots,
    products: options.products,
    tractors: options.tractors,
    implements: options.implements,
    closeHref: closeLink('/pulverizacao', sp),
  }
  const editHref = (id: string) => editLink('/pulverizacao', sp, id)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Pulverização"
        subtitle={`${ctx.season ? `Safra ${ctx.season.name}` : 'Todas as safras'}${
          total > rows.length ? ` · mostrando ${rows.length} de ${total}` : ''
        }`}
        actions={<ButtonLink href="/pulverizacao?novo=1">Registrar pulverização</ButtonLink>}
      />

      {sp.novo === '1' && <SprayForm {...formProps} />}
      {editing.data && <SprayForm key={editing.data.id} {...formProps} initial={editing.data} />}

      <MetricStrip>
        <Metric label="Realizadas" value={num(done.length)} />
        <Metric label="Programadas" value={num(scheduled.length)} tone={scheduled.length ? 'warn' : 'neutral'} />
        <Metric label="Custo" value={money(totalCost, { compact: true })} />
      </MetricStrip>

      <FilterBar
        exportType="pulverizacoes"
        selects={[
          { param: 'talhao', label: 'Talhão', options: options.plots.map((p) => ({ value: p.id, label: p.code })) },
          { param: 'produto', label: 'Produto', options: options.products.map((p) => ({ value: p.id, label: p.name })) },
          { param: 'maquina', label: 'Trator', options: options.tractors.map((m) => ({ value: m.id, label: m.name })) },
        ]}
      />

      <Tabs items={TABS} />

      {tab === 'custos' ? (
        <Section title="Custo de pulverização por talhão">
          {byPlot.size === 0 ? (
            <EmptyState title="Nenhum custo de pulverização no período" />
          ) : (
            <ul className="divide-y divide-line">
              {[...byPlot.values()]
                .sort((a, b) => b.amount - a.amount)
                .map((r) => {
                  const share = totalCost > 0 ? (r.amount / totalCost) * 100 : 0
                  return (
                    <li key={r.code} className="py-3">
                      <div className="flex items-baseline justify-between gap-4 text-sm">
                        <span className="num font-medium">{r.code}</span>
                        <span className="num">{money(r.amount)}</span>
                      </div>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-bg-sunken">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${share.toFixed(1)}%` }} />
                      </div>
                    </li>
                  )
                })}
              <li className="flex items-baseline justify-between gap-4 pt-4 text-sm">
                <span className="text-text-muted">Total</span>
                <span className="num font-semibold">{money(totalCost)}</span>
              </li>
            </ul>
          )}
        </Section>
      ) : (
        <Section>
          {list.length === 0 ? (
            <EmptyState
              title={
                tab === 'programadas'
                  ? 'Nenhuma pulverização programada'
                  : tab === 'pendentes'
                    ? 'Nenhuma pulverização pendente'
                    : 'Nenhuma pulverização no período'
              }
              description={
                tab === 'realizadas'
                  ? 'Escolha o produto do estoque e informe a dose: a baixa e o custo acontecem sozinhos.'
                  : undefined
              }
              action={<ButtonLink href="/pulverizacao?novo=1">Registrar pulverização</ButtonLink>}
            />
          ) : (
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[900px] table-fixed border-collapse text-sm">
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '9%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-line-strong text-left">
                    {[
                      ['Data', ''], ['Talhão', ''], ['Produto', ''], ['Dose', 'text-right'],
                      ['Gasto', 'text-right'], ['Trator / implemento', 'pl-4'], ['Custo', 'text-right'], ['', ''],
                    ].map(([h, cls], i) => (
                      <th key={i} className={`pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-faint ${cls}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map((r) => {
                    const plot = r.plots as { code: string } | null
                    const unit = (r.products as { unit: string } | null)?.unit ?? ''
                    const when = r.application_date ?? r.scheduled_date
                    const machine = (r.machine as { name: string } | null)?.name
                    const impl = (r.implement as { name: string } | null)?.name
                    return (
                      <tr key={r.id} className="align-top transition-colors hover:bg-bg-sunken/60">
                        <td className="num py-2.5 text-text-muted">
                          {date(when)}
                          {r.status === 'programada' && (
                            <span className="mt-1 block">
                              <Badge tone="warn">{relativeDay(r.scheduled_date)}</Badge>
                            </span>
                          )}
                        </td>
                        <td className="num py-2.5">
                          {plot ? (
                            <Link href={`/talhoes/${r.plot_id}?aba=aplicacoes` as Route} className="font-medium hover:text-accent-text">
                              {plot.code}
                            </Link>
                          ) : (
                            <span className="text-text-faint">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="block truncate">{r.product_name}</span>
                          {r.active_ingredient && (
                            <span className="block truncate text-xs text-text-faint">{r.active_ingredient}</span>
                          )}
                        </td>
                        <td className="num py-2.5 text-right text-text-muted">
                          {r.dose ? `${num(Number(r.dose), 2)} ${r.dose_unit ?? ''}` : '—'}
                        </td>
                        <td className="num py-2.5 text-right">
                          {r.total_quantity ? `${num(Number(r.total_quantity), 2)} ${unit}` : '—'}
                        </td>
                        <td className="truncate py-2.5 pl-4 text-text-muted">
                          {[machine, impl].filter(Boolean).join(' + ') || '—'}
                        </td>
                        <td className="num py-2.5 text-right font-medium">{money(Number(r.cost))}</td>
                        <td className="py-2 text-right">
                          <span className="inline-flex items-center gap-1">
                            {r.status === 'programada' && <CompleteApplicationButton id={r.id} editHref={editHref(r.id)} />}
                            <RowActions id={r.id} kind="pulverizacao" editHref={editHref(r.id)} confirm="Excluir? O estoque volta." />
                          </span>
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
    </div>
  )
}
