import Link from 'next/link'
import type { Route } from 'next'
import type { Metadata } from 'next'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { getFormOptions } from '@/lib/queries/options'
import { date, kg, money, num, relativeDay, taxId } from '@/lib/format'
import { PageHeader, EmptyState, Badge, Metric, MetricStrip, Section } from '@/components/ui/Layout'
import { ButtonLink } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { SaleForm } from '@/components/forms/SaleForm'
import { FilterBar } from '@/components/ui/FilterBar'
import { RowActions } from '@/components/ui/RowActions'
import { byDate, eqIf, readFilters } from '@/lib/filters'
import { closeLink, editLink, withParams } from '@/lib/url'
import { BuyerForm } from '@/components/forms/StockForms'
import { ReceiveSaleButton } from './ReceiveSaleButton'

export const metadata: Metadata = { title: 'Comercialização' }

export default async function ComercializacaoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const [ctx, sp] = await Promise.all([requireFarm(), searchParams])
  const supabase = await createClient()
  const tab = sp.aba ?? 'resumo'

  const seasonMatch = ctx.season ? { season_id: ctx.season.id } : {}
  const f = readFilters(sp)

  let salesQuery = supabase
    .from('sales')
    .select('*, buyers(name), plots(code)', { count: 'exact' })
    .eq('farm_id', ctx.farm.id)
    .match(seasonMatch)
  salesQuery = eqIf(eqIf(byDate(salesQuery, 'sale_date', f), 'buyer_id', f.comprador), 'plot_id', f.talhao)

  // Vendas, preco medio e preco por comprador: da safra escolhida.
  // A receber: de todas as safras — dinheiro devido nao some com a safra.
  const [options, sales, buyers, summary, openSales, editingSale, editingBuyer] = await Promise.all([
    getFormOptions(ctx.farm.id),
    salesQuery.order('sale_date', { ascending: false }).limit(1000),
    supabase.from('buyers').select('*').eq('farm_id', ctx.farm.id).order('name'),
    supabase.from('v_sales_summary').select('*').eq('farm_id', ctx.farm.id).match(seasonMatch),
    supabase
      .from('sales')
      .select('*, buyers(name), plots(code)')
      .eq('farm_id', ctx.farm.id)
      .neq('status', 'pago')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(1000),
    sp.editar
      ? supabase.from('sales').select('*').eq('id', sp.editar).eq('farm_id', ctx.farm.id).maybeSingle()
      : Promise.resolve({ data: null }),
    sp.editar_comprador
      ? supabase.from('buyers').select('*').eq('id', sp.editar_comprador).eq('farm_id', ctx.farm.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const close = withParams('/comercializacao', sp, { editar: null, novo: null, novo_comprador: null, editar_comprador: null })

  const rows = sales.data ?? []
  const salesCount = sales.count ?? rows.length
  const buyerList = buyers.data ?? []
  const open = openSales.data ?? []

  // Preco por comprador somado no banco (v_sales_summary), sem limite.
  const byBuyer = new Map<
    string,
    { buyer_id: string | null; buyer_name: string | null; sales_count: number; total_kg: number; total_amount: number }
  >()
  for (const r of summary.data ?? []) {
    const key = r.buyer_id ?? 'sem'
    const cur = byBuyer.get(key) ?? {
      buyer_id: r.buyer_id, buyer_name: r.buyer_name, sales_count: 0, total_kg: 0, total_amount: 0,
    }
    cur.sales_count += Number(r.sales_count ?? 0)
    cur.total_kg += Number(r.total_kg ?? 0)
    cur.total_amount += Number(r.total_amount ?? 0)
    byBuyer.set(key, cur)
  }
  const priceRows = [...byBuyer.values()]
    .map((b) => ({ ...b, avg_price_per_kg: b.total_kg > 0 ? b.total_amount / b.total_kg : null }))
    .sort((a, b) => Number(b.avg_price_per_kg ?? 0) - Number(a.avg_price_per_kg ?? 0))

  const soldKg = priceRows.reduce((s, r) => s + r.total_kg, 0)
  const revenue = priceRows.reduce((s, r) => s + r.total_amount, 0)
  const received = (summary.data ?? []).reduce((s, r) => s + Number(r.received_amount ?? 0), 0)
  const receivable = open.reduce(
    (s, r) => s + (Number(r.total_amount) - Number(r.received_amount)),
    0,
  )

  const TABS = [
    { key: 'resumo', label: 'Resumo' },
    { key: 'vendas', label: 'Vendas', count: salesCount },
    { key: 'compradores', label: 'Compradores', count: buyerList.length },
    { key: 'receber', label: 'A receber', count: open.length },
    { key: 'precos', label: 'Preços' },
  ]

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Comercialização"
        subtitle={ctx.season ? `Safra ${ctx.season.name}` : undefined}
        actions={
          <>
            <ButtonLink href="/comercializacao?novo_comprador=1" variant="secondary">
              Novo comprador
            </ButtonLink>
            <ButtonLink href="/comercializacao?novo=1">Registrar venda</ButtonLink>
          </>
        }
      />

      {sp.novo_comprador === '1' && <BuyerForm closeHref={close} />}
      {editingBuyer.data && <BuyerForm key={editingBuyer.data.id} closeHref={close} initial={editingBuyer.data} />}
      {editingSale.data && (
        <SaleForm
          key={editingSale.data.id}
          plots={options.plots}
          buyers={options.buyers}
          varieties={options.varieties}
          closeHref={closeLink('/comercializacao', sp)}
          initial={editingSale.data}
        />
      )}
      {sp.novo === '1' &&
        (buyerList.length === 0 ? (
          <EmptyState
            title="Cadastre um comprador antes de registrar a venda"
            description="Saber para quem você vendeu é o que permite comparar preço por comprador."
            action={<ButtonLink href="/comercializacao?novo_comprador=1">Novo comprador</ButtonLink>}
          />
        ) : (
          <SaleForm
            plots={options.plots}
            buyers={options.buyers}
            varieties={options.varieties}
            closeHref={closeLink('/comercializacao', sp)}
          />
        ))}

      <MetricStrip>
        <Metric label="Produção vendida" value={kg(soldKg, { asTon: true })} />
        <Metric
          label="Preço médio"
          value={soldKg > 0 ? `${money(revenue / soldKg)}/kg` : '—'}
        />
        <Metric label="Receita" value={money(revenue, { compact: true })} />
        <Metric label="Recebido" value={money(received, { compact: true })} tone="positive" />
        <Metric
          label="A receber"
          value={money(receivable, { compact: true })}
          hint="de todas as safras"
          tone={receivable > 0 ? 'warn' : 'neutral'}
        />
      </MetricStrip>

      <Tabs items={TABS} />

      {tab === 'vendas' && (
        <FilterBar
          exportType="vendas"
          selects={[
            { param: 'comprador', label: 'Comprador', options: buyerList.map((b) => ({ value: b.id, label: b.name })) },
            { param: 'talhao', label: 'Talhão', options: options.plots.map((p) => ({ value: p.id, label: p.code })) },
          ]}
        />
      )}

      {tab === 'resumo' && (
        <Section title="Preço por comprador">
          {priceRows.length === 0 ? (
            <EmptyState
              title="Nenhuma venda registrada"
              description="Registre suas vendas para descobrir qual comprador paga melhor."
              action={<ButtonLink href="/comercializacao?novo=1">Registrar venda</ButtonLink>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {priceRows.map((r) => {
                const best = Number(priceRows[0]?.avg_price_per_kg ?? 0)
                const share = best > 0 ? (Number(r.avg_price_per_kg ?? 0) / best) * 100 : 0
                return (
                  <li key={r.buyer_id ?? 'sem'} className="py-3">
                    <div className="flex items-baseline justify-between gap-4 text-sm">
                      <span className="min-w-0 flex-1 truncate">
                        {r.buyer_name ?? 'Sem comprador'}
                      </span>
                      <span className="num text-text-muted">{kg(Number(r.total_kg ?? 0))}</span>
                      <span className="num w-24 shrink-0 text-right font-medium">
                        {r.avg_price_per_kg ? `${money(Number(r.avg_price_per_kg))}/kg` : '—'}
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
      )}

      {(tab === 'vendas' || tab === 'receber') && (
        <Section
          title={
            tab === 'receber'
              ? 'Vendas a receber · todas as safras'
              : ctx.season
                ? `Vendas da safra ${ctx.season.name}`
                : 'Todas as vendas'
          }
          description={
            tab !== 'receber' && salesCount > rows.length
              ? `Mostrando as ${rows.length} mais recentes de ${salesCount}.`
              : tab === 'vendas'
                ? `${salesCount} venda(s) · ${kg(rows.reduce((a, r) => a + Number(r.quantity_kg), 0))} · ${money(rows.reduce((a, r) => a + Number(r.total_amount), 0))}`
                : undefined
          }
        >
          {(tab === 'receber' ? open : rows).length === 0 ? (
            <EmptyState
              title={tab === 'receber' ? 'Nada a receber' : 'Nenhuma venda registrada'}
            />
          ) : (
            <ul className="divide-y divide-line">
              {(tab === 'receber' ? open : rows).map((r) => {
                const buyer = r.buyers as { name: string } | null
                const plot = r.plots as { code: string } | null
                const pending = Number(r.total_amount) - Number(r.received_amount)
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3 text-sm">
                    <span className="num w-20 shrink-0 text-text-muted">{date(r.sale_date)}</span>
                    <span className="min-w-0 flex-1 truncate">{buyer?.name ?? '—'}</span>
                    {plot && (
                      <Link
                        href={`/talhoes/${r.plot_id}` as Route}
                        className="num w-12 shrink-0 text-xs text-text-faint hover:text-accent-text"
                      >
                        {plot.code}
                      </Link>
                    )}
                    <span className="num shrink-0 text-text-muted">
                      {kg(Number(r.quantity_kg))}
                    </span>
                    <span className="num shrink-0 text-xs text-text-faint">
                      {money(Number(r.price_per_kg))}/kg
                    </span>

                    {r.status === 'pago' ? (
                      <Badge tone="accent">recebido</Badge>
                    ) : (
                      <>
                        <Badge tone={r.status === 'parcial' ? 'warn' : 'neutral'}>
                          {r.status === 'parcial'
                            ? `falta ${money(pending)}`
                            : r.due_date
                              ? `vence ${relativeDay(r.due_date)}`
                              : 'a receber'}
                        </Badge>
                        <ReceiveSaleButton id={r.id} />
                      </>
                    )}

                    <span className="num w-24 shrink-0 text-right font-medium">
                      {money(Number(r.total_amount))}
                    </span>
                    <RowActions
                      id={r.id}
                      kind="venda"
                      editHref={editLink('/comercializacao', sp, r.id)}
                      confirm="Excluir a venda? A receita some do financeiro."
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </Section>
      )}

      {tab === 'compradores' && (
        <Section title="Compradores">
          {buyerList.length === 0 ? (
            <EmptyState
              title="Nenhum comprador cadastrado"
              action={<ButtonLink href="/comercializacao?novo_comprador=1">Novo comprador</ButtonLink>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {buyerList.map((b) => {
                const stat = priceRows.find((p) => p.buyer_id === b.id)
                return (
                  <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{b.name}</span>
                      <span className="block truncate text-xs text-text-faint">
                        {[b.location, b.phone, b.tax_id && taxId(b.tax_id)]
                          .filter(Boolean)
                          .join(' · ') || 'sem contato'}
                      </span>
                    </span>
                    {stat && (
                      <>
                        <span className="num shrink-0 text-text-muted">
                          {kg(Number(stat.total_kg ?? 0))}
                        </span>
                        <span className="num w-24 shrink-0 text-right">
                          {money(Number(stat.total_amount ?? 0), { compact: true })}
                        </span>
                      </>
                    )}
                    <RowActions
                      id={b.id}
                      kind="comprador"
                      editHref={withParams('/comercializacao', sp, { editar_comprador: b.id, novo_comprador: null, editar: null, novo: null })}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </Section>
      )}

      {tab === 'precos' && (
        <Section title="Preço por comprador">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[520px] table-fixed border-collapse text-sm">
              <colgroup>
                <col style={{ width: '34%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-line-strong text-left">
                  {['Comprador', 'Vendas', 'Quantidade', 'Total', 'Preço médio'].map((h, i) => (
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
                {priceRows.map((r) => (
                  <tr key={r.buyer_id ?? 'sem'}>
                    <td className="py-2.5">{r.buyer_name ?? 'Sem comprador'}</td>
                    <td className="num py-2.5 text-right text-text-muted">
                      {num(Number(r.sales_count ?? 0))}
                    </td>
                    <td className="num py-2.5 text-right">{kg(Number(r.total_kg ?? 0))}</td>
                    <td className="num py-2.5 text-right">
                      {money(Number(r.total_amount ?? 0))}
                    </td>
                    <td className="num py-2.5 text-right font-medium">
                      {r.avg_price_per_kg ? money(Number(r.avg_price_per_kg)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  )
}
