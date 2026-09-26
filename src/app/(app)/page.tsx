import Link from 'next/link'
import type { Route } from 'next'
import {
  ArrowRightIcon,
  CheckCircleIcon,
  SparkleIcon,
  WarningIcon,
} from '@phosphor-icons/react/dist/ssr'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { getAttentionItems, plotLevel } from '@/lib/queries/attention'
import { getPlotPerformance } from '@/lib/queries/plot-performance'
import { area, kg, money, num } from '@/lib/format'
import { Metric, MetricStrip, Section, StatusDot, EmptyState } from '@/components/ui/Layout'
import { ButtonLink } from '@/components/ui/Button'

export default async function PainelPage() {
  const ctx = await requireFarm()
  const supabase = await createClient()

  // Faixa do topo e cartoes dos talhoes vem da mesma safra — antes os
  // cartoes somavam todas as safras e os numeros da tela nao batiam.
  const overviewQuery = supabase.from('v_farm_overview').select('*').eq('farm_id', ctx.farm.id)

  const [overview, plotList, attention] = await Promise.all([
    (ctx.season
      ? overviewQuery.eq('season_id', ctx.season.id)
      : overviewQuery.is('season_id', null)
    ).maybeSingle(),
    getPlotPerformance(ctx.farm.id, ctx.season?.id),
    getAttentionItems(ctx.farm.id, ctx.season?.id),
  ])

  const o = overview.data
  const local = [ctx.farm.community, ctx.farm.city && `${ctx.farm.city}/${ctx.farm.state ?? ''}`]
    .filter(Boolean)
    .join(' — ')

  const result = Number(o?.result ?? 0)
  const hasData = Number(o?.production_kg ?? 0) > 0 || Number(o?.cash_out ?? 0) > 0

  return (
    <div className="flex flex-col gap-10">
      {/* ---- cabecalho da propriedade (secao 22) ---- */}
      <header>
        <h1 className="text-3xl font-semibold leading-tight tracking-tighter sm:text-4xl">
          {ctx.farm.name}
        </h1>
        {local && <p className="mt-1.5 text-sm text-text-muted">{local}</p>}
        <p className="num mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
          <span>{area(Number(ctx.farm.total_area), ctx.farm.area_unit)}</span>
          <span aria-hidden className="text-line-strong">·</span>
          <span>
            {plotList.length} {plotList.length === 1 ? 'talhão' : 'talhões'}
          </span>
          {ctx.season && (
            <>
              <span aria-hidden className="text-line-strong">·</span>
              <span>Safra {ctx.season.name}</span>
            </>
          )}
        </p>
      </header>

      {/* ---- faixa de indicadores (secao 22) ---- */}
      <MetricStrip>
        <Metric label="Produção" value={kg(Number(o?.production_kg ?? 0), { asTon: true })} />
        <Metric label="Receita" value={money(Number(o?.revenue ?? 0), { compact: true })} />
        <Metric label="Despesas" value={money(Number(o?.cash_out ?? 0), { compact: true })} />
        <Metric
          label="Resultado"
          value={money(result, { compact: true })}
          tone={result > 0 ? 'positive' : result < 0 ? 'negative' : 'neutral'}
        />
        <Metric
          label="Custo por kg"
          value={o?.cost_per_kg ? money(Number(o.cost_per_kg)) : '—'}
          hint={o?.avg_price_per_kg ? `preço médio ${money(Number(o.avg_price_per_kg))}` : undefined}
        />
      </MetricStrip>

      {!hasData && (
        <EmptyState
          title="Sua propriedade ainda não tem lançamentos"
          description="Registre uma colheita, uma despesa ou uma venda e os números aparecem aqui na hora."
          action={<ButtonLink href="/producao?novo=1">Registrar colheita</ButtonLink>}
        />
      )}

      {/* ---- o que precisa da minha atencao (secao 24) ---- */}
      <Section title="O que precisa da minha atenção">
        {attention.items.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-accent-text">
            <CheckCircleIcon size={18} weight="fill" />
            Nada pendente por aqui.
          </p>
        ) : (
          <ul className="stagger divide-y divide-line">
            {attention.items.slice(0, 7).map((item, i) => (
              <li key={item.id} style={{ '--i': i } as React.CSSProperties}>
                <Link
                  href={(item.href ?? '/') as Route}
                  className="group flex items-start gap-3 py-3 transition-colors hover:bg-bg-sunken/60"
                >
                  <WarningIcon
                    size={17}
                    weight="fill"
                    className={`mt-px shrink-0 ${
                      item.severity === 'critico' ? 'text-danger' : 'text-warn'
                    }`}
                  />
                  <span className="min-w-0 flex-1 text-sm text-text">{item.text}</span>
                  <ArrowRightIcon
                    size={15}
                    className="mt-0.5 shrink-0 text-text-faint opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {attention.completion !== null && (
          <p className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-sm text-text-muted">
            <CheckCircleIcon size={17} weight="fill" className="text-accent" />
            <span className="num">{attention.completion}%</span> das atividades da semana concluídas
          </p>
        )}
      </Section>

      {/* ---- talhoes (secao 23) ---- */}
      <Section
        title="Talhões"
        actions={
          <Link
            href="/talhoes"
            className="text-xs font-medium text-accent-text hover:underline"
          >
            Ver todos
          </Link>
        }
      >
        {plotList.length === 0 ? (
          <EmptyState
            title="Nenhum talhão cadastrado"
            description="O talhão é o centro do sistema: é nele que produção, custo e resultado se encontram."
            action={<ButtonLink href="/talhoes/novo">Cadastrar talhão</ButtonLink>}
          />
        ) : (
          <ul className="stagger grid gap-px overflow-hidden rounded-lg bg-line sm:grid-cols-2 lg:grid-cols-3">
            {plotList.map((p, i) => {
              const level = plotLevel(attention.items, p.code ?? '', p.plot_id ?? '')
              return (
                <li key={p.plot_id} style={{ '--i': i } as React.CSSProperties}>
                  <Link
                    href={`/talhoes/${p.plot_id}` as Route}
                    className="flex h-full flex-col gap-3 bg-bg-raised p-4 transition-colors hover:bg-bg-sunken/70"
                  >
                    <div className="flex items-center gap-2">
                      <StatusDot level={level} />
                      <span className="num text-sm font-semibold tracking-tight">{p.code}</span>
                      <span className="truncate text-xs text-text-muted">
                        {[p.crop_name, p.variety_name].filter(Boolean).join(' · ')}
                      </span>
                      <span className="num ml-auto shrink-0 text-xs text-text-faint">
                        {area(Number(p.area ?? 0))}
                      </span>
                    </div>

                    <dl className="grid grid-cols-3 gap-2 border-t border-line pt-3">
                      <div>
                        <dt className="text-[10px] uppercase tracking-[0.1em] text-text-faint">
                          Produção
                        </dt>
                        <dd className="num mt-0.5 text-sm">{kg(Number(p.production_kg ?? 0))}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-[0.1em] text-text-faint">
                          Custo/kg
                        </dt>
                        <dd className="num mt-0.5 text-sm">
                          {p.cost_per_kg ? money(Number(p.cost_per_kg)) : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-[0.1em] text-text-faint">
                          Resultado
                        </dt>
                        <dd
                          className={`num mt-0.5 text-sm ${
                            Number(p.result ?? 0) > 0
                              ? 'text-accent-text'
                              : Number(p.result ?? 0) < 0
                                ? 'text-danger'
                                : ''
                          }`}
                        >
                          {money(Number(p.result ?? 0), { compact: true })}
                        </dd>
                      </div>
                    </dl>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      {/* ---- resultado da safra em cascata (secao 25) ---- */}
      {hasData && (
        <Section title="Resultado da safra">
          <ol className="grid gap-px overflow-hidden rounded-lg bg-line sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Produzi', value: kg(Number(o?.production_kg ?? 0), { asTon: true }), sub: `${num(Number(o?.sold_kg ?? 0))} kg vendidos` },
              { label: 'Recebi em vendas', value: money(Number(o?.revenue ?? 0)), sub: `${money(Number(o?.receivable ?? 0))} ainda a receber` },
              { label: 'Gastei na produção', value: money(Number(o?.production_cost ?? 0)), sub: o?.cost_per_kg ? `${money(Number(o.cost_per_kg))} por kg` : undefined },
              { label: 'Sobrou', value: money(result), sub: 'receita menos custo de produção', tone: true },
            ].map((step, i) => (
              <li key={step.label} className="bg-bg-raised p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                  {i + 1}. {step.label}
                </p>
                <p
                  className={`num mt-2 text-xl font-semibold tracking-tight ${
                    step.tone
                      ? result > 0
                        ? 'text-accent-text'
                        : result < 0
                          ? 'text-danger'
                          : ''
                      : ''
                  }`}
                >
                  {step.value}
                </p>
                {step.sub && <p className="mt-1 text-xs text-text-muted">{step.sub}</p>}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* ---- atalho para a IA (secao 29) ---- */}
      <Link
        href="/assistente"
        className="press group flex items-center gap-3 rounded-lg border border-line-strong bg-bg-raised px-5 py-4 transition-colors hover:border-accent"
      >
        <SparkleIcon size={20} weight="fill" className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Perguntar sobre minha fazenda</span>
          <span className="block truncate text-xs text-text-muted">
            &ldquo;Quanto gastei este mês?&rdquo; · &ldquo;Qual talhão teve maior custo?&rdquo;
          </span>
        </span>
        <ArrowRightIcon
          size={16}
          className="shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </div>
  )
}
