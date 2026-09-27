import type { Metadata, Route } from 'next'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { byDate, eqIf, readFilters } from '@/lib/filters'
import { closeLink, editLink, withParams } from '@/lib/url'
import { date, money, num, UNIT_LABEL } from '@/lib/format'
import {
  PageHeader,
  EmptyState,
  Badge,
  Metric,
  MetricStrip,
  Section,
  StatusDot,
} from '@/components/ui/Layout'
import { ButtonLink } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { FilterBar } from '@/components/ui/FilterBar'
import { RowActions } from '@/components/ui/RowActions'
import { MovementForm, ProductForm } from '@/components/forms/StockForms'

export const metadata: Metadata = { title: 'Estoque' }

type SP = Record<string, string | undefined>

const LEVEL_LABEL = { normal: 'Normal', baixo: 'Baixo', critico: 'Comprar' } as const
const MOVE_LABEL = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste' } as const

/** Movimentos gerados por outro lancamento: editar/excluir na origem. */
const SOURCE: Record<string, { label: string; path: string; edit: boolean }> = {
  applications: { label: 'Pulverização', path: '/pulverizacao', edit: true },
  fertilizations: { label: 'Adubação', path: '/adubacao', edit: true },
  machine_logs: { label: 'Máquina', path: '/maquinas?aba=manutencoes', edit: false },
}

