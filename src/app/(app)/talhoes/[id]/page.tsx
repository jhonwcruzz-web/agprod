import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata, Route } from 'next'
import { ArrowLeftIcon, PencilSimpleIcon } from '@phosphor-icons/react/dist/ssr'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { getPlotPerformance } from '@/lib/queries/plot-performance'
import { area, date, kg, money, num, relativeDay, EXPENSE_LABEL, PLOT_STATUS_LABEL, UNIT_LABEL } from '@/lib/format'
import { Tabs } from '@/components/ui/Tabs'
import {
  Badge,
  DataGrid,
  DataPair,
  EmptyState,
  Metric,
  MetricStrip,
  Section,
} from '@/components/ui/Layout'
import { ButtonLink } from '@/components/ui/Button'
import { PlotEditPanel } from './PlotEditPanel'

const TABS = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'producao', label: 'Produção' },
  { key: 'aplicacoes', label: 'Aplicações' },
  { key: 'adubacao', label: 'Adubação' },
  { key: 'irrigacao', label: 'Irrigação' },
  { key: 'custos', label: 'Custos' },
  { key: 'historico', label: 'Histórico' },
]

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('plots').select('code, name').eq('id', id).maybeSingle()
  return { title: data ? `Talhão ${data.code}` : 'Talhão' }
}

export default async function TalhaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aba?: string; editar?: string }>
}) {
  const [ctx, { id }, sp] = await Promise.all([requireFarm(), params, searchParams])
  const supabase = await createClient()
  const tab = sp.aba ?? 'resumo'

  const { data: plot } = await supabase
    .from('plots')
    .select('*, crops(name, slug), varieties(name), rootstocks(name)')
    .eq('id', id)
    .eq('farm_id', ctx.farm.id)
    .maybeSingle()

  if (!plot) notFound()

  const seasonId = ctx.season?.id ?? null
  const [perf] = await getPlotPerformance(ctx.farm.id, seasonId, id)

  const crop = plot.crops as { name: string; slug: string } | null
  const variety = plot.varieties as { name: string } | null
  const rootstock = plot.rootstocks as { name: string } | null
  const result = Number(perf?.result ?? 0)

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/talhoes"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
        >
          <ArrowLeftIcon size={15} /> Talhões
        </Link>

        {/* Cabecalho do talhao: codigo grande, ficha tecnica em uma linha. */}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="num text-3xl font-semibold tracking-tighter sm:text-4xl">
                {plot.code}
              </h1>
              {plot.name && <p className="text-lg text-text-muted">{plot.name}</p>}
              <Badge tone={plot.status === 'producao' ? 'accent' : 'neutral'}>
                {PLOT_STATUS_LABEL[plot.status]}
              </Badge>
            </div>
            <p className="num mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
              {[
                [crop?.name, variety?.name].filter(Boolean).join(' '),
                area(Number(plot.area), plot.area_unit),
                plot.plant_count ? `${num(plot.plant_count)} plantas` : null,
                ctx.season ? `Safra ${ctx.season.name}` : 'todas as safras',
              ]
                .filter(Boolean)
                .map((chunk, i, arr) => (
                  <span key={i} className="flex items-center gap-2">
                    {chunk}
                    {i < arr.length - 1 && (
                      <span aria-hidden className="text-line-strong">·</span>
                    )}
                  </span>
                ))}
            </p>
          </div>

          <ButtonLink href={`/talhoes/${id}?editar=1` as Route} variant="secondary" size="sm">
            <PencilSimpleIcon size={15} /> Editar
          </ButtonLink>
        </div>
      </div>

      {sp.editar === '1' && <PlotEditPanel plotId={id} />}

      <Tabs items={TABS} />

      {tab === 'resumo' && (
        <ResumoTab plot={plot} perf={perf} result={result} crop={crop} variety={variety} rootstock={rootstock} />
      )}
      {tab === 'producao' && <ProducaoTab plotId={id} seasonId={seasonId} />}
      {tab === 'aplicacoes' && <AplicacoesTab plotId={id} seasonId={seasonId} />}
      {tab === 'adubacao' && <AdubacaoTab plotId={id} seasonId={seasonId} />}
      {tab === 'irrigacao' && <IrrigacaoTab plotId={id} seasonId={seasonId} />}
      {tab === 'custos' && (
        <CustosTab
          plotId={id}
          seasonId={seasonId}
          production={Number(perf?.production_kg ?? 0)}
        />
      )}
      {tab === 'historico' && <HistoricoTab plotId={id} />}
    </div>
  )
}

