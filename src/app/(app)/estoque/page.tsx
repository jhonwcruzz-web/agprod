import type { Metadata } from 'next'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { date, money, num, PRODUCT_LABEL, UNIT_LABEL } from '@/lib/format'
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
import { MovementForm, ProductForm } from '@/components/forms/StockForms'

export const metadata: Metadata = { title: 'Estoque' }

const LEVEL_LABEL = { normal: 'Normal', baixo: 'Baixo', critico: 'Comprar' } as const

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; novo?: string; produto?: string }>
}) {
  const [ctx, sp] = await Promise.all([requireFarm(), searchParams])
  const supabase = await createClient()
  const tab = sp.aba ?? 'geral'

  const [stock, movements] = await Promise.all([
    supabase.from('v_stock_status').select('*').eq('farm_id', ctx.farm.id).order('name'),
    supabase
      .from('inventory_movements')
      .select('*, products(name, unit)')
      .eq('farm_id', ctx.farm.id)
      .order('movement_date', { ascending: false })
      .limit(300),
  ])

  const items = stock.data ?? []
  const moves = movements.data ?? []
  const alerts = items.filter((i) => i.stock_level !== 'normal')
  const totalValue = items.reduce((s, i) => s + Number(i.stock_value ?? 0), 0)

  const entries = moves.filter((m) => m.movement_type === 'entrada')
  const exits = moves.filter((m) => m.movement_type === 'saida')

  const TABS = [
    { key: 'geral', label: 'Visão geral' },
    { key: 'produtos', label: 'Produtos', count: items.length },
    { key: 'entradas', label: 'Entradas', count: entries.length },
    { key: 'saidas', label: 'Saídas', count: exits.length },
    { key: 'alertas', label: 'Alertas', count: alerts.length },
  ]

  const productOptions = items.map((i) => ({
    id: i.product_id!,
    name: i.name!,
    unit: i.unit!,
    current_stock: Number(i.current_stock ?? 0),
  }))

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Estoque"
        subtitle="Insumos, embalagens e materiais"
        actions={
          <>
            <ButtonLink href="/estoque?produto=1" variant="secondary">
              Novo produto
            </ButtonLink>
            <ButtonLink href="/estoque?novo=1">Registrar movimento</ButtonLink>
          </>
        }
      />

      {sp.produto === '1' && <ProductForm closeHref="/estoque" />}
      {sp.novo === '1' &&
        (productOptions.length === 0 ? (
          <EmptyState
            title="Cadastre um produto antes de movimentar o estoque"
            action={<ButtonLink href="/estoque?produto=1">Novo produto</ButtonLink>}
          />
        ) : (
          <MovementForm products={productOptions} closeHref="/estoque" />
        ))}

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

      {(tab === 'geral' || tab === 'produtos' || tab === 'alertas') && (
        <Section
          title={
            tab === 'alertas' ? 'Produtos abaixo do mínimo' : 'Situação do estoque'
          }
        >
          {(tab === 'alertas' ? alerts : items).length === 0 ? (
            <EmptyState
              title={
                tab === 'alertas'
                  ? 'Nenhum produto abaixo do mínimo'
                  : 'Nenhum produto cadastrado'
              }
              description={
                tab !== 'alertas'
                  ? 'Com o estoque cadastrado, aplicações e adubações dão baixa automaticamente.'
                  : undefined
              }
              action={
                tab !== 'alertas' ? (
                  <ButtonLink href="/estoque?produto=1">Cadastrar produto</ButtonLink>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {(tab === 'alertas' ? alerts : items).map((i) => {
                const level =
                  i.stock_level === 'critico'
                    ? 'critico'
                    : i.stock_level === 'baixo'
                      ? 'atencao'
                      : 'normal'
                return (
                  <li key={i.product_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                    <StatusDot level={level} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{i.name}</span>
                      <span className="block text-xs text-text-faint">
                        {PRODUCT_LABEL[i.category ?? 'outro']}
                      </span>
                    </span>

                    <span className="num shrink-0 text-sm">
                      {num(Number(i.current_stock ?? 0), 2)} {UNIT_LABEL[i.unit ?? 'kg']}
                    </span>

                    <span className="num w-24 shrink-0 text-right text-xs text-text-faint">
                      mín. {num(Number(i.min_stock ?? 0), 2)}
                    </span>

                    <span className="num w-24 shrink-0 text-right text-sm">
                      {money(Number(i.stock_value ?? 0))}
                    </span>

                    {i.stock_level !== 'normal' && (
                      <Badge tone={i.stock_level === 'critico' ? 'danger' : 'warn'}>
                        {LEVEL_LABEL[i.stock_level as keyof typeof LEVEL_LABEL]}
                      </Badge>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Section>
      )}

      {(tab === 'entradas' || tab === 'saidas') && (
        <Section title={tab === 'entradas' ? 'Entradas' : 'Saídas'}>
          {(tab === 'entradas' ? entries : exits).length === 0 ? (
            <EmptyState title="Nenhum movimento registrado" />
          ) : (
            <ul className="divide-y divide-line">
              {(tab === 'entradas' ? entries : exits).map((m) => {
                const p = m.products as { name: string; unit: string } | null
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                    <span className="num w-20 shrink-0 text-text-muted">
                      {date(m.movement_date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{p?.name ?? '—'}</span>
                    <span
                      className={`num shrink-0 font-medium ${
                        m.movement_type === 'entrada' ? 'text-accent-text' : 'text-text'
                      }`}
                    >
                      {m.movement_type === 'entrada' ? '+' : '−'}
                      {num(Number(m.quantity), 2)} {UNIT_LABEL[p?.unit ?? 'kg']}
                    </span>
                    {m.notes && (
                      <span className="shrink-0 text-xs text-text-faint">{m.notes}</span>
                    )}
                    {Number(m.total_cost) > 0 && (
                      <span className="num w-24 shrink-0 text-right">
                        {money(Number(m.total_cost))}
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
