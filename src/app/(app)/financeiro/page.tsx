import type { Metadata } from 'next'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { date, EXPENSE_LABEL, money, relativeDay, sinceDays } from '@/lib/format'
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
  searchParams: Promise<{ aba?: string }>
}) {
  const [ctx, sp] = await Promise.all([requireFarm(), searchParams])
  const supabase = await createClient()
  const tab = sp.aba ?? 'resumo'

  // Financeiro olha TODAS as safras: conta a pagar ou a receber nao some
  // quando a safra muda. Os totais vem das views de resumo (somados no
  // banco); as listas sao so' para exibir.
  const [revenues, expenses, openRevenues, openExpenses, revSummary, expSummary] =
    await Promise.all([
      supabase
        .from('revenues')
        .select('*')
        .eq('farm_id', ctx.farm.id)
        .order('revenue_date', { ascending: false })
        .limit(300),
      supabase
        .from('expenses')
        .select('*, plots(code)')
        .eq('farm_id', ctx.farm.id)
        .order('expense_date', { ascending: false })
        .limit(400),
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
                    <span className="min-w-0 flex-1 truncate">{r.description}</span>
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
                    <span className="min-w-0 flex-1 truncate">{r.description}</span>
                    <span className="shrink-0 text-xs text-text-faint">
                      {EXPENSE_LABEL[r.category] ?? r.category}
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