/* ------------------------------------------------------------ RESUMO */

async function ResumoTab({
  plot,
  perf,
  result,
  crop,
  variety,
  rootstock,
}: {
  plot: Record<string, unknown> & { id: string }
  perf: Record<string, unknown> | null
  result: number
  crop: { name: string } | null
  variety: { name: string } | null
  rootstock: { name: string } | null
}) {
  const supabase = await createClient()

  // Ultima atividade de cada tipo — a secao "atividade atual" (secao 8).
  const [lastApp, lastIrrig, lastHarvest] = await Promise.all([
    supabase
      .from('applications')
      .select('application_date, product_name')
      .eq('plot_id', plot.id)
      .eq('status', 'realizada')
      .order('application_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('irrigation_records')
      .select('irrigation_date')
      .eq('plot_id', plot.id)
      .order('irrigation_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('production_records')
      .select('harvest_date, quantity_kg')
      .eq('plot_id', plot.id)
      .order('harvest_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return (
    <div className="flex flex-col gap-8">
      <MetricStrip>
        <Metric label="Produção" value={kg(Number(perf?.production_kg ?? 0), { asTon: true })} />
        <Metric label="Custo" value={money(Number(perf?.total_cost ?? 0), { compact: true })} />
        <Metric
          label="Custo por kg"
          value={perf?.cost_per_kg ? money(Number(perf.cost_per_kg)) : '—'}
        />
        <Metric label="Receita" value={money(Number(perf?.revenue ?? 0), { compact: true })} />
        <Metric
          label="Resultado"
          value={money(result, { compact: true })}
          tone={result > 0 ? 'positive' : result < 0 ? 'negative' : 'neutral'}
        />
      </MetricStrip>

      <Section title="Ficha do talhão">
        <DataGrid>
          <DataPair label="Cultura" value={crop?.name ?? '—'} />
          <DataPair label="Variedade" value={variety?.name ?? '—'} />
          <DataPair label="Porta-enxerto" value={rootstock?.name ?? '—'} />
          <DataPair label="Plantio" value={date(plot.planting_date as string)} mono />
          <DataPair label="Área" value={area(Number(plot.area))} mono />
          <DataPair
            label="Plantas"
            value={plot.plant_count ? num(plot.plant_count as number) : '—'}
            mono
          />
          <DataPair
            label="Espaçamento"
            value={
              plot.row_spacing && plot.plant_spacing
                ? `${num(Number(plot.row_spacing), 2)} × ${num(Number(plot.plant_spacing), 2)} m`
                : '—'
            }
            mono
          />
          <DataPair label="Irrigação" value={(plot.irrigation_system as string) ?? '—'} />
          <DataPair label="Condução" value={(plot.training_system as string) ?? '—'} />
          <DataPair
            label="Produtividade"
            value={perf?.kg_per_ha ? `${num(Number(perf.kg_per_ha))} kg/ha` : '—'}
            mono
          />
        </DataGrid>
        {plot.notes ? (
          <p className="mt-4 max-w-[70ch] border-t border-line pt-4 text-sm leading-relaxed text-text-muted">
            {plot.notes as string}
          </p>
        ) : null}
      </Section>

      <Section title="Atividade atual">
        <dl className="grid gap-px overflow-hidden rounded-lg bg-line sm:grid-cols-3">
          {[
            {
              label: 'Última aplicação',
              value: lastApp.data ? date(lastApp.data.application_date, { short: true }) : '—',
              sub: lastApp.data?.product_name ?? 'nenhuma registrada',
            },
            {
              label: 'Última irrigação',
              value: lastIrrig.data
                ? date(lastIrrig.data.irrigation_date, { short: true })
                : '—',
              sub: lastIrrig.data ? relativeDay(lastIrrig.data.irrigation_date) : 'nenhuma registrada',
            },
            {
              label: 'Última colheita',
              value: lastHarvest.data
                ? date(lastHarvest.data.harvest_date, { short: true })
                : '—',
              sub: lastHarvest.data
                ? kg(Number(lastHarvest.data.quantity_kg))
                : 'nenhuma registrada',
            },
          ].map((x) => (
            <div key={x.label} className="bg-bg-raised px-4 py-4">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                {x.label}
              </dt>
              <dd className="num mt-1.5 text-lg font-medium">{x.value}</dd>
              <dd className="mt-0.5 text-xs text-text-muted">{x.sub}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  )
}

/* ---------------------------------------------------------- PRODUCAO */

async function ProducaoTab({ plotId, seasonId }: { plotId: string; seasonId: string | null }) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('production_records')
    .select('id, harvest_date, quantity, unit, quantity_kg, destination, team, notes, varieties(name)')
    .eq('plot_id', plotId)
    .match(seasonId ? { season_id: seasonId } : {})
    .order('harvest_date', { ascending: false })
    .limit(100)

  const rows = data ?? []
  const total = rows.reduce((s, r) => s + Number(r.quantity_kg), 0)

  if (rows.length === 0)
    return (
      <EmptyState
        title="Nenhuma colheita registrada neste talhão"
        action={<ButtonLink href="/producao?novo=1">Registrar colheita</ButtonLink>}
      />
    )

  return (
    <Section title={`Colheitas · ${kg(total, { asTon: true })} no total`}>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
            <span className="num w-14 shrink-0 text-sm text-text-muted">
              {date(r.harvest_date, { short: true })}
            </span>
            <span className="num text-sm font-medium">
              {num(Number(r.quantity), 2)} {UNIT_LABEL[r.unit]}
            </span>
            {r.unit !== 'kg' && (
              <span className="num text-xs text-text-faint">= {kg(Number(r.quantity_kg))}</span>
            )}
            {(r.varieties as { name: string } | null)?.name && (
              <span className="text-xs text-text-muted">
                {(r.varieties as { name: string }).name}
              </span>
            )}
            {r.destination && (
              <span className="ml-auto text-xs text-text-faint">→ {r.destination}</span>
            )}
          </li>
        ))}
      </ul>
    </Section>
  )
}

/* -------------------------------------------------------- APLICACOES */

async function AplicacoesTab({ plotId, seasonId }: { plotId: string; seasonId: string | null }) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('applications')
    .select('*')
    .eq('plot_id', plotId)
    .match(seasonId ? { season_id: seasonId } : {})
    .order('application_date', { ascending: false, nullsFirst: false })
    .limit(100)

  const rows = data ?? []
  const total = rows
    .filter((r) => r.status === 'realizada')
    .reduce((s, r) => s + Number(r.cost), 0)

  if (rows.length === 0)
    return (
      <EmptyState
        title="Nenhuma aplicação registrada neste talhão"
        action={<ButtonLink href="/aplicacoes?novo=1">Registrar aplicação</ButtonLink>}
      />
    )

  return (
    <Section title="Linha do tempo de aplicações">
      {/* Timeline (secao 12): data, produto, dose — nada mais na linha. */}
      <ol className="relative border-l border-line pl-5">
        {rows.map((r) => (
          <li key={r.id} className="relative pb-5 last:pb-0">
            <span
              aria-hidden
              className={`absolute -left-[23px] top-1.5 size-2 rounded-full ${
                r.status === 'realizada' ? 'bg-accent' : 'bg-warn'
              }`}
            />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="num text-sm text-text-muted">
                {date(r.application_date ?? r.scheduled_date, { short: true })}
              </span>
              <span className="text-sm font-medium">{r.product_name}</span>
              {r.dose && (
                <span className="num text-xs text-text-muted">
                  {num(Number(r.dose), 2)} {r.dose_unit ?? ''}
                </span>
              )}
              {r.status !== 'realizada' && <Badge tone="warn">Programada</Badge>}
              {Number(r.cost) > 0 && (
                <span className="num ml-auto text-xs text-text-faint">{money(Number(r.cost))}</span>
              )}
            </div>
            {r.active_ingredient && (
              <p className="mt-0.5 text-xs text-text-faint">{r.active_ingredient}</p>
            )}
          </li>
        ))}
      </ol>

      <p className="mt-5 flex items-baseline justify-between border-t border-line pt-4 text-sm">
        <span className="text-text-muted">Custo acumulado de aplicações</span>
        <span className="num font-semibold">{money(total)}</span>
      </p>
    </Section>
  )
}

/* ---------------------------------------------------------- ADUBACAO */

async function AdubacaoTab({ plotId, seasonId }: { plotId: string; seasonId: string | null }) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fertilizations')
    .select('*')
    .eq('plot_id', plotId)
    .match(seasonId ? { season_id: seasonId } : {})
    .order('fertilization_date', { ascending: false })
    .limit(100)

  const rows = data ?? []
  const total = rows.reduce((s, r) => s + Number(r.cost), 0)
  const totalQty = rows.reduce((s, r) => s + Number(r.quantity), 0)

  if (rows.length === 0)
    return (
      <EmptyState
        title="Nenhuma adubação registrada neste talhão"
        action={<ButtonLink href="/adubacao?novo=1">Registrar adubação</ButtonLink>}
      />
    )

  return (
    <Section title={`Adubações · ${num(totalQty)} kg aplicados`}>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
            <span className="num w-14 shrink-0 text-sm text-text-muted">
              {date(r.fertilization_date, { short: true })}
            </span>
            <span className="text-sm font-medium">{r.product_name}</span>
            <span className="num text-sm">
              {num(Number(r.quantity), 2)} {UNIT_LABEL[r.unit]}
            </span>
            {r.dose_per_ha && (
              <span className="num text-xs text-text-faint">
                {num(Number(r.dose_per_ha), 2)}/ha
              </span>
            )}
            <span className="num ml-auto text-xs text-text-faint">{money(Number(r.cost))}</span>
          </li>
        ))}
      </ul>

      <p className="mt-5 flex items-baseline justify-between border-t border-line pt-4 text-sm">
        <span className="text-text-muted">Custo acumulado de adubação</span>
        <span className="num font-semibold">{money(total)}</span>
      </p>
    </Section>
  )
}

