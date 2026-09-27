import Link from 'next/link'
import type { Metadata, Route } from 'next'
import { TestTubeIcon, PlantIcon, WrenchIcon } from '@phosphor-icons/react/dist/ssr'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { getFormOptions } from '@/lib/queries/options'
import { byDate, eqIf, readFilters } from '@/lib/filters'
import { closeLink, editLink, withParams } from '@/lib/url'
import { date, relativeDay } from '@/lib/format'
import {
  isOrderKind,
  ORDER_KIND_LABEL,
  ORDER_STATUS_LABEL,
  orderFileName,
  orderNumber,
  type OrderKind,
  type OrderStatus,
} from '@/lib/orders'
import { Badge, EmptyState, Metric, MetricStrip, PageHeader, Section } from '@/components/ui/Layout'
import { ButtonLink } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { FilterBar } from '@/components/ui/FilterBar'
import { RowActions } from '@/components/ui/RowActions'
import { ServiceOrderForm } from '@/components/forms/ServiceOrderForm'
import { OrderActions } from './OrderActions'

export const metadata: Metadata = { title: 'Ordens de serviço' }

type SP = Record<string, string | undefined>

const KIND_ICON = { pulverizacao: TestTubeIcon, colheita: PlantIcon, manutencao: WrenchIcon } as const
const STATUS_TONE = { aberta: 'warn', concluida: 'accent', cancelada: 'neutral' } as const

