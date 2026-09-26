'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import type { Route } from 'next'
import { CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { Field, Input, InputWithUnit, Select, Textarea } from '@/components/ui/Field'
import { Section } from '@/components/ui/Layout'
import { FormGrid, FormPanel, plotLabel, type PlotOption } from './FormPanel'
import { createMachineLog } from '@/lib/actions/machines'
import type { ActionState } from '@/lib/actions/shared'
import type { Tables } from '@/lib/types/database'
import { LOG_TYPE_LABEL, MACHINE_KINDS, meterUnit, today } from '@/lib/format'

type Machine = Tables<'machines'>
export type MachineOption = {
  id: string
  name: string
  class: string
  meter_type: string
  current_meter: number
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Salvando…' : label}
    </Button>
  )
}

/* ------------------------------------------------------------ CADASTRO */

export function MachineForm({
  action,
  machine,
  tractors,
  defaultClass = 'maquina',
  submitLabel = 'Salvar',
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  machine?: Machine
  /** Maquinas da fazenda, para acoplar o implemento. */
  tractors: { id: string; name: string }[]
  defaultClass?: 'maquina' | 'implemento'
  submitLabel?: string
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {})
  const [cls, setCls] = useState<string>(machine?.class ?? defaultClass)
  const [meterType, setMeterType] = useState<string>(machine?.meter_type ?? 'horas')
  const isMachine = cls === 'maquina'

  const v = (k: keyof Machine) => (machine?.[k] as string | number | null) ?? ''

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {machine && <input type="hidden" name="id" value={machine.id} />}

      <Section title="Identificação">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="É uma" htmlFor="class" required>
            <Select
              id="class"
              name="class"
              value={cls}
              onChange={(e) => setCls(e.target.value)}
              required
            >
              <option value="maquina">Máquina (tem motor)</option>
              <option value="implemento">Implemento (é acoplado)</option>
            </Select>
          </Field>

          <Field label="Tipo" htmlFor="kind" hint="Escolha ou digite.">
            <Input
              id="kind"
              name="kind"
              list="machine-kinds"
              defaultValue={v('kind')}
              placeholder={isMachine ? 'Trator' : 'Grade'}
            />
            <datalist id="machine-kinds">
              {(MACHINE_KINDS[cls] ?? []).map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </Field>

          <Field
            label="Nome"
            htmlFor="name"
            hint="Como você chama no dia a dia."
            required
            className="sm:col-span-2"
          >
            <Input
              id="name"
              name="name"
              defaultValue={v('name')}
              required
              placeholder={isMachine ? 'Trator azul' : 'Grade 14 discos'}
            />
          </Field>

          <Field label="Marca" htmlFor="brand">
            <Input id="brand" name="brand" defaultValue={v('brand')} placeholder="Massey Ferguson" />
          </Field>

          <Field label="Modelo" htmlFor="model">
            <Input id="model" name="model" defaultValue={v('model')} placeholder="MF 4275" />
          </Field>

          <Field label="Ano" htmlFor="year">
            <Input
              id="year"
              name="year"
              inputMode="numeric"
              defaultValue={v('year')}
              placeholder="2018"
              className="num"
            />
          </Field>

          <Field
            label={isMachine ? 'Placa / chassi' : 'Nº de série'}
            htmlFor="identifier"
          >
            <Input id="identifier" name="identifier" defaultValue={v('identifier')} />
          </Field>
        </div>
      </Section>

      {isMachine ? (
        <Section title="Motor e uso">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Potência" htmlFor="power_hp">
              <InputWithUnit
                id="power_hp"
                name="power_hp"
                unit="cv"
                inputMode="decimal"
                defaultValue={v('power_hp')}
                placeholder="75"
              />
            </Field>

            <Field label="Controle de uso" htmlFor="meter_type">
              <Select
                id="meter_type"
                name="meter_type"
                value={meterType}
                onChange={(e) => setMeterType(e.target.value)}
              >
                <option value="horas">Horímetro (horas)</option>
                <option value="km">Odômetro (km)</option>
                <option value="nenhum">Não controlo</option>
              </Select>
            </Field>

            {meterType !== 'nenhum' && (
              <Field
                label={meterType === 'km' ? 'Odômetro atual' : 'Horímetro atual'}
                htmlFor="current_meter"
                hint="Depois se atualiza sozinho pelos registros."
              >
                <InputWithUnit
                  id="current_meter"
                  name="current_meter"
                  unit={meterUnit(meterType)}
                  inputMode="decimal"
                  defaultValue={v('current_meter')}
                  placeholder="1200"
                />
              </Field>
            )}
          </div>
        </Section>
      ) : (
        <Section title="Uso">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Normalmente acoplado em"
              htmlFor="coupled_to"
              className="sm:col-span-2"
            >
              <Select id="coupled_to" name="coupled_to" defaultValue={v('coupled_to')}>
                <option value="">—</option>
                {tractors
                  .filter((t) => t.id !== machine?.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
        </Section>
      )}

      <Section title="Patrimônio">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Data de aquisição" htmlFor="acquisition_date">
            <Input
              id="acquisition_date"
              name="acquisition_date"
              type="date"
              defaultValue={String(v('acquisition_date')).slice(0, 10)}
              className="num"
            />
          </Field>

          <Field label="Valor de aquisição" htmlFor="acquisition_value">
            <InputWithUnit
              id="acquisition_value"
              name="acquisition_value"
              unit="R$"
              inputMode="decimal"
              defaultValue={v('acquisition_value')}
            />
          </Field>

          <Field label="Situação" htmlFor="status">
            <Select id="status" name="status" defaultValue={machine?.status ?? 'operacional'}>
              <option value="operacional">Operacional</option>
              <option value="manutencao">Em manutenção</option>
              <option value="inativo">Inativo</option>
            </Select>
          </Field>
        </div>

        <div className="mt-5">
          <Field label="Observações" htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={v('notes')} />
          </Field>
        </div>
      </Section>

      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger"
        >
          <WarningCircleIcon size={18} weight="bold" className="mt-px shrink-0" />
          {state.error}
        </p>
      )}

      {state.message && (
        <p className="flex items-start gap-2 rounded-md bg-accent-soft px-3 py-2.5 text-sm text-accent-text">
          <CheckCircleIcon size={18} weight="fill" className="mt-px shrink-0" />
          {state.message}
        </p>
      )}

      <div className="flex items-center gap-3 border-t border-line pt-6">
        <Submit label={submitLabel} />
      </div>
    </form>
  )
}

