import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { getExpenseCategoryNames } from '@/lib/queries/options'
import { byDate, eqIf, readFilters } from '@/lib/filters'
import { editLink } from '@/lib/url'
import { date, money, relativeDay, sinceDays } from '@/lib/format'
import { FilterBar } from '@/components/ui/FilterBar'
import { PageHeader, EmptyState, Badge, Metric, MetricStrip, Section } from '@/components/ui/Layout'
import { ButtonLink } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { PayExpenseButton } from './PayExpenseButton'

export const metadata: Metadata = { title: 'Financeiro' }

const TABS = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'receitas', label: 'Receitas' },
  { key: 'despesas', label: 'Despesas' },
  { key: 'receber', label: 'A receber' },
  { key: 'pagar', label: 'A pagar' },
]

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const [ctx, sp] = await Promise.all([requireFarm(), searchParams])
  const supabase = await createClient()
  const tab = sp.aba ?? 'resumo'
  const f = readFilters(sp)

  let revQ = supabase.from('revenues').select('*', { count: 'exact' }).eq('farm_id', ctx.farm.id)
  revQ = byDate(revQ, 'revenue_date', f)
  let expQ = supabase.from('expenses').select('*, plots(code)', { count: 'exact' }).eq('farm_id', ctx.farm.id)
  expQ = eqIf(byDate(expQ, 'expense_date', f), 'category', f.categoria)

  // Financeiro olha TODAS as safras: conta a pagar ou a receber nao some
  // quando a safra muda. Os totais vem das views de resumo (somados no
  // banco); as listas sao so' para exibir.
  const [revenues, expenses, openRevenues, openExpenses, revSummary, expSummary, names] =
    await Promise.all([
      revQ.order('revenue_date', { ascending: false }).limit(1000),
      expQ.order('expense_date', { ascending: false }).limit(1000),
      // Em aberto buscadas a parte, pelo vencimento: as mais antigas (e mais
      // atrasadas) eram justamente as que caiam fora da lista dos recentes.
      supabase
        .from('revenues')
        .select('*')
        .eq('farm_id', ctx.farm.id)
        .neq('status', 'pago')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(1000),
      supabase
        .from('expenses')
        .select('*, plots(code)')
        .eq('farm_id', ctx.farm.id)
        .neq('status', 'pago')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(1000),
      supabase.from('v_revenue_summary').select('*').eq('farm_id', ctx.farm.id),
      supabase.from('v_expense_summary').select('*').eq('farm_id', ctx.farm.id),
      getExpenseCategoryNames(),
    ])

  const revs = revenues.data ?? []
  const exps = expenses.data ?? []
  const openRevs = openRevenues.data ?? []
  const openExps = openExpenses.data ?? []

  const sum = <T,>(rows: T[] | null, pick: (r: T) => unknown) =>
    (rows ?? []).reduce((s, r) => s + Number(pick(r) ?? 0), 0)

  const totalRevenue = sum(revSummary.data, (r) => r.amount)
  const totalReceived = sum(revSummary.data, (r) => r.received_amount)
  const receivable = sum(revSummary.data, (r) => r.open_amount)

  const totalExpense = sum(expSummary.data, (r) => r.amount)
  const totalPaid = sum(expSummary.data, (r) => r.paid_amount)
  const payable = sum(expSummary.data, (r) => r.open_amount)

  // Saldo de caixa: o que entrou menos o que saiu de fato.
  const balance = totalReceived - totalPaid
  const result = totalRevenue - totalExpense

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Financeiro"
        subtitle="Todas as safras — contas em aberto não somem quando a safra muda"
        actions={<ButtonLink href="/custos?novo=1">Registrar despesa</ButtonLink>}
      />

      <MetricStrip>
        <Metric
          label="Saldo em caixa"
          value={money(balance, { compact: true })}
          hint="recebido menos pago"
          tone={balance >= 0 ? 'positive' : 'negative'}
        />
        <Metric label="Receita" value={money(totalRevenue, { compact: true })} />
        <Metric label="Despesas" value={money(totalExpense, { compact: true })} />
        <Metric
          label="A receber"
          value={money(receivable, { compact: true })}
          tone={receivable > 0 ? 'warn' : 'neutral'}
        />
        <Metric
          label="A pagar"
          value={money(payable, { compact: true })}
          tone={payable > 0 ? 'warn' : 'neutral'}
        />
      </MetricStrip>

      <Tabs items={TABS} />

      {(tab === 'receitas' || tab === 'despesas') && (
        <FilterBar
          exportType="financeiro"
          selects={
            tab === 'despesas'
              ? [{ param: 'categoria', label: 'Categoria', options: [...names].map(([value, label]) => ({ value, label })) }]
              : []
          }
        />
      )}

      {tab === 'resumo' && (
        <Section title="Resultado do período">
          {totalRevenue === 0 && totalExpense === 0 ? (
            <EmptyState
              title="Nenhum movimento financeiro"
              description="As vendas viram receita e as despesas viram saída automaticamente."
            />
          ) : (
            <dl className="grid gap-px overflow-hidden rounded-lg bg-line sm:grid-cols-2">
              {[
                { label: 'Entrou', value: totalRevenue, sub: `${money(totalReceived)} já recebido` },
                { label: 'Saiu', value: totalExpense, sub: `${money(totalPaid)} já pago` },
                {
                  label: 'Resultado',
                  value: result,
                  sub: 'receita menos despesa, incluindo o que está por receber e por pagar',
                  tone: true,
                },
                {
                  label: 'Saldo em caixa',
                  value: balance,
                  sub: 'somente o que já entrou e saiu de fato',
                  tone: true,
                },
              ].map((x) => (
                <div key={x.label} className="bg-bg-raised px-5 py-5">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                    {x.label}
                  </dt>
                  <dd
                    className={`num mt-2 text-2xl font-semibold tracking-tight ${
                      x.tone
                        ? x.value > 0
                          ? 'text-accent-text'
                          : x.value < 0
                            ? 'text-danger'
                            : ''
                        : ''
                    }`}
                  >
                    {money(x.value)}
                  </dd>
                  <dd className="mt-1 max-w-[45ch] text-xs text-text-muted">{x.sub}</dd>
                </div>
              ))}
            </dl>
          )}
        </Section>
      )}

      {(tab === 'receitas' || tab === 'receber') && (
        <Section title={tab === 'receber' ? 'A receber' : 'Receitas'}>
          {(tab === 'receber' ? openRevs : revs).length === 0 ? (
            <EmptyState title={tab === 'receber' ? 'Nada a receber' : 'Nenhuma receita'} />
          ) : (
            <ul className="divide-y divide-line">
              {(tab === 'receber' ? openRevs : revs).map((r) => {
                const pending = Number(r.amount) - Number(r.received_amount)
                const late = r.due_date && (sinceDays(r.due_date) ?? 0) > 0 && r.status !== 'pago'
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                    <span className="num w-20 shrink-0 text-text-muted">
                      {date(r.revenue_date)}
                    </span>
                    {r.sale_id ? (
                      <Link
                        href={editLink('/comercializacao', { aba: 'vendas' }, r.sale_id)}
                        className="min-w-0 flex-1 truncate hover:text-accent-text"
                        title="Abrir a venda"
                      >
                        {r.description}
                      </Link>
                    ) : (
                      <span className="min-w-0 flex-1 truncate">{r.description}</span>
                    )}
                    {r.status !== 'pago' && (
                      <Badge tone={late ? 'danger' : 'warn'}>
                        {r.due_date
                          ? late
                            ? `vencida ${relativeDay(r.due_date)}`
                            : `vence ${relativeDay(r.due_date)}`
                          : `falta ${money(pending)}`}
                      </Badge>
                    )}
                    {r.status === 'pago' && <Badge tone="accent">recebido</Badge>}
                    <span className="num w-24 shrink-0 text-right font-medium">
                      {money(Number(r.amount))}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>
      )}

      {(tab === 'despesas' || tab === 'pagar') && (
        <Section title={tab === 'pagar' ? 'A pagar' : 'Despesas'}>
          {(tab === 'pagar' ? openExps : exps).length === 0 ? (
            <EmptyState title={tab === 'pagar' ? 'Nada a pagar' : 'Nenhuma despesa'} />
          ) : (
            <ul className="divide-y divide-line">
              {(tab === 'pagar' ? openExps : exps).map((r) => {
                const late = r.due_date && (sinceDays(r.due_date) ?? 0) > 0 && r.status !== 'pago'
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3 text-sm">
                    <span className="num w-20 shrink-0 text-text-muted">
                      {date(r.expense_date)}
                    </span>
                    <span className="w-12 shrink-0 text-xs text-text-faint">
                      {(r.plots as { code: string } | null)?.code ?? '—'}
                    </span>
                    {r.source_table ? (
                      <span className="min-w-0 flex-1 truncate">{r.description}</span>
                    ) : (
                      <Link
                        href={editLink('/custos', { aba: 'lancamentos' }, r.id) as Route}
                        className="min-w-0 flex-1 truncate hover:text-accent-text"
                        title="Editar a despesa"
                      >
                        {r.description}
                      </Link>
                    )}
                    <span className="shrink-0 text-xs text-text-faint">
                      {names.get(r.category) ?? r.category}
                    </span>
                    {r.status !== 'pago' && (
                      <>
                        <Badge tone={late ? 'danger' : 'warn'}>
                          {r.due_date
                            ? late
                              ? `vencida ${relativeDay(r.due_date)}`
                              : `vence ${relativeDay(r.due_date)}`
                            : 'a pagar'}
                        </Badge>
                        <PayExpenseButton id={r.id} />
                      </>
                    )}
                    <span className="num w-24 shrink-0 text-right font-medium">
                      {money(Number(r.amount))}
                    </span>
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