export default async function OrdensPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [ctx, sp] = await Promise.all([requireFarm(), searchParams])
  const supabase = await createClient()
  const tab = (['abertas', 'concluidas', 'canceladas', 'todas'] as const).find((t) => t === sp.aba) ?? 'abertas'
  const f = readFilters(sp)
  const kindFilter = isOrderKind(sp.tipo) ? sp.tipo : null
  const newKind = isOrderKind(sp.nova) ? sp.nova : null

  let q = supabase
    .from('service_orders')
    .select(
      `id, number, kind, status, scheduled_date, assignee, assignee_phone, plot_id, machine_id, completed_at,
       plots(code, name),
       machine:machines!service_orders_machine_id_fkey(name),
       applications(product_name)`,
      { count: 'exact' },
    )
    .eq('farm_id', ctx.farm.id)
  if (tab !== 'todas') q = q.eq('status', tab === 'abertas' ? 'aberta' : tab === 'concluidas' ? 'concluida' : 'cancelada')
  q = eqIf(eqIf(byDate(q, 'scheduled_date', f), 'plot_id', f.talhao), 'kind', kindFilter)

  const [options, orders, counts, editing, machines] = await Promise.all([
    getFormOptions(ctx.farm.id),
    q.order('scheduled_date', { ascending: tab === 'abertas' }).order('number', { ascending: false }).limit(500),
    supabase.from('service_orders').select('status').eq('farm_id', ctx.farm.id),
    sp.editar
      ? supabase.from('service_orders').select('*').eq('id', sp.editar).eq('farm_id', ctx.farm.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('machines')
      .select('id, name, kind, class')
      .eq('farm_id', ctx.farm.id)
      .neq('status', 'inativo')
      .order('class')
      .order('name'),
  ])

  // Calda da OS em edicao.
  const editLines =
    editing.data?.kind === 'pulverizacao'
      ? ((
          await supabase
            .from('applications')
            .select('product_id, dose, dose_unit')
            .eq('service_order_id', editing.data.id)
            .eq('farm_id', ctx.farm.id)
            .order('created_at')
        ).data ?? [])
          .filter((l) => l.product_id)
          .map((l) => ({ product_id: l.product_id!, dose: l.dose === null ? null : Number(l.dose), dose_unit: l.dose_unit }))
      : undefined

  const rows = orders.data ?? []
  const all = counts.data ?? []
  const open = all.filter((o) => o.status === 'aberta').length
  const lateCount = rows.filter((o) => o.status === 'aberta' && o.scheduled_date < new Date().toISOString().slice(0, 10)).length

  const TABS = [
    { key: 'abertas', label: 'Abertas', count: open },
    { key: 'concluidas', label: 'Concluídas', count: all.filter((o) => o.status === 'concluida').length },
    { key: 'canceladas', label: 'Canceladas', count: all.filter((o) => o.status === 'cancelada').length },
    { key: 'todas', label: 'Todas', count: all.length },
  ]

  const formProps = {
    plots: options.plots,
    varieties: options.varieties,
    products: options.products,
    tractors: options.tractors,
    implements: options.implements,
    machines: machines.data ?? [],
    destinations: options.destinations,
    closeHref: withParams('/ordens', sp, { nova: null, editar: null, talhao_os: null, maquina_os: null }),
  }
  const newHref = (k: OrderKind) => withParams('/ordens', sp, { nova: k, editar: null })

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Ordens de serviço"
        subtitle="Gere a ordem, envie o PDF para quem executa e conclua quando o serviço for feito"
        actions={
          <>
            <ButtonLink href={newHref('colheita')} variant="secondary">
              OS de colheita
            </ButtonLink>
            <ButtonLink href={newHref('manutencao')} variant="secondary">
              OS de manutenção
            </ButtonLink>
            <ButtonLink href={newHref('pulverizacao')}>OS de pulverização</ButtonLink>
          </>
        }
      />

      {newKind && (
        <ServiceOrderForm
          key={newKind}
          kind={newKind}
          {...formProps}
          defaultPlotId={sp.talhao_os}
          defaultMachineId={sp.maquina_os}
        />
      )}
      {editing.data && isOrderKind(editing.data.kind) && (
        <ServiceOrderForm
          key={editing.data.id}
          kind={editing.data.kind}
          {...formProps}
          closeHref={closeLink('/ordens', sp)}
          initial={editing.data}
          lines={editLines}
        />
      )}

      <MetricStrip>
        <Metric label="Abertas" value={String(open)} tone={open ? 'warn' : 'neutral'} />
        <Metric label="Atrasadas" value={String(lateCount)} tone={lateCount ? 'negative' : 'neutral'} hint={tab === 'abertas' ? undefined : 'na lista atual'} />
        <Metric label="Concluídas" value={String(all.filter((o) => o.status === 'concluida').length)} tone="positive" />
        <Metric label="Emitidas" value={String(all.length)} />
      </MetricStrip>

      <Tabs items={TABS} />

      <FilterBar
        selects={[
          { param: 'tipo', label: 'Tipo', options: (['pulverizacao', 'colheita', 'manutencao'] as const).map((k) => ({ value: k, label: ORDER_KIND_LABEL[k] })) },
          { param: 'talhao', label: 'Talhão', options: options.plots.map((p) => ({ value: p.id, label: p.code })) },
        ]}
      />

      <Section>
        {rows.length === 0 ? (
          <EmptyState
            title={tab === 'abertas' ? 'Nenhuma ordem aberta' : 'Nenhuma ordem nesta lista'}
            description="Crie uma ordem de pulverização, colheita ou manutenção e envie o PDF pelo WhatsApp para quem vai executar."
            action={<ButtonLink href={newHref('pulverizacao')}>OS de pulverização</ButtonLink>}
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((o) => {
              const kind = o.kind as OrderKind
              const status = o.status as OrderStatus
              const Icon = KIND_ICON[kind]
              const plot = o.plots as { code: string; name: string | null } | null
              const machine = (o.machine as { name: string } | null)?.name
              const where = kind === 'manutencao' ? machine : plot?.code
              const products = ((o.applications as { product_name: string }[] | null) ?? []).map((a) => a.product_name)
              const late = status === 'aberta' && o.scheduled_date < new Date().toISOString().slice(0, 10)
              const detail =
                kind === 'pulverizacao'
                  ? products.join(' + ') || 'sem produtos'
                  : kind === 'colheita'
                    ? [plot?.name].filter(Boolean).join('')
                    : ''
              const message =
                `Ordem de serviço nº ${orderNumber(o.number)} — ${ORDER_KIND_LABEL[kind]}` +
                (where ? ` · ${kind === 'manutencao' ? 'Máquina' : 'Talhão'} ${where}` : '') +
                ` · para ${date(o.scheduled_date)}.` +
                (kind === 'pulverizacao' && products.length ? ` Calda: ${products.join(', ')}.` : '') +
                ` ${ctx.farm.name}. Detalhes no PDF.`
              const completeHref =
                kind === 'colheita'
                  ? (`/producao?novo=1&os=${o.id}` as Route)
                  : kind === 'manutencao' && o.machine_id
                    ? (`/maquinas?registro=1&maquina=${o.machine_id}&os=${o.id}` as Route)
                    : undefined
              return (
                <li key={o.id} className="flex flex-wrap items-start gap-x-4 gap-y-3 py-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-text">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1 basis-60">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="num font-semibold">{`OS ${orderNumber(o.number)}`}</span>
                      <span className="text-text-muted">{ORDER_KIND_LABEL[kind]}</span>
                      {where && (
                        <Link
                          href={(kind === 'manutencao' ? `/maquinas/${o.machine_id}` : `/talhoes/${o.plot_id}`) as Route}
                          className="font-medium hover:text-accent-text"
                        >
                          {where}
                        </Link>
                      )}
                      <Badge tone={late ? 'danger' : STATUS_TONE[status]}>
                        {late ? `atrasada · ${relativeDay(o.scheduled_date)}` : ORDER_STATUS_LABEL[status]}
                      </Badge>
                    </p>
                    <p className="mt-1 truncate text-xs text-text-faint">
                      <span className="num">{date(o.scheduled_date)}</span>
                      {o.assignee ? ` · ${o.assignee}` : ' · executor a definir'}
                      {detail ? ` · ${detail}` : ''}
                    </p>
                  </div>
                  <div className="flex w-full items-start justify-between gap-1 sm:w-auto sm:justify-end">
                    <OrderActions
                      id={o.id}
                      kind={kind}
                      status={status}
                      phone={o.assignee_phone}
                      fileName={orderFileName(o.number, kind, where)}
                      message={message}
                      completeHref={completeHref}
                    />
                    <RowActions
                      id={o.id}
                      kind="ordem"
                      editHref={status === 'aberta' ? editLink('/ordens', sp, o.id) : undefined}
                      confirm="Excluir a ordem? Pulverizações ainda não feitas dela também são excluídas."
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}
