import Link from 'next/link'
import type { Route } from 'next'
import type { Metadata } from 'next'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { getFormOptions } from '@/lib/queries/options'
import { date, money, num, relativeDay, sinceDays } from '@/lib/format'
import {
  PageHeader,
  EmptyState,
  Metric,
  MetricStrip,
  Section,
  StatusDot,
} from '@/components/ui/Layout'
import { ButtonLink } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { IrrigationForm } from '@/components/forms/OperationForms'

export const metadata: Metadata = { title: 'Irrigação' }

const TABS = [
  { key: 'situacao', label: 'Situação dos talhões' },
  { key: 'registros', label: 'Registros' },
]

export default async function IrrigacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; novo?: string }>
}) {
  const [ctx, sp] = await Promise.all([requireFarm(), searchParams])
  const supabase = await createClient()
  const tab = sp.aba ?? 'situacao'

  const [options, records, latest, plots] = await Promise.all([
    getFormOptions(ctx.farm.id),
    supabase
      .from('irrigation_records')
      .select('*, plots(code, name)', { count: 'exact' })
      .eq('farm_id', ctx.farm.id)
      .match(ctx.season ? { season_id: ctx.season.id } : {})
      .order('irrigation_date', { ascending: false })
      .limit(1000),
    // "Quando cada talhao foi irrigado" e' sobre hoje, nao sobre a safra
    // escolhida: busca os registros mais recentes de qualquer safra.
    supabase
      .from('irrigation_records')
      .select('plot_id, irrigation_date')
      .eq('farm_id', ctx.farm.id)
      .order('irrigation_date', { ascending: false })
      .limit(500),
    supabase
      .from('plots')
      .select('id, code, name, irrigation_system, status')
      .eq('farm_id', ctx.farm.id)
      .neq('status', 'inativo')
      .order('code'),
  ])

  const rows = records.data ?? []
  const total = records.count ?? rows.length
  const plotList = plots.data ?? []

  // Ultimo registro por talhao — base do semaforo e do alerta do painel.
  const lastByPlot = new Map<string, string>()
  for (const r of latest.data ?? []) {
    if (r.plot_id && !lastByPlot.has(r.plot_id)) lastByPlot.set(r.plot_id, r.irrigation_date)
  }

  const totalCost = rows.reduce((s, r) => s + Number(r.cost), 0)
  const totalVolume = rows.reduce((s, r) => s + Number(r.volume_m3 ?? 0), 0)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Irrigação"
        subtitle={`${ctx.season ? `Safra ${ctx.season.name}` : 'Todas as safras'}${
          total > rows.length ? ` · mostrando ${rows.length} de ${total}` : ''
        }`}
        actions={<ButtonLink href="/irrigacao?novo=1">Registrar irrigação</ButtonLink>}
      />

      {sp.novo === '1' && <IrrigationForm plots={options.plots} closeHref="/irrigacao" />}

      <MetricStrip>
        <Metric label="Registros" value={num(rows.length)} />
        <Metric label="Volume total" value={totalVolume > 0 ? `${num(totalVolume)} m³` : '—'} />
        <Metric label="Custo" value={money(totalCost, { compact: true })} />
      </MetricStrip>

      <Tabs items={TABS} />

      {tab === 'situacao' && (
        <Section title="Quando cada talhão foi irrigado">
          {plotList.length === 0 ? (
            <EmptyState title="Cadastre talhões para acompanhar a irrigação" />
          ) : (
            <ul className="divide-y divide-line">
              {plotList.map((p) => {
                const last = lastByPlot.get(p.id)
                const days = last ? sinceDays(last) : null
                const level =
                  days === null ? 'atencao' : days >= 6 ? 'critico' : days >= 3 ? 'atencao' : 'normal'

                return (
                  <li key={p.id} className="flex items-center gap-4 py-3 text-sm">
                    <StatusDot level={level} />
                    <Link
                      href={`/talhoes/${p.id}?aba=irrigacao` as Route}
                      className="num w-14 shrink-0 font-medium hover:text-accent-text"
                    >
                      {p.code}
                    </Link>
                    <span className="min-w-0 flex-1 truncate text-text-muted">
                      {p.irrigation_system ?? 'sistema não informado'}
                    </span>
                    <span className="num shrink-0 text-text-muted">
                      {last ? date(last) : '—'}
                    </span>
                    <span className="w-24 shrink-0 text-right text-xs text-text-faint">
                      {last ? relativeDay(last) : 'sem registro'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>
      )}

      {tab === 'registros' && (
        <Section title="Irrigações registradas">
          {rows.length === 0 ? (
            <EmptyState
              title="Nenhuma irrigação registrada"
              description="Com o histórico de irrigação, o painel avisa quando um talhão passa dias sem água."
              action={<ButtonLink href="/irrigacao?novo=1">Registrar irrigação</ButtonLink>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((r) => {
                const plot = r.plots as { code: string } | null
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                    <span className="num w-20 shrink-0 text-text-muted">
                      {date(r.irrigation_date)}
                    </span>
                    <span className="num w-14 shrink-0 font-medium">{plot?.code ?? '—'}</span>
                    <span className="min-w-0 flex-1 truncate">{r.method ?? 'Irrigação'}</span>
                    {r.duration_minutes && (
                      <span className="num shrink-0 text-text-muted">
                        {r.duration_minutes} min
                      </span>
                    )}
                    {r.volume_m3 && (
                      <span className="num shrink-0 text-text-muted">
                        {num(Number(r.volume_m3), 2)} m³
                      </span>
                    )}
                    {Number(r.cost) > 0 && (
                      <span className="num w-24 shrink-0 text-right">{money(Number(r.cost))}</span>
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
