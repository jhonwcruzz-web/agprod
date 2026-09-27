import Link from 'next/link'
import type { Metadata, Route } from 'next'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { getFormOptions } from '@/lib/queries/options'
import { area, date, kg, num, UNIT_LABEL } from '@/lib/format'
import { PageHeader, EmptyState, Metric, MetricStrip, Section } from '@/components/ui/Layout'
import { ButtonLink } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { ProductionForm } from '@/components/forms/ProductionForm'
import { FilterBar } from '@/components/ui/FilterBar'
import { RowActions } from '@/components/ui/RowActions'
import { byDate, eqIf, readFilters } from '@/lib/filters'
import { closeLink, editLink } from '@/lib/url'
import { AchievedBar, ForecastForm, type ForecastRow } from './ForecastForm'
import { Simulator, type SimPlot } from '@/components/production/Simulator'

export const metadata: Metadata = { title: 'Produção' }

const TABS = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'previsao', label: 'Previsão x realizado' },
  { key: 'colheita', label: 'Colheita' },
  { key: 'talhoes', label: 'Talhões' },
  { key: 'variedades', label: 'Variedades' },
  { key: 'simulador', label: 'Simulador' },
]

/** Linha por talhao usada nas abas — mesma forma com ou sem safra. */
type PlotRow = {
  plot_id: string
  code: string
  crop_name: string | null
  variety_name: string | null
  area: number
  realized_kg: number
  expected_t_ha: number | null
}

const tons = (kgValue: number) => `${num(kgValue / 1000, 1)} t`