/* -------------------------------------------- MANUTENCAO / ABASTECIMENTO */

export function MachineLogForm({
  machines,
  plots,
  closeHref,
  defaultMachineId,
  defaultType = 'preventiva',
}: {
  machines: MachineOption[]
  plots: PlotOption[]
  closeHref: Route
  defaultMachineId?: string
  defaultType?: 'preventiva' | 'corretiva' | 'revisao' | 'abastecimento'
}) {
  const [type, setType] = useState<string>(defaultType)
  const [machineId, setMachineId] = useState(defaultMachineId ?? '')
  const machine = machines.find((m) => m.id === machineId)
  const unit = meterUnit(machine?.meter_type)
  const tracksMeter = !!machine && machine.meter_type !== 'nenhum'
  const isFuel = type === 'abastecimento'

  return (
    <FormPanel
      action={createMachineLog}
      title={isFuel ? 'Registrar abastecimento' : 'Registrar manutenção'}
      description="O valor entra sozinho nos custos da propriedade."
      closeHref={closeHref}
      submitLabel="Salvar registro"
    >
      <FormGrid>
        <Field label="Máquina ou implemento" htmlFor="machine_id" required>
          <Select
            id="machine_id"
            name="machine_id"
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            required
          >
            <option value="">—</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="O que foi" htmlFor="log_type" required>
          <Select
            id="log_type"
            name="log_type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            required
          >
            {Object.entries(LOG_TYPE_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Data" htmlFor="log_date" required>
          <Input
            id="log_date"
            name="log_date"
            type="date"
            defaultValue={today()}
            required
            className="num"
          />
        </Field>

        {tracksMeter && (
          <Field
            label={machine?.meter_type === 'km' ? 'Odômetro' : 'Horímetro'}
            htmlFor="meter_reading"
            hint={`Atual: ${machine?.current_meter} ${unit}`}
          >
            <InputWithUnit
              id="meter_reading"
              name="meter_reading"
              unit={unit}
              inputMode="decimal"
              key={`m-${machineId}`}
            />
          </Field>
        )}

        {isFuel ? (
          <Field label="Litros" htmlFor="liters" required>
            <InputWithUnit
              id="liters"
              name="liters"
              unit="L"
              inputMode="decimal"
              required
              placeholder="80"
            />
          </Field>
        ) : (
          <Field
            label="O que foi feito"
            htmlFor="description"
            required
            className="sm:col-span-2"
          >
            <Input
              id="description"
              name="description"
              required
              placeholder={type === 'corretiva' ? 'Troca da bomba hidráulica' : 'Troca de óleo e filtros'}
            />
          </Field>
        )}

        <Field label="Valor" htmlFor="cost">
          <InputWithUnit id="cost" name="cost" unit="R$" inputMode="decimal" placeholder="0,00" />
        </Field>

        <Field label={isFuel ? 'Posto' : 'Oficina / fornecedor'} htmlFor="supplier">
          <Input id="supplier" name="supplier" />
        </Field>

        {!isFuel && (
          <>
            <Field label="Próxima manutenção" htmlFor="next_due_date" hint="Por data…">
              <Input id="next_due_date" name="next_due_date" type="date" className="num" />
            </Field>

            {tracksMeter && (
              <Field label="…ou pelo uso" htmlFor="next_due_meter" hint="O que vencer primeiro.">
                <InputWithUnit
                  id="next_due_meter"
                  name="next_due_meter"
                  unit={unit}
                  inputMode="decimal"
                  key={`n-${machineId}`}
                />
              </Field>
            )}
          </>
        )}

        <Field
          label="Talhão"
          htmlFor="plot_id"
          hint="Só se o custo for de um talhão específico."
        >
          <Select id="plot_id" name="plot_id" defaultValue="">
            <option value="">Custo geral</option>
            {plots.map((p) => (
              <option key={p.id} value={p.id}>
                {plotLabel(p)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Responsável" htmlFor="responsible">
          <Input id="responsible" name="responsible" />
        </Field>
      </FormGrid>
    </FormPanel>
  )
}
