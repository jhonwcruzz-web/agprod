import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata, Route } from 'next'
import {
  ArrowLeftIcon,
  GasPumpIcon,
  PencilSimpleIcon,
  WrenchIcon,
  XIcon,
} from '@phosphor-icons/react/dist/ssr'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { getFormOptions } from '@/lib/queries/options'
import { updateMachine } from '@/lib/actions/machines'
import {
  date,
  LOG_TYPE_LABEL,
  MACHINE_CLASS_LABEL,
  MACHINE_STATUS_LABEL,
  meterUnit,
  money,
  num,
  relativeDay,
} from '@/lib/format'
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
import { Tabs } from '@/components/ui/Tabs'
import { MachineForm } from '@/components/forms/MachineForms'
import { MachineLogForm } from '@/components/forms/MachineLogForm'
import { RowActions } from '@/components/ui/RowActions'

const TABS = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'historico', label: 'Histórico' },
]

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('machines').select('name').eq('id', id).maybeSingle()
  return { title: data?.name ?? 'Máquina' }
}

export default async function MaquinaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aba?: string; editar?: string; registro?: string; tipo?: string; editar_registro?: string }>
}) {
  const [ctx, { id }, sp] = await Promise.all([requireFarm(), params, searchParams])
  const supabase = await createClient()
  const tab = sp.aba ?? 'resumo'

  const { data: machine } = await supabase
    .from('machines')
    .select('*')
    .eq('id', id)
    .eq('farm_id', ctx.farm.id)
    .maybeSingle()

  if (!machine) notFound()

  const [status, logs, coupled, implementsOn, options, tractors, editingLog] = await Promise.all([
    supabase.from('v_machine_status').select('*').eq('machine_id', id).maybeSingle(),
    supabase
      .from('machine_logs')
      .select('*, plots(code), products(name)')
      .eq('machine_id', id)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200),
    machine.coupled_to
      ? supabase.from('machines').select('id, name').eq('id', machine.coupled_to).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('machines')
      .select('id, name, kind')
      .eq('coupled_to', id)
      .order('name'),
    sp.registro === '1' || sp.editar_registro ? getFormOptions(ctx.farm.id) : Promise.resolve(null),
    sp.editar === '1'
      ? supabase
          .from('machines')
          .select('id, name')
          .eq('farm_id', ctx.farm.id)
          .eq('class', 'maquina')
          .neq('status', 'inativo')
          .order('name')
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    sp.editar_registro
      ? supabase
          .from('machine_logs')
          .select('*')
          .eq('id', sp.editar_registro)
          .eq('machine_id', id)
          .eq('farm_id', ctx.farm.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const selfOption = [
    {
      id: machine.id,
      name: machine.name,
      class: machine.class,
      meter_type: machine.meter_type,
      current_meter: Number(machine.current_meter),
    },
  ]
  const tabQs = sp.aba ? `?aba=${encodeURIComponent(sp.aba)}` : ''

  const s = status.data
  const rows = logs.data ?? []
  const unit = meterUnit(machine.meter_type)
  const tracksMeter = machine.meter_type !== 'nenhum'
  const maintenance = Number(s?.maintenance_cost ?? 0)
  const fuelCost = Number(s?.fuel_cost ?? 0)
  const liters = Number(s?.fuel_liters ?? 0)
  const due = s?.due_level ?? 'ok'

  const dueParts: string[] = []
  if (s?.next_due_date) dueParts.push(`${date(s.next_due_date)} (${relativeDay(s.next_due_date)})`)
  if (s?.next_due_meter != null && tracksMeter)
    dueParts.push(`com ${num(Number(s.next_due_meter))} ${unit}`)

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/maquinas"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
        >
          <ArrowLeftIcon size={15} /> Máquinas e implementos
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-3xl font-semibold tracking-tighter sm:text-4xl">
                {machine.name}
              </h1>
              <Badge
                tone={
                  machine.status === 'manutencao'
                    ? 'warn'
                    : machine.status === 'inativo'
                      ? 'neutral'
                      : 'accent'
                }
              >
                {MACHINE_STATUS_LABEL[machine.status]}
              </Badge>
            </div>
            <p className="mt-1.5 text-sm text-text-muted">
              {[
                MACHINE_CLASS_LABEL[machine.class],
                machine.kind,
                [machine.brand, machine.model].filter(Boolean).join(' '),
                machine.year,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ButtonLink
              href={`/maquinas/${id}?editar=1` as Route}
              variant="secondary"
              size="sm"
            >
              <PencilSimpleIcon size={15} /> Editar
            </ButtonLink>
            {machine.class === 'maquina' && (
              <ButtonLink
                href={`/maquinas/${id}?registro=1&tipo=abastecimento` as Route}
                variant="secondary"
                size="sm"
              >
                <GasPumpIcon size={15} /> Abastecimento
              </ButtonLink>
            )}
            <ButtonLink href={`/maquinas/${id}?registro=1` as Route} size="sm">
              <WrenchIcon size={15} /> Manutenção
            </ButtonLink>
          </div>
        </div>
      </div>

      {sp.editar === '1' && (
        <div className="rounded-lg border border-line-strong bg-bg-raised p-5 sm:p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Editar cadastro</h2>
            <Link
              href={`/maquinas/${id}` as Route}
              aria-label="Fechar edição"
              className="press rounded-md p-1 text-text-muted hover:bg-bg-sunken"
            >
              <XIcon size={18} />
            </Link>
          </div>
          <MachineForm
            action={updateMachine}
            machine={machine}
            tractors={tractors.data ?? []}
            submitLabel="Salvar alterações"
          />
        </div>
      )}

      {sp.registro === '1' && options && (
        <MachineLogForm
          machines={selfOption}
          plots={options.plots}
          products={options.products}
          closeHref={`/maquinas/${id}${tabQs}` as Route}
          defaultMachineId={machine.id}
          defaultType={sp.tipo === 'abastecimento' ? 'abastecimento' : 'preventiva'}
        />
      )}
      {editingLog.data && options && (
        <MachineLogForm
          key={editingLog.data.id}
          machines={selfOption}
          plots={options.plots}
          products={options.products}
          closeHref={`/maquinas/${id}${tabQs}` as Route}
          initial={editingLog.data}
        />
      )}

      <MetricStrip>
        <Metric
          label={machine.meter_type === 'km' ? 'Odômetro' : 'Horímetro'}
          value={tracksMeter ? `${num(Number(machine.current_meter))} ${unit}` : '—'}
        />
        <Metric
          label="Próxima manutenção"
          value={dueParts.length ? dueParts[0] : '—'}
          hint={dueParts[1]}
          tone={due === 'vencida' ? 'negative' : due === 'proxima' ? 'warn' : 'neutral'}
        />
        <Metric label="Manutenção" value={money(maintenance, { compact: true })} />
        <Metric
          label="Combustível"
          value={money(fuelCost, { compact: true })}
          hint={liters > 0 ? `${num(liters)} L` : undefined}
        />
        <Metric label="Custo total" value={money(maintenance + fuelCost, { compact: true })} />
      </MetricStrip>

      <Tabs items={TABS} />

      {tab === 'resumo' && (
        <>
          <Section title="Ficha">
            <DataGrid>
              <DataPair label="Tipo" value={machine.kind ?? '—'} />
              <DataPair label="Marca" value={machine.brand ?? '—'} />
              <DataPair label="Modelo" value={machine.model ?? '—'} />
              <DataPair label="Ano" value={machine.year ? String(machine.year) : '—'} mono />
              <DataPair
                label={machine.class === 'maquina' ? 'Placa / chassi' : 'Nº de série'}
                value={machine.identifier ?? '—'}
                mono
              />
              {machine.class === 'maquina' && (
                <DataPair
                  label="Potência"
                  value={machine.power_hp ? `${num(Number(machine.power_hp))} cv` : '—'}
                  mono
                />
              )}
              {machine.class === 'implemento' && (
                <DataPair
                  label="Acoplado em"
                  value={
                    coupled.data ? (
                      <Link
                        href={`/maquinas/${coupled.data.id}` as Route}
                        className="text-accent-text hover:underline"
                      >
                        {coupled.data.name}
                      </Link>
                    ) : (
                      '—'
                    )
                  }
                />
              )}
              <DataPair label="Aquisição" value={date(machine.acquisition_date)} mono />
              <DataPair
                label="Valor de aquisição"
                value={machine.acquisition_value ? money(Number(machine.acquisition_value)) : '—'}
                mono
              />
              <DataPair label="Última manutenção" value={date(s?.last_service_date)} mono />
            </DataGrid>
            {machine.notes && (
              <p className="mt-4 max-w-[70ch] border-t border-line pt-4 text-sm leading-relaxed text-text-muted">
                {machine.notes}
              </p>
            )}
          </Section>

          {machine.class === 'maquina' && (implementsOn.data ?? []).length > 0 && (
            <Section title="Implementos que usam esta máquina">
              <ul className="divide-y divide-line">
                {(implementsOn.data ?? []).map((i) => (
                  <li key={i.id}>
                    <Link
                      href={`/maquinas/${i.id}` as Route}
                      className="flex items-center justify-between gap-4 py-3 text-sm transition-colors hover:bg-bg-sunken/60"
                    >
                      <span className="font-medium">{i.name}</span>
                      <span className="text-text-muted">{i.kind ?? ''}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}

      {tab === 'historico' && (
        <Section title="Histórico">
          {rows.length === 0 ? (
            <EmptyState
              title="Nenhum registro ainda"
              description="Registre manutenções e abastecimentos para acompanhar o custo e saber quando é a próxima revisão."
              action={
                <ButtonLink href={`/maquinas/${id}?registro=1` as Route}>
                  Registrar manutenção
                </ButtonLink>
              }
            />
          ) : (
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-line-strong text-left">
                    {['Data', 'Tipo', 'Descrição', 'Uso', 'Próxima', 'Valor', ''].map((h, i) => (
                      <th
                        key={i}
                        className={`pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-faint ${
                          i === 3 || i === 5 ? 'text-right' : ''
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((l) => {
                    const next = [
                      l.next_due_date ? date(l.next_due_date, { short: true }) : null,
                      l.next_due_meter != null && tracksMeter
                        ? `${num(Number(l.next_due_meter))} ${unit}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' / ')
                    return (
                      <tr key={l.id}>
                        <td className="num py-2.5 text-text-muted">{date(l.log_date)}</td>
                        <td className="truncate py-2.5 pr-3 text-text-muted">
                          {LOG_TYPE_LABEL[l.log_type]}
                        </td>
                        <td className="truncate py-2.5 pr-3">
                          {l.log_type === 'abastecimento'
                            ? `${num(Number(l.liters ?? 0), 2)} L${l.supplier ? ` · ${l.supplier}` : ''}`
                            : (l.description ?? '—')}
                          {(l.products as { name: string } | null)?.name && (
                            <span className="ml-2 text-xs text-text-faint">
                              estoque: {(l.products as { name: string }).name}
                            </span>
                          )}
                          {(l.plots as { code: string } | null)?.code && (
                            <span className="ml-2 text-xs text-text-faint">
                              {(l.plots as { code: string }).code}
                            </span>
                          )}
                        </td>
                        <td className="num py-2.5 text-right text-text-muted">
                          {l.meter_reading != null ? `${num(Number(l.meter_reading))} ${unit}` : '—'}
                        </td>
                        <td className="num truncate py-2.5 pl-3 text-text-muted">{next || '—'}</td>
                        <td className="num py-2.5 text-right font-medium">{money(Number(l.cost))}</td>
                        <td className="py-2 text-right">
                          <RowActions
                            id={l.id}
                            kind="registro_maquina"
                            editHref={`/maquinas/${id}?${new URLSearchParams({ ...(sp.aba ? { aba: sp.aba } : {}), editar_registro: l.id })}` as Route}
                            confirm="Excluir o registro? O custo e a baixa de estoque são desfeitos."
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
    </div>
  )
}