export default async function EstoquePage({ searchParams }: { searchParams: Promise<SP> }) {
  const [ctx, sp] = await Promise.all([requireFarm(), searchParams])
  const supabase = await createClient()
  const tab = sp.aba ?? 'geral'
  const f = readFilters(sp)

  let stockQ = supabase.from('v_stock_status').select('*').eq('farm_id', ctx.farm.id)
  stockQ = eqIf(stockQ, 'category_id', f.categoria)

  let moveQ = supabase
    .from('inventory_movements')
    .select('*, products(name, unit)', { count: 'exact' })
    .eq('farm_id', ctx.farm.id)
  moveQ = eqIf(byDate(moveQ, 'movement_date', f), 'product_id', f.produto)

  const [stock, movements, categories, editingProduct, editingMove] = await Promise.all([
    stockQ.order('name'),
    moveQ.order('movement_date', { ascending: false }).order('created_at', { ascending: false }).limit(1000),
    supabase.from('product_categories').select('id, name').order('name'),
    sp.editar_produto
      ? supabase.from('products').select('*').eq('id', sp.editar_produto).eq('farm_id', ctx.farm.id).maybeSingle()
      : Promise.resolve({ data: null }),
    sp.editar
      ? supabase.from('inventory_movements').select('*').eq('id', sp.editar).eq('farm_id', ctx.farm.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const items = stock.data ?? []
  const moves = movements.data ?? []
  const moveCount = movements.count ?? moves.length
  const alerts = items.filter((i) => i.stock_level !== 'normal')
  const totalValue = items.reduce((s, i) => s + Number(i.stock_value ?? 0), 0)
  const cats = categories.data ?? []

  const TABS = [
    { key: 'geral', label: 'Visão geral' },
    { key: 'movimentos', label: 'Movimentos', count: moveCount },
    { key: 'alertas', label: 'Alertas', count: alerts.length },
  ]

  const productOptions = items.map((i) => ({
    id: i.product_id!,
    name: i.name!,
    unit: i.unit!,
    current_stock: Number(i.current_stock ?? 0),
    unit_cost: Number(i.unit_cost ?? 0),
  }))

  const close = withParams('/estoque', sp, { editar: null, novo: null, novo_produto: null, editar_produto: null })
  const newProduct = withParams('/estoque', sp, { novo_produto: '1', novo: null, editar: null, editar_produto: null })

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Estoque"
        subtitle="Insumos, embalagens e materiais"
        actions={
          <>
            <ButtonLink href={newProduct} variant="secondary">
              Novo produto
            </ButtonLink>
            <ButtonLink href="/estoque?novo=1">Registrar movimento</ButtonLink>
          </>
        }
      />

      {sp.novo_produto === '1' && <ProductForm categories={cats} closeHref={close} />}
      {editingProduct.data && (
        <ProductForm key={editingProduct.data.id} categories={cats} closeHref={close} initial={editingProduct.data} />
      )}
      {sp.novo === '1' &&
        (productOptions.length === 0 ? (
          <EmptyState
            title="Cadastre um produto antes de movimentar o estoque"
            action={<ButtonLink href="/estoque?novo_produto=1">Novo produto</ButtonLink>}
          />
        ) : (
          <MovementForm products={productOptions} closeHref={closeLink('/estoque', sp)} />
        ))}
      {editingMove.data && (
        <MovementForm
          key={editingMove.data.id}
          products={productOptions}
          closeHref={closeLink('/estoque', sp)}
          initial={editingMove.data}
        />
      )}

      <MetricStrip>
        <Metric label="Produtos" value={num(items.length)} />
        <Metric label="Valor em estoque" value={money(totalValue, { compact: true })} />
        <Metric
          label="Precisam de compra"
          value={num(alerts.length)}
          tone={alerts.length > 0 ? 'warn' : 'neutral'}
        />
      </MetricStrip>

      <Tabs items={TABS} />

      <FilterBar
        exportType="estoque"
        dates={tab === 'movimentos'}
        selects={
          tab === 'movimentos'
            ? [{ param: 'produto', label: 'Produto', options: productOptions.map((p) => ({ value: p.id, label: p.name })) }]
            : [{ param: 'categoria', label: 'Categoria', options: cats.map((c) => ({ value: c.id, label: c.name })) }]
        }
      />

      {(tab === 'geral' || tab === 'alertas') && (
        <Section title={tab === 'alertas' ? 'Produtos abaixo do mínimo' : 'Situação do estoque'}>
          {(tab === 'alertas' ? alerts : items).length === 0 ? (
            <EmptyState
              title={tab === 'alertas' ? 'Nenhum produto abaixo do mínimo' : 'Nenhum produto cadastrado'}
              description={
                tab !== 'alertas'
                  ? 'Com o estoque cadastrado, pulverizações, adubações e máquinas dão baixa automaticamente.'
                  : undefined
              }
              action={
                tab !== 'alertas' ? <ButtonLink href={newProduct}>Cadastrar produto</ButtonLink> : undefined
              }
            />
          ) : (
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
                <colgroup>
                  <col style={{ width: '4%' }} />
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-line-strong text-left">
                    {[
                      ['', ''], ['Produto', ''], ['Saldo', 'text-right'], ['Custo médio', 'text-right'],
                      ['Valor', 'text-right'], ['Situação', 'pl-4'], ['', ''],
                    ].map(([h, cls], i) => (
                      <th key={i} className={`pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-faint ${cls}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(tab === 'alertas' ? alerts : items).map((i) => {
                    const level =
                      i.stock_level === 'critico' ? 'critico' : i.stock_level === 'baixo' ? 'atencao' : 'normal'
                    return (
                      <tr key={i.product_id} className="transition-colors hover:bg-bg-sunken/60">
                        <td className="py-2.5">
                          <StatusDot level={level} />
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="block truncate font-medium">{i.name}</span>
                          <span className="block truncate text-xs text-text-faint">{i.category ?? '—'}</span>
                        </td>
                        <td className="num py-2.5 text-right">
                          {num(Number(i.current_stock ?? 0), 2)} {UNIT_LABEL[i.unit ?? 'kg']}
                          <span className="block text-xs text-text-faint">mín. {num(Number(i.min_stock ?? 0), 2)}</span>
                        </td>
                        <td className="num py-2.5 text-right text-text-muted">
                          {Number(i.unit_cost ?? 0) > 0 ? money(Number(i.unit_cost)) : '—'}
                        </td>
                        <td className="num py-2.5 text-right font-medium">{money(Number(i.stock_value ?? 0))}</td>
                        <td className="py-2.5 pl-4">
                          {i.stock_level !== 'normal' ? (
                            <Badge tone={i.stock_level === 'critico' ? 'danger' : 'warn'}>
                              {LEVEL_LABEL[i.stock_level as keyof typeof LEVEL_LABEL]}
                            </Badge>
                          ) : (
                            <span className="text-xs text-text-faint">normal</span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          <RowActions
                            id={i.product_id!}
                            kind="produto"
                            editHref={withParams('/estoque', sp, {
                              editar_produto: i.product_id!, novo_produto: null, novo: null, editar: null,
                            })}
                            confirm="Excluir o produto? Se já teve movimentos, ele é arquivado."
                          />
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

      {tab === 'movimentos' && (
        <Section
          title="Movimentos"
          description={moveCount > moves.length ? `Mostrando os ${moves.length} mais recentes de ${moveCount}.` : undefined}
        >
          {moves.length === 0 ? (
            <EmptyState title="Nenhum movimento no período" />
          ) : (
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[820px] table-fixed border-collapse text-sm">
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '27%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '14%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-line-strong text-left">
                    {[
                      ['Data', ''], ['Tipo', ''], ['Produto', ''], ['Quantidade', 'text-right'],
                      ['Custo un.', 'text-right'], ['Total', 'text-right'], ['', ''],
                    ].map(([h, cls], i) => (
                      <th key={i} className={`pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-faint ${cls}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {moves.map((m) => {
                    const p = m.products as { name: string; unit: string } | null
                    const src = SOURCE[m.source_table ?? '']
                    const sign = m.movement_type === 'entrada' ? '+' : m.movement_type === 'saida' ? '−' : '±'
                    return (
                      <tr key={m.id} className="transition-colors hover:bg-bg-sunken/60">
                        <td className="num py-2.5 text-text-muted">{date(m.movement_date)}</td>
                        <td className="py-2.5 text-text-muted">{MOVE_LABEL[m.movement_type]}</td>
                        <td className="py-2.5 pr-3">
                          <span className="block truncate">{p?.name ?? '—'}</span>
                          {m.notes && <span className="block truncate text-xs text-text-faint">{m.notes}</span>}
                        </td>
                        <td
                          className={`num py-2.5 text-right font-medium ${
                            m.movement_type === 'entrada' ? 'text-accent-text' : ''
                          }`}
                        >
                          {sign}
                          {num(Number(m.quantity), 2)} {UNIT_LABEL[p?.unit ?? 'kg']}
                        </td>
                        <td className="num py-2.5 text-right text-text-muted">
                          {Number(m.unit_cost) > 0 ? money(Number(m.unit_cost)) : '—'}
                        </td>
                        <td className="num py-2.5 text-right">
                          {Number(m.total_cost) > 0 ? money(Number(m.total_cost)) : '—'}
                        </td>
                        <td className="py-2 text-right">
                          {src ? (
                            <RowActions
                              id={m.id}
                              autoFrom={{
                                label: src.label,
                                href: src.edit && m.source_id ? editLink(src.path, {}, m.source_id) : (src.path as Route),
                              }}
                            />
                          ) : (
                            <RowActions
                              id={m.id}
                              kind="movimento"
                              editHref={editLink('/estoque', sp, m.id)}
                              confirm="Excluir o movimento? O saldo é recalculado."
                            />
                          )}
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
