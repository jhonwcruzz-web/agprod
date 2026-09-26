import Link from 'next/link'
import type { Metadata, Route } from 'next'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { getFormOptions } from '@/lib/queries/options'
import {
  date,
  LOG_TYPE_LABEL,
  MACHINE_STATUS_LABEL,
  meterUnit,
  money,
  num,
  relativeDay,
} from '@/lib/format'
import {
  Badge,
  EmptyState,
  Metric,
  MetricStrip,
  PageHeader,
  Section,
  StatusDot,
} from '@/components/ui/Layout'
import { ButtonLink } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { MachineLogForm } from '@/components/forms/MachineForms'

export const metadata: Metadata = { title: 'Máquinas e implementos' }

type Status = {
  machine_id: string | null
  class: string | null
  kind: string | null
  name: string | null
  brand: string | null
  model: string | null
  year: number | null
  meter_type: string | null
  current_meter: number | null
  status: string | null
  coupled_to: string | null
  last_service_date: string | null
  next_due_date: string | null
  next_due_meter: number | null
  maintenance_cost: number | null
  fuel_cost: number | null
  fuel_liters: number | null
  due_level: string | null
}

const LEVEL = { vencida: 'critico', proxima: 'atencao', ok: 'normal' } as const

function dueText(m: Status) {
  const unit = meterUnit(m.meter_type)
  const parts: string[] = []
  if (m.next_due_date) parts.push(relativeDay(m.next_due_date))
  if (m.next_due_meter !== null && m.meter_type !== 'nenhum')
    parts.push(`com ${num(Number(m.next_due_meter))} ${unit}`)
  return parts.join(' ou ') || '—'
}