/* --------------------------------------------------------- IRRIGACAO */

async function IrrigacaoTab({ plotId, seasonId }: { plotId: string; seasonId: string | null }) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('irrigation_records')
    .select('*')
    .eq('plot_id', plotId)
    .match(seasonId ? { season_id: seasonId } : {})
    .order('irrigation_date', { ascending: false })
    .limit(100)

  const rows = data ?? []

  if (rows.length === 0)
    return (
      <EmptyState
        title="Nenhuma irrigação registrada neste talhão"
        description="Registrar a irrigação é o que permite o sistema avisar quando um talhão fica muitos dias sem água."
        action={<ButtonLink href="/irrigacao?novo=1">Registrar irrigação</ButtonLink>}
      />
    )

  return (
    <Section title="Irrigações">
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
            <span className="num w-14 shrink-0 text-sm text-text-muted">
              {date(r.irrigation_date, { short: true })}
            </span>
            <span className="text-sm">{r.method ?? 'Irrigação'}</span>
            {r.duration_minutes && (
              <span className="num text-sm text-text-muted">{r.duration_minutes} min</span>
            )}
            {r.volume_m3 && (
              <span className="num text-sm text-text-muted">{num(Number(r.volume_m3), 2)} m³</span>
            )}
            <span className="ml-auto text-xs text-text-faint">
              {relativeDay(r.irrigation_date)}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

/* ------------------------------------------------------------ CUSTOS */

async function CustosTab({
  plotId,
  seasonId,
  production,
}: {
  plotId: string
  seasonId: string | null
  production: number
}) {
  const supabase = await createClient()

  const [breakdown, recent] = await Promise.all([
    supabase
      .from('v_plot_cost_breakdown')
      .select('category, amount')
      .eq('plot_id', plotId)
      .match(seasonId ? { season_id: seasonId } : {}),
    supabase
      .from('expenses')
      .select('id, expense_date, category, description, amount')
      .eq('plot_id', plotId)
      .eq('is_production_cost', true)
      .match(seasonId ? { season_id: seasonId } : {})
      .order('expense_date', { ascending: false })
      .limit(30),
  ])

  const rows = breakdown.data ?? []
  const byCategory = new Map<string, number>()
  for (const r of rows) {
    byCategory.set(r.category!, (byCategory.get(r.category!) ?? 0) + Number(r.amount))
  }

  const total = [...byCategory.values()].reduce((a, b) => a + b, 0)
  const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1])

  if (total === 0)
    return (
      <EmptyState
        title="Nenhum custo lançado neste talhão"
        description="Aplicações, adubações e irrigações lançam o custo aqui sozinhas. Mão de obra e outros gastos você registra em Custos."
        action={<ButtonLink href="/custos?novo=1">Registrar despesa</ButtonLink>}
      />
    )

  return (
    <div className="flex flex-col gap-8">
      <Section title="Custo por categoria">
        <ul className="divide-y divide-line">
          {sorted.map(([cat, amount]) => {
            const share = (amount / total) * 100
            return (
              <li key={cat} className="py-3">
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <span>{EXPENSE_LABEL[cat] ?? cat}</span>
                  <span className="num font-medium">{money(amount)}</span>
                </div>
                {/* Barra proporcional: comparar categorias sem precisar de grafico. */}
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

        <dl className="mt-5 grid gap-px overflow-hidden rounded-lg bg-line sm:grid-cols-3">
          <div className="bg-bg-raised px-4 py-4">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
              Custo total
            </dt>
            <dd className="num mt-1.5 text-xl font-semibold">{money(total)}</dd>
          </div>
          <div className="bg-bg-raised px-4 py-4">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
              Produção
            </dt>
            <dd className="num mt-1.5 text-xl font-semibold">{kg(production)}</dd>
          </div>
          <div className="bg-bg-raised px-4 py-4">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
              Custo por kg
            </dt>
            <dd className="num mt-1.5 text-xl font-semibold text-accent-text">
              {production > 0 ? money(total / production) : '—'}
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Lançamentos recentes">
        <ul className="divide-y divide-line">
          {(recent.data ?? []).map((r) => (
            <li key={r.id} className="flex items-baseline gap-4 py-2.5 text-sm">
              <span className="num w-14 shrink-0 text-text-muted">
                {date(r.expense_date, { short: true })}
              </span>
              <span className="min-w-0 flex-1 truncate">{r.description}</span>
              <span className="shrink-0 text-xs text-text-faint">
                {EXPENSE_LABEL[r.category] ?? r.category}
              </span>
              <span className="num shrink-0 font-medium">{money(Number(r.amount))}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

/* --------------------------------------------------------- HISTORICO */

async function HistoricoTab({ plotId }: { plotId: string }) {
  const supabase = await createClient()

  const [prod, apps, ferts, irrig, sales] = await Promise.all([
    supabase.from('production_records').select('id, harvest_date, quantity_kg').eq('plot_id', plotId),
    supabase.from('applications').select('id, application_date, product_name, status').eq('plot_id', plotId),
    supabase.from('fertilizations').select('id, fertilization_date, product_name, quantity, unit').eq('plot_id', plotId),
    supabase.from('irrigation_records').select('id, irrigation_date, method').eq('plot_id', plotId),
    supabase.from('sales').select('id, sale_date, quantity_kg, total_amount').eq('plot_id', plotId),
  ])

  type Entry = { id: string; date: string; kind: string; text: string }
  const entries: Entry[] = [
    ...(prod.data ?? []).map((r) => ({
      id: `p${r.id}`,
      date: r.harvest_date,
      kind: 'Colheita',
      text: kg(Number(r.quantity_kg)),
    })),
    ...(apps.data ?? [])
      .filter((r) => r.application_date)
      .map((r) => ({
        id: `a${r.id}`,
        date: r.application_date!,
        kind: 'Aplicação',
        text: r.product_name,
      })),
    ...(ferts.data ?? []).map((r) => ({
      id: `f${r.id}`,
      date: r.fertilization_date,
      kind: 'Adubação',
      text: `${r.product_name} · ${num(Number(r.quantity), 2)} ${UNIT_LABEL[r.unit]}`,
    })),
    ...(irrig.data ?? []).map((r) => ({
      id: `i${r.id}`,
      date: r.irrigation_date,
      kind: 'Irrigação',
      text: r.method ?? '—',
    })),
    ...(sales.data ?? []).map((r) => ({
      id: `s${r.id}`,
      date: r.sale_date,
      kind: 'Venda',
      text: `${kg(Number(r.quantity_kg))} · ${money(Number(r.total_amount))}`,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  if (entries.length === 0)
    return <EmptyState title="Este talhão ainda não tem histórico" />

  // Agrupa por mes: o produtor pensa em "o que aconteceu em setembro".
  const byMonth = new Map<string, Entry[]>()
  for (const e of entries) {
    const key = e.date.slice(0, 7)
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key)!.push(e)
  }

  const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-text-muted">
        Histórico completo do talhão, de todas as safras.
      </p>
      {[...byMonth.entries()].map(([month, list]) => {
        const [y, m] = month.split('-')
        return (
          <Section key={month} title={`${MONTHS[Number(m) - 1]} de ${y}`}>
            <ul className="divide-y divide-line">
              {list.map((e) => (
                <li key={e.id} className="flex items-baseline gap-4 py-2.5 text-sm">
                  <span className="num w-14 shrink-0 text-text-muted">
                    {date(e.date, { short: true })}
                  </span>
                  <span className="w-24 shrink-0 text-xs font-medium uppercase tracking-wide text-text-faint">
                    {e.kind}
                  </span>
                  <span className="min-w-0 flex-1">{e.text}</span>
                </li>
              ))}
            </ul>
          </Section>
        )
      })}
    </div>
  )
}
