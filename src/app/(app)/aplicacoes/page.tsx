import Link from 'next/link'
import type { Route } from 'next'
import type { Metadata } from 'next'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { getFormOptions } from '@/lib/queries/options'
import { date, money, num, relativeDay } from '@/lib/format'
import { PageHeader, EmptyState, Badge, Metric, MetricStrip, Section } from '@/components/ui/Layout'
import { ButtonLink } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { ApplicationForm } from '@/components/forms/OperationForms'
import { CompleteApplicationButton } from './CompleteApplicationButton'

export const metadata: Metadata = { title: 'Aplicações' }

export default async function AplicacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; novo?: string }>
}) {
  const [ctx, sp] = await Promise.all([requireFarm(), searchParams])
  const supabase = await createClient()
  const tab = sp.aba ?? 'realizadas'

  const [options, apps] = await Promise.all([
    getFormOptions(ctx.farm.id),
    supabase
      .from('applications')
      .select('*, plots(code, name)', { count: 'exact' })
      .eq('farm_id', ctx.farm.id)
      .match(ctx.season ? { season_id: ctx.season.id } : {})
      .order('application_date', { ascending: false, nullsFirst: true })
      .limit(1000),
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

  const list =
    tab === 'programadas' ? scheduled : tab === 'pendentes' ? pending : done

  // Custo acumulado por talhao (aba Custos).
  const byPlot = new Map<string, { code: string; amount: number }>()
  for (const r of done) {
    const plot = r.plots as { code: string } | null
    const key = plot?.code ?? 'Sem talhão'
    const cur = byPlot.get(key) ?? { code: key, amount: 0 }
    cur.amount += Number(r.cost)
    byPlot.set(key, cur)
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Aplicações"
        subtitle={`Fitossanidade${ctx.season ? ` · Safra ${ctx.season.name}` : ''}${
          total > rows.length ? ` · mostrando ${rows.length} de ${total}` : ''
        }`}
        actions={<ButtonLink href="/aplicacoes?novo=1">Registrar aplicação</ButtonLink>}
      />

      {sp.novo === '1' && (
        <ApplicationForm
          plots={options.plots}
          products={options.products.filter((p) => p.category === 'defensivo' || p.category === 'outro')}
          closeHref="/aplicacoes"
        />
      )}

      <MetricStrip>
        <Metric label="Realizadas" value={num(done.length)} />
        <Metric label="Programadas" value={num(scheduled.length)} tone={scheduled.length ? 'warn' : 'neutral'} />
        <Metric label="Custo acumulado" value={money(totalCost, { compact: true })} />
      </MetricStrip>

      <Tabs items={TABS} />

      {tab === 'custos' ? (
        <Section title="Custo de aplicações por talhão">
          {byPlot.size === 0 ? (
            <EmptyState title="Nenhum custo de aplicação registrado" />
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
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${share.toFixed(1)}%` }}
                        />
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
        <Section
          title={
            tab === 'programadas'
              ? 'Aplicações programadas'
              : tab === 'pendentes'
                ? 'Aplicações pendentes'
                : 'Aplicações realizadas'
          }
        >
          {list.length === 0 ? (
            <EmptyState
              title={
                tab === 'programadas'
                  ? 'Nenhuma aplicação programada'
                  : tab === 'pendentes'
                    ? 'Nenhuma aplicação pendente'
                    : 'Nenhuma aplicação registrada'
              }
              description={
                tab === 'realizadas'
                  ? 'Ao registrar uma aplicação com produto do estoque, a baixa e o custo acontecem sozinhos.'
                  : undefined
              }
              action={<ButtonLink href="/aplicacoes?novo=1">Registrar aplicação</ButtonLink>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {list.map((r) => {
                const plot = r.plots as { code: string; name: string | null } | null
                const when = r.application_date ?? r.scheduled_date
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3">
                    <span className="num w-20 shrink-0 text-sm text-text-muted">{date(when)}</span>

                    {plot ? (
                      <Link
                        href={`/talhoes/${r.plot_id}?aba=aplicacoes` as Route}
                        className="num w-14 shrink-0 text-sm font-medium hover:text-accent-text"
                      >
                        {plot.code}
                      </Link>
                    ) : (
                      <span className="w-14 shrink-0 text-sm text-text-faint">—</span>
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{r.product_name}</span>
                      {r.active_ingredient && (
                        <span className="block truncate text-xs text-text-faint">
                          {r.active_ingredient}
                        </span>
                      )}
                    </span>

                    {r.dose && (
                      <span className="num shrink-0 text-xs text-text-muted">
                        {num(Number(r.dose), 2)} {r.dose_unit ?? ''}
                      </span>
                    )}

                    {r.status === 'programada' && (
                      <>
                        <Badge tone="warn">{relativeDay(r.scheduled_date)}</Badge>
                        <CompleteApplicationButton id={r.id} />
                      </>
                    )}

                    {Number(r.cost) > 0 && (
                      <span className="num w-24 shrink-0 text-right text-sm">
                        {money(Number(r.cost))}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Section>
      )}
    </div>
  )
}