/** Tabela de cadastro — mesma estrutura para maquinas e implementos. */
function MachineTable({
  rows,
  names,
  isImplement,
}: {
  rows: Status[]
  names: Map<string, string>
  isImplement: boolean
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[820px] table-fixed border-collapse text-sm">
        <colgroup>
          <col style={{ width: '22%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '10%' }} />
        </colgroup>
        <thead>
          <tr className="border-b border-line-strong text-left">
            {[
              'Nome',
              'Tipo',
              'Marca / modelo',
              isImplement ? 'Acoplado em' : 'Uso atual',
              'Próxima manutenção',
              'Custo total',
              'Situação',
            ].map((h, i) => (
              <th
                key={h}
                className={`pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-faint ${
                  i === 5 ? 'text-right' : ''
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((m) => {
            const total = Number(m.maintenance_cost ?? 0) + Number(m.fuel_cost ?? 0)
            return (
              <tr key={m.machine_id} className="transition-colors hover:bg-bg-sunken/60">
                <td className="py-3 pr-3">
                  <Link
                    href={`/maquinas/${m.machine_id}` as Route}
                    className="flex items-center gap-2 font-medium hover:text-accent-text"
                  >
                    <StatusDot level={LEVEL[(m.due_level ?? 'ok') as keyof typeof LEVEL]} />
                    <span className="truncate">{m.name}</span>
                  </Link>
                </td>
                <td className="truncate py-3 pr-3 text-text-muted">{m.kind ?? '—'}</td>
                <td className="truncate py-3 pr-3 text-text-muted">
                  {[m.brand, m.model, m.year].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className="num truncate py-3 pr-3">
                  {isImplement
                    ? (m.coupled_to && names.get(m.coupled_to)) || '—'
                    : m.meter_type === 'nenhum'
                      ? '—'
                      : `${num(Number(m.current_meter ?? 0))} ${meterUnit(m.meter_type)}`}
                </td>
                <td className="truncate py-3 pr-3 text-text-muted">{dueText(m)}</td>
                <td className="num py-3 text-right">{money(total, { compact: true })}</td>
                <td className="py-3 pl-3">
                  <Badge
                    tone={
                      m.status === 'manutencao'
                        ? 'warn'
                        : m.status === 'inativo'
                          ? 'neutral'
                          : 'accent'
                    }
                  >
                    {MACHINE_STATUS_LABEL[m.status ?? 'operacional']}
                  </Badge>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

type LogRow = {
  id: string
  machine_id: string
  log_date: string
  log_type: string
  description: string | null
  supplier: string | null
  meter_reading: number | null
  liters: number | null
  cost: number
  machines: unknown
}

/** Registros do diario. Manutencao e abastecimento tem colunas proprias. */
function LogTable({ rows, fuel }: { rows: LogRow[]; fuel: boolean }) {
  const columns = fuel
    ? [
        { label: 'Data', width: '12%' },
        { label: 'Máquina', width: '26%' },
        { label: 'Posto', width: '26%' },
        { label: 'Uso', width: '12%', right: true },
        { label: 'Litros', width: '12%', right: true },
        { label: 'Valor', width: '12%', right: true },
      ]
    : [
        { label: 'Data', width: '11%' },
        { label: 'Máquina', width: '20%' },
        { label: 'Tipo', width: '16%' },
        { label: 'O que foi feito', width: '29%' },
        { label: 'Uso', width: '12%', right: true },
        { label: 'Valor', width: '12%', right: true },
      ]

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
        <colgroup>
          {columns.map((c) => (
            <col key={c.label} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-line-strong text-left">
            {columns.map((c) => (
              <th
                key={c.label}
                className={`pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-faint ${
                  c.right ? 'text-right' : ''
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((l) => {
            const mach = l.machines as { name: string; meter_type: string } | null
            const meter =
              l.meter_reading !== null
                ? `${num(Number(l.meter_reading))} ${meterUnit(mach?.meter_type)}`
                : '—'
            return (
              <tr key={l.id}>
                <td className="num py-2.5 text-text-muted">{date(l.log_date)}</td>
                <td className="truncate py-2.5 pr-3">
                  <Link
                    href={`/maquinas/${l.machine_id}` as Route}
                    className="hover:text-accent-text"
                  >
                    {mach?.name ?? '—'}
                  </Link>
                </td>
                {fuel ? (
                  <td className="truncate py-2.5 pr-3 text-text-muted">{l.supplier ?? '—'}</td>
                ) : (
                  <>
                    <td className="truncate py-2.5 pr-3 text-text-muted">
                      {LOG_TYPE_LABEL[l.log_type]}
                    </td>
                    <td className="truncate py-2.5 pr-3">{l.description ?? '—'}</td>
                  </>
                )}
                <td className="num py-2.5 text-right text-text-muted">{meter}</td>
                {fuel && (
                  <td className="num py-2.5 text-right">{num(Number(l.liters ?? 0), 2)} L</td>
                )}
                <td className="num py-2.5 text-right font-medium">{money(Number(l.cost))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default async function MaquinasPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; registro?: string; tipo?: string; maquina?: string }>
}) {
  const [ctx, sp] = await Promise.all([requireFarm(), searchParams])
  const supabase = await createClient()
  const tab = sp.aba ?? 'maquinas'

  const [statusRes, logsRes, options, machinesRes] = await Promise.all([
    supabase.from('v_machine_status').select('*').eq('farm_id', ctx.farm.id).order('name'),
    supabase
      .from('machine_logs')
      .select('*, machines(name, meter_type)')
      .eq('farm_id', ctx.farm.id)
      .order('log_date', { ascending: false })
      .limit(300),
    getFormOptions(ctx.farm.id),
    supabase
      .from('machines')
      .select('id, name, class, meter_type, current_meter, acquisition_value')
      .eq('farm_id', ctx.farm.id)
      .neq('status', 'inativo')
      .order('name'),
  ])

  const all = (statusRes.data ?? []) as Status[]
  const machines = all.filter((m) => m.class === 'maquina')
  const implementsList = all.filter((m) => m.class === 'implemento')
  const logs = logsRes.data ?? []
  const services = logs.filter((l) => l.log_type !== 'abastecimento')
  const fuel = logs.filter((l) => l.log_type === 'abastecimento')

  const names = new Map(all.map((m) => [m.machine_id!, m.name ?? '']))
  const attention = all
    .filter((m) => m.due_level !== 'ok' && m.status !== 'inativo')
    .sort((a, b) => (a.due_level === 'vencida' ? -1 : 1) - (b.due_level === 'vencida' ? -1 : 1))

  const patrimony = (machinesRes.data ?? []).reduce(
    (s, m) => s + Number(m.acquisition_value ?? 0),
    0,
  )
  const maintenanceTotal = all.reduce((s, m) => s + Number(m.maintenance_cost ?? 0), 0)
  const fuelTotal = all.reduce((s, m) => s + Number(m.fuel_cost ?? 0), 0)
  const litersTotal = all.reduce((s, m) => s + Number(m.fuel_liters ?? 0), 0)

  const costed = all
    .map((m) => ({ ...m, total: Number(m.maintenance_cost ?? 0) + Number(m.fuel_cost ?? 0) }))
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total)

  const TABS = [
    { key: 'maquinas', label: 'Máquinas', count: machines.length },
    { key: 'implementos', label: 'Implementos', count: implementsList.length },
    { key: 'manutencoes', label: 'Manutenções', count: services.length },
    { key: 'abastecimentos', label: 'Abastecimentos', count: fuel.length },
    { key: 'custos', label: 'Custos' },
  ]

  const logOptions = (machinesRes.data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    class: m.class,
    meter_type: m.meter_type,
    current_meter: Number(m.current_meter),
  }))

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Máquinas e implementos"
        subtitle="Cadastro, manutenção e combustível"
        actions={
          <>
            <ButtonLink
              href={`/maquinas/nova${tab === 'implementos' ? '?classe=implemento' : ''}` as Route}
              variant="secondary"
            >
              {tab === 'implementos' ? 'Novo implemento' : 'Nova máquina'}
            </ButtonLink>
            <ButtonLink href="/maquinas?registro=1">Registrar manutenção</ButtonLink>
          </>
        }
      />

      {sp.registro === '1' &&
        (logOptions.length === 0 ? (
          <EmptyState
            title="Cadastre uma máquina antes de registrar manutenção"
            action={<ButtonLink href="/maquinas/nova">Nova máquina</ButtonLink>}
          />
        ) : (
          <MachineLogForm
            machines={logOptions}
            plots={options.plots}
            closeHref="/maquinas"
            defaultMachineId={sp.maquina}
            defaultType={sp.tipo === 'abastecimento' ? 'abastecimento' : 'preventiva'}
          />
        ))}

      <MetricStrip>
        <Metric label="Máquinas" value={num(machines.length)} />
        <Metric label="Implementos" value={num(implementsList.length)} />
        <Metric label="Patrimônio" value={money(patrimony, { compact: true })} hint="valor de aquisição" />
        <Metric label="Manutenção" value={money(maintenanceTotal, { compact: true })} />
        <Metric
          label="Combustível"
          value={money(fuelTotal, { compact: true })}
          hint={litersTotal > 0 ? `${num(litersTotal)} L` : undefined}
        />
      </MetricStrip>

      {/* Sempre visivel: manutencao vencida nao pode ficar escondida numa aba. */}
      {attention.length > 0 && (
        <Section title="Manutenção que precisa de atenção">
          <ul className="divide-y divide-line">
            {attention.map((m) => (
              <li key={m.machine_id}>
                <Link
                  href={`/maquinas/${m.machine_id}` as Route}
                  className="flex items-center gap-3 py-3 text-sm transition-colors hover:bg-bg-sunken/60"
                >
                  <StatusDot level={LEVEL[(m.due_level ?? 'ok') as keyof typeof LEVEL]} />
                  <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
                  <span className="shrink-0 text-text-muted">
                    {m.due_level === 'vencida' ? 'vencida' : 'vence'} {dueText(m)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Tabs items={TABS} />

      {all.length === 0 ? (
        <EmptyState
          title="Nenhuma máquina cadastrada"
          description="Cadastre tratores, veículos e implementos para acompanhar manutenção, combustível e quanto cada um custa."
          action={<ButtonLink href="/maquinas/nova">Cadastrar máquina</ButtonLink>}
        />
      ) : (
        <>
          {tab === 'custos' && (
            <>
              <Section title="Quanto cada uma custa">
                {costed.length === 0 ? (
                  <EmptyState
                    title="Nenhum custo registrado ainda"
                    description="Os valores de manutenção e abastecimento aparecem aqui, por máquina."
                    action={<ButtonLink href="/maquinas?registro=1">Registrar manutenção</ButtonLink>}
                  />
                ) : (
                <ul className="divide-y divide-line">
                  {costed.map((m, _i, arr) => {
                      const share = arr[0].total > 0 ? (m.total / arr[0].total) * 100 : 0
                      return (
                        <li key={m.machine_id} className="py-3">
                          <div className="flex items-baseline justify-between gap-4 text-sm">
                            <span className="min-w-0 flex-1 truncate">{m.name}</span>
                            <span className="num shrink-0 text-xs text-text-faint">
                              manut. {money(Number(m.maintenance_cost ?? 0))} · comb.{' '}
                              {money(Number(m.fuel_cost ?? 0))}
                            </span>
                            <span className="num w-28 shrink-0 text-right font-medium">
                              {money(m.total)}
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

          {tab === 'maquinas' && (
            <Section title="Máquinas">
              {machines.length === 0 ? (
                <EmptyState
                  title="Nenhuma máquina cadastrada"
                  action={<ButtonLink href="/maquinas/nova">Nova máquina</ButtonLink>}
                />
              ) : (
                <MachineTable rows={machines} names={names} isImplement={false} />
              )}
            </Section>
          )}

          {tab === 'implementos' && (
            <Section title="Implementos">
              {implementsList.length === 0 ? (
                <EmptyState
                  title="Nenhum implemento cadastrado"
                  action={
                    <ButtonLink href={'/maquinas/nova?classe=implemento' as Route}>
                      Novo implemento
                    </ButtonLink>
                  }
                />
              ) : (
                <MachineTable rows={implementsList} names={names} isImplement />
              )}
            </Section>
          )}

          {(tab === 'manutencoes' || tab === 'abastecimentos') && (
            <Section title={tab === 'manutencoes' ? 'Manutenções' : 'Abastecimentos'}>
              {(tab === 'manutencoes' ? services : fuel).length === 0 ? (
                <EmptyState
                  title={
                    tab === 'manutencoes'
                      ? 'Nenhuma manutenção registrada'
                      : 'Nenhum abastecimento registrado'
                  }
                  action={
                    <ButtonLink
                      href={
                        (tab === 'manutencoes'
                          ? '/maquinas?registro=1'
                          : '/maquinas?registro=1&tipo=abastecimento') as Route
                      }
                    >
                      Registrar
                    </ButtonLink>
                  }
                />
              ) : (
                <LogTable
                  rows={tab === 'manutencoes' ? services : fuel}
                  fuel={tab === 'abastecimentos'}
                />
              )}
            </Section>
          )}
        </>
      )}
    </div>
  )
}
