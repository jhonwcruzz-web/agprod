import Link from 'next/link'
import type { Route } from 'next'
import type { Metadata } from 'next'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { getFormOptions } from '@/lib/queries/options'
import { date, money, num, UNIT_LABEL } from '@/lib/format'
import { PageHeader, EmptyState, Metric, MetricStrip, Section } from '@/components/ui/Layout'
import { ButtonLink } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { FertilizationForm } from '@/components/forms/OperationForms'

export const metadata: Metadata = { title: 'Adubação' }

const TABS = [
  { key: 'lancamentos', label: 'Lançamentos' },
  { key: 'talhoes', label: 'Por talhão' },
  { key: 'produtos', label: 'Por produto' },
]

export default async function AdubacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; novo?: string }>
}) {
  const [ctx, sp] = await Promise.all([requireFarm(), searchParams])
  const supabase = await createClient()
  const tab = sp.aba ?? 'lancamentos'

  const [options, ferts, plots] = await Promise.all([
    getFormOptions(ctx.farm.id),
    supabase
      .from('fertilizations')
      .select('*, plots(code, name)', { count: 'exact' })
      .eq('farm_id', ctx.farm.id)
      .match(ctx.season ? { season_id: ctx.season.id } : {})
      .order('fertilization_date', { ascending: false })
      .limit(1000),
    supabase.from('plots').select('id, code, area').eq('farm_id', ctx.farm.id),
  ])

  const rows = ferts.data ?? []
  const total = ferts.count ?? rows.length
  const totalCost = rows.reduce((s, r) => s + Number(r.cost), 0)
  const totalQty = rows.reduce((s, r) => s + Number(r.quantity), 0)
  const totalArea = (plots.data ?? []).reduce((s, p) => s + Number(p.area), 0)

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

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Adubação"
        subtitle={`Fertilizantes e corretivos${ctx.season ? ` · Safra ${ctx.season.name}` : ''}${
          total > rows.length ? ` · mostrando ${rows.length} de ${total}` : ''
        }`}
        actions={<ButtonLink href="/adubacao?novo=1">Registrar adubação</ButtonLink>}
      />

      {sp.novo === '1' && (
        <FertilizationForm
          plots={options.plots}
          products={options.products.filter(
            (p) => p.category === 'fertilizante' || p.category === 'corretivo' || p.category === 'outro',
          )}
          closeHref="/adubacao"
        />
      )}

      <MetricStrip>
        <Metric label="Total aplicado" value={`${num(totalQty)} kg`} />
        <Metric label="Custo total" value={money(totalCost, { compact: true })} />
        <Metric
          label="Custo por hectare"
          value={totalArea > 0 ? money(totalCost / totalArea) : '—'}
        />
        <Metric label="Lançamentos" value={num(rows.length)} />
      </MetricStrip>

      <Tabs items={TABS} />

      {tab === 'lancamentos' && (
        <Section title="Adubações registradas">
          {rows.length === 0 ? (
            <EmptyState
              title="Nenhuma adubação registrada"
              description="Registrar a adubação separada dos defensivos mostra quanto do custo vem de fertilizante."
              action={<ButtonLink href="/adubacao?novo=1">Registrar adubação</ButtonLink>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((r) => {
                const plot = r.plots as { code: string } | null
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                    <span className="num w-20 shrink-0 text-sm text-text-muted">
                      {date(r.fertilization_date)}
                    </span>
                    {plot ? (
                      <Link
                        href={`/talhoes/${r.plot_id}?aba=adubacao` as Route}
                        className="num w-14 shrink-0 text-sm font-medium hover:text-accent-text"
                      >
                        {plot.code}
                      </Link>
                    ) : (
                      <span className="w-14 shrink-0 text-sm text-text-faint">—</span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm">{r.product_name}</span>
                    {r.fert_type && (
                      <span className="shrink-0 text-xs text-text-faint">{r.fert_type}</span>
                    )}
                    <span className="num shrink-0 text-sm">
                      {num(Number(r.quantity), 2)} {UNIT_LABEL[r.unit]}
                    </span>
                    <span className="num w-24 shrink-0 text-right text-sm">
                      {money(Number(r.cost))}
                    </span>
                  </li>
                )
              })}
            </ul>
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
                  <span className="num flex-1 text-text-muted">{num(r.qty)} kg</span>
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
                  <span className="num w-24 text-right font-medium">{money(r.amount)}</span>
                </li>
              ))}
          </ul>
        </Section>
      )}
    </div>
  )
}