export default async function ProducaoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const [ctx, sp] = await Promise.all([requireFarm(), searchParams])
  const supabase = await createClient()
  const tab = sp.aba ?? 'resumo'
  const season = ctx.season

  // Tudo nesta pagina e' da safra ativa: e' o que torna a comparacao com
  // a previsao (que e' por safra) honesta.
  let recordsQuery = supabase
    .from('production_records')
    .select(
      'id, harvest_date, quantity, unit, quantity_kg, destination, team, plots(code, name), varieties(name)',
    )
    .eq('farm_id', ctx.farm.id)
    .order('harvest_date', { ascending: false })
    .limit(300)
  if (season) recordsQuery = recordsQuery.eq('season_id', season.id)

  // Lista da aba Colheita: mesma safra, com os filtros da barra.
  const f = readFilters(sp)
  let listQuery = supabase
    .from('production_records')
    .select('id, harvest_date, quantity, unit, quantity_kg, destination, team, plot_id, plots(code, name), varieties(name)', { count: 'exact' })
    .eq('farm_id', ctx.farm.id)
  if (season) listQuery = listQuery.eq('season_id', season.id)
  listQuery = eqIf(byDate(listQuery, 'harvest_date', f), 'plot_id', f.talhao)

  // Colheita vinda de uma ordem de servico aberta: o formulario ja' vem preenchido.
  const { data: fromOrder } =
    sp.novo === '1' && sp.os && /^[0-9a-f-]{36}$/i.test(sp.os)
      ? await supabase
          .from('service_orders')
          .select('id, number, plot_id, variety_id, destination, assignee, expected_unit')
          .eq('id', sp.os)
          .eq('farm_id', ctx.farm.id)
          .eq('kind', 'colheita')
          .eq('status', 'aberta')
          .maybeSingle()
      : { data: null }

  const simPlots: SimPlot[] =
    tab === 'simulador'
      ? (
          (
            await supabase
              .from('plots')
              .select('id, code, name, area, row_spacing, plant_spacing, plant_count, varieties(name)')
              .eq('farm_id', ctx.farm.id)
              .neq('status', 'inativo')
              .order('code')
          ).data ?? []
        ).map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          area: Number(p.area),
          row_spacing: p.row_spacing === null ? null : Number(p.row_spacing),
          plant_spacing: p.plant_spacing === null ? null : Number(p.plant_spacing),
          plant_count: p.plant_count,
          variety: (p.varieties as { name: string } | null)?.name ?? null,
        }))
      : []

  const [options, records, forecast, perf, list, editing] = await Promise.all([
    getFormOptions(ctx.farm.id),
    recordsQuery,
    season
      ? supabase
          .from('v_forecast')
          .select('*')
          .eq('farm_id', ctx.farm.id)
          .eq('season_id', season.id)
          .order('code')
      : Promise.resolve({ data: null }),
    // Sem safra cadastrada, cai no acumulado geral por talhao.
    season
      ? Promise.resolve({ data: null })
      : supabase.from('v_plot_performance').select('*').eq('farm_id', ctx.farm.id).order('code'),
    listQuery.order('harvest_date', { ascending: false }).limit(1000),
    sp.editar
      ? supabase.from('production_records').select('*').eq('id', sp.editar).eq('farm_id', ctx.farm.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const listRows = list.data ?? []
  const listTotal = list.count ?? listRows.length

  const rows = records.data ?? []

  const plots: PlotRow[] = forecast.data
    ? forecast.data.map((f) => ({
        plot_id: f.plot_id!,
        code: f.code ?? '',
        crop_name: f.crop_name,
        variety_name: f.variety_name,
        area: Number(f.area ?? 0),
        realized_kg: Number(f.realized_kg ?? 0),
        expected_t_ha: f.expected_t_ha !== null ? Number(f.expected_t_ha) : null,
      }))
    : (perf.data ?? []).map((p) => ({
        plot_id: p.plot_id!,
        code: p.code ?? '',
        crop_name: p.crop_name,
        variety_name: p.variety_name,
        area: Number(p.area ?? 0),
        realized_kg: Number(p.production_kg ?? 0),
        expected_t_ha: null,
      }))

  // Total pela view (sem limite de linhas); a lista so' serve para exibir.
  const totalKg = forecast.data
    ? plots.reduce((s, p) => s + p.realized_kg, 0)
    : rows.reduce((s, r) => s + Number(r.quantity_kg), 0)
  const totalArea = plots.reduce((s, p) => s + p.area, 0)

  // Previsao: so' conta o realizado dos talhoes que tem previsao, senao o
  // percentual fica inflado por talhao sem meta.
  const withForecast = plots.filter((p) => p.expected_t_ha !== null)
  const expectedKg = withForecast.reduce((s, p) => s + p.expected_t_ha! * p.area * 1000, 0)
  const realizedOnForecast = withForecast.reduce((s, p) => s + p.realized_kg, 0)
  const pct = expectedKg > 0 ? (realizedOnForecast / expectedKg) * 100 : null

  // Previsto x realizado por variedade (a variedade vem do talhao).
  const byVariety = new Map<
    string,
    { area: number; expectedKg: number; realizedKg: number; forecastArea: number; realizedOnForecast: number }
  >()
  for (const p of plots) {
    const key = p.variety_name ?? p.crop_name ?? 'Sem variedade'
    const cur = byVariety.get(key) ?? {
      area: 0,
      expectedKg: 0,
      realizedKg: 0,
      forecastArea: 0,
      realizedOnForecast: 0,
    }
    cur.area += p.area
    cur.realizedKg += p.realized_kg
    if (p.expected_t_ha !== null) {
      cur.expectedKg += p.expected_t_ha * p.area * 1000
      cur.forecastArea += p.area
      cur.realizedOnForecast += p.realized_kg
    }
    byVariety.set(key, cur)
  }
  const varietyRows = [...byVariety.entries()].sort(
    (a, b) => b[1].expectedKg + b[1].realizedKg - (a[1].expectedKg + a[1].realizedKg),
  )

  const forecastRows: ForecastRow[] = plots.map((p) => ({
    plot_id: p.plot_id,
    code: p.code,
    area: p.area,
    variety_name: p.variety_name,
    crop_name: p.crop_name,
    expected_t_ha: p.expected_t_ha,
    realized_kg: p.realized_kg,
  }))

  const gap = expectedKg - realizedOnForecast

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Produção"
        subtitle={season ? `Safra ${season.name}` : 'Todas as safras'}
        actions={
          <>
            <ButtonLink href={'/ordens?nova=colheita' as Route} variant="secondary">
              Ordem de serviço
            </ButtonLink>
            <ButtonLink href="/producao?novo=1">Registrar colheita</ButtonLink>
          </>
        }
      />

      {sp.novo === '1' && (
        <ProductionForm
          key={fromOrder?.id ?? 'novo'}
          plots={options.plots}
          varieties={options.varieties}
          destinations={options.destinations}
          closeHref={fromOrder ? ('/ordens' as Route) : closeLink('/producao', sp)}
          serviceOrder={fromOrder ? { id: fromOrder.id, number: fromOrder.number } : undefined}
          initial={
            fromOrder
              ? {
                  plot_id: fromOrder.plot_id,
                  variety_id: fromOrder.variety_id,
                  destination: fromOrder.destination,
                  team: fromOrder.assignee,
                  unit: fromOrder.expected_unit ?? 'kg',
                  notes: `OS ${String(fromOrder.number).padStart(4, '0')}`,
                }
              : undefined
          }
        />
      )}
      {editing.data && (
        <ProductionForm
          key={editing.data.id}
          plots={options.plots}
          varieties={options.varieties}
          destinations={options.destinations}
          closeHref={closeLink('/producao', sp)}
          initial={editing.data}
        />
      )}

      <MetricStrip>
        <Metric label="Produção da safra" value={kg(totalKg, { asTon: true })} />
        <Metric
          label="Produtividade"
          value={totalArea > 0 ? `${num(totalKg / 1000 / totalArea, 1)} t/ha` : '—'}
        />
        <Metric
          label="Previsão da safra"
          value={expectedKg > 0 ? tons(expectedKg) : '—'}
          hint={
            pct !== null
              ? `${num(pct, 0)}% já realizado`
              : season
                ? 'ainda não informada'
                : undefined
          }
          tone={pct !== null && pct >= 100 ? 'positive' : 'neutral'}
        />
        <Metric label="Colheitas" value={num(rows.length)} />
        <Metric label="Área" value={area(totalArea)} />
      </MetricStrip>

      <Tabs items={TABS} />

      {tab === 'resumo' && (
        <>
          {season && (
            <Section title="Como está a safra">
              {expectedKg === 0 ? (
                <p className="text-sm text-text-muted">
                  Informe a previsão em toneladas por hectare de cada talhão para acompanhar se a
                  safra está indo bem.{' '}
                  <Link
                    href="/producao?aba=previsao"
                    className="font-medium text-accent-text hover:underline"
                  >
                    Informar previsão
                  </Link>
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="max-w-[70ch] text-sm leading-relaxed text-text">
                    Foram colhidas <span className="num font-semibold">{tons(realizedOnForecast)}</span>{' '}
                    de <span className="num font-semibold">{tons(expectedKg)}</span> previstas
                    {gap > 0 ? (
                      <>
                        {' '}— faltam <span className="num font-semibold">{tons(gap)}</span> para
                        chegar à previsão.
                      </>
                    ) : (
                      <>
                        {' '}— <span className="num font-semibold">{tons(-gap)}</span> acima do
                        previsto.
                      </>
                    )}
                  </p>
                  <div className="max-w-xl">
                    <AchievedBar pct={pct} />
                  </div>
                </div>
              )}
            </Section>
          )}

          <Section title="Produção por talhão">
            {plots.length === 0 ? (
              <EmptyState title="Cadastre talhões para acompanhar a produção" />
            ) : (
              <ul className="divide-y divide-line">
                {plots
                  .slice()
                  .sort((a, b) => b.realized_kg - a.realized_kg)
                  .map((p) => {
                    const share = totalKg > 0 ? (p.realized_kg / totalKg) * 100 : 0
                    return (
                      <li key={p.plot_id} className="py-3">
                        <div className="flex items-baseline justify-between gap-4 text-sm">
                          <span className="num font-medium">{p.code}</span>
                          <span className="min-w-0 flex-1 truncate text-text-muted">
                            {[p.crop_name, p.variety_name].filter(Boolean).join(' · ')}
                          </span>
                          <span className="num shrink-0">{kg(p.realized_kg)}</span>
                          <span className="num w-20 shrink-0 text-right text-xs text-text-faint">
                            {p.area > 0 ? `${num(p.realized_kg / 1000 / p.area, 1)} t/ha` : '—'}
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
        </>
      )}

      {tab === 'previsao' &&
        (!season ? (
          <EmptyState
            title="Crie uma safra para informar a previsão"
            description="A previsão é feita por safra, para comparar com o que foi colhido nela."
            action={<ButtonLink href="/safras?novo=1">Criar safra</ButtonLink>}
          />
        ) : plots.length === 0 ? (
          <EmptyState
            title="Cadastre talhões para informar a previsão"
            action={<ButtonLink href="/talhoes/novo">Cadastrar talhão</ButtonLink>}
          />
        ) : (
          <Section
            title={`Previsão x realizado · safra ${season.name}`}
            description="Previsão em toneladas por hectare. O volume previsto e o percentual atingido são calculados sozinhos."
          >
            <ForecastForm rows={forecastRows} seasonName={season.name} />
          </Section>
        ))}

      {tab === 'colheita' && (
        <>
          <FilterBar
            exportType="colheitas"
            selects={[{ param: 'talhao', label: 'Talhão', options: options.plots.map((p) => ({ value: p.id, label: p.code })) }]}
          />
          <Section
            title={season ? `Colheitas da safra ${season.name}` : 'Todas as colheitas'}
            description={listTotal > listRows.length ? `Mostrando ${listRows.length} de ${listTotal}.` : undefined}
          >
            {listRows.length === 0 ? (
              <EmptyState
                title="Nenhuma colheita no período"
                description="Registre a primeira colheita e a produção por talhão, por hectare e por variedade aparece na hora."
                action={<ButtonLink href="/producao?novo=1">Registrar colheita</ButtonLink>}
              />
            ) : (
              <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
                  <colgroup>
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '9%' }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-line-strong text-left">
                      {[['Data', ''], ['Talhão', ''], ['Variedade', ''], ['Quantidade', 'text-right'], ['Total', 'text-right'], ['Destino', 'pl-4'], ['', '']].map(
                        ([h, cls], i) => (
                          <th key={i} className={`pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-faint ${cls}`}>
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {listRows.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-bg-sunken/60">
                        <td className="num py-2.5 text-text-muted">{date(r.harvest_date)}</td>
                        <td className="num py-2.5 font-medium">{(r.plots as { code: string } | null)?.code ?? '—'}</td>
                        <td className="truncate py-2.5 text-text-muted">{(r.varieties as { name: string } | null)?.name ?? '—'}</td>
                        <td className="num py-2.5 text-right">
                          {num(Number(r.quantity), 2)} {UNIT_LABEL[r.unit]}
                        </td>
                        <td className="num py-2.5 text-right font-medium">{kg(Number(r.quantity_kg))}</td>
                        <td className="truncate py-2.5 pl-4 text-text-muted">{r.destination ?? '—'}</td>
                        <td className="py-2 text-right">
                          <RowActions id={r.id} kind="colheita" editHref={editLink('/producao', sp, r.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}

      {tab === 'talhoes' && (
        <Section title="Desempenho por talhão">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
              <colgroup>
                <col style={{ width: '10%' }} />
                <col style={{ width: '34%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-line-strong text-left">
                  {['Talhão', 'Cultura', 'Área', 'Produção', 't/ha realizado', 't/ha previsto'].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={`pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-faint ${i > 1 ? 'text-right' : ''}`}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {plots.map((p) => (
                  <tr key={p.plot_id}>
                    <td className="num py-2.5 font-medium">{p.code}</td>
                    <td className="truncate py-2.5 pr-3 text-text-muted">
                      {[p.crop_name, p.variety_name].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="num py-2.5 text-right">{area(p.area)}</td>
                    <td className="num py-2.5 text-right">{kg(p.realized_kg)}</td>
                    <td className="num py-2.5 text-right">
                      {p.area > 0 ? num(p.realized_kg / 1000 / p.area, 1) : '—'}
                    </td>
                    <td className="num py-2.5 text-right text-text-muted">
                      {p.expected_t_ha !== null ? num(p.expected_t_ha, 1) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tab === 'simulador' && (
        <Section
          title="Simulador de produção — uva"
          description="Diga quanto quer colher e a ferramenta calcula, de trás para frente, cachos, brotos, gemas e a poda: varas por saída e gemas por vara, já descontando as perdas da colheita."
        >
          <Simulator plots={simPlots} seasonName={season?.name ?? null} />
        </Section>
      )}

      {tab === 'variedades' && (
        <Section
          title="Previsão x realizado por variedade"
          description="Soma dos talhões de cada variedade. Sem previsão informada, mostra só o realizado."
        >
          {varietyRows.length === 0 ? (
            <EmptyState title="Cadastre talhões com variedade para ver este comparativo" />
          ) : (
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
                <colgroup>
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '22%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-line-strong text-left">
                    {[
                      ['Variedade', ''],
                      ['Área', 'text-right'],
                      ['Previsto', 'text-right'],
                      ['Realizado', 'text-right'],
                      ['t/ha previsto', 'text-right'],
                      ['t/ha realizado', 'text-right'],
                      ['% da previsão', 'pl-4'],
                    ].map(([h, cls]) => (
                      <th
                        key={h}
                        className={`pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-faint ${cls}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {varietyRows.map(([name, v]) => {
                    const vPct =
                      v.expectedKg > 0 ? (v.realizedOnForecast / v.expectedKg) * 100 : null
                    return (
                      <tr key={name}>
                        <td className="truncate py-2.5 pr-3 font-medium">{name}</td>
                        <td className="num py-2.5 text-right text-text-muted">
                          {num(v.area, 2)} ha
                        </td>
                        <td className="num py-2.5 text-right">
                          {v.expectedKg > 0 ? tons(v.expectedKg) : '—'}
                        </td>
                        <td className="num py-2.5 text-right">{tons(v.realizedKg)}</td>
                        <td className="num py-2.5 text-right text-text-muted">
                          {v.forecastArea > 0 ? num(v.expectedKg / 1000 / v.forecastArea, 1) : '—'}
                        </td>
                        <td className="num py-2.5 text-right text-text-muted">
                          {v.area > 0 ? num(v.realizedKg / 1000 / v.area, 1) : '—'}
                        </td>
                        <td className="py-2.5 pl-4">
                          <AchievedBar pct={vPct} />
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
