'use client'

import { useState } from 'react'
import type { Route } from 'next'
import { Field, Input, InputWithUnit, Select, Textarea } from '@/components/ui/Field'
import { CreatableSelect } from '@/components/ui/CreatableSelect'
import { FormGrid, FormPanel, type PlotOption, type VarietyOption } from './FormPanel'
import { PlotSelect, usePlotVariety } from './fields'
import { createHarvestDestination, saveProduction } from '@/lib/actions/records'
import { toBr } from '@/lib/calc'
import { today } from '@/lib/format'
import type { Tables } from '@/lib/types/database'

/** Unidades que ja' sao massa — as demais exigem o peso unitario. */
const MASS_UNITS = ['kg', 't', 'g']
const HARVEST_UNITS = ['kg', 'caixa', 't', 'unidade'] as const

export function ProductionForm({
  plots,
  varieties,
  destinations,
  closeHref,
  initial,
  serviceOrder,
}: {
  plots: PlotOption[]
  varieties: VarietyOption[]
  destinations: { name: string }[]
  closeHref: Route
  initial?: Partial<Tables<'production_records'>>
  /** Colheita feita a partir de uma OS: salvar conclui a OS. */
  serviceOrder?: { id: string; number: number }
}) {
  const [unit, setUnit] = useState<string>(initial?.unit ?? 'kg')
  const needsWeight = !MASS_UNITS.includes(unit)
  const pv = usePlotVariety(plots, varieties, {
    plotId: initial?.plot_id,
    varietyId: initial?.variety_id,
  })
  const editing = !!initial?.id

  // Destino gravado que nao esta mais na lista continua aparecendo.
  const destOptions = destinations.map((d) => ({ value: d.name, label: d.name }))
  if (initial?.destination && !destOptions.some((o) => o.value === initial.destination))
    destOptions.push({ value: initial.destination, label: initial.destination })

  return (
    <FormPanel
      action={saveProduction}
      title={
        editing
          ? 'Editar colheita'
          : serviceOrder
            ? `Registrar colheita da OS ${String(serviceOrder.number).padStart(4, '0')}`
            : 'Registrar colheita'
      }
      description={
        serviceOrder
          ? 'Preenchido com os dados da ordem. Informe o que foi colhido — ao salvar, a OS é concluída.'
          : 'Data, talhão e quantidade bastam. A variedade vem do talhão.'
      }
      closeHref={closeHref}
      submitLabel={editing ? 'Salvar alterações' : 'Registrar colheita'}
      editId={initial?.id}
    >
      {serviceOrder && <input type="hidden" name="service_order_id" value={serviceOrder.id} />}
      <FormGrid>
        <Field label="Data" htmlFor="harvest_date" required>
          <Input
            id="harvest_date"
            name="harvest_date"
            type="date"
            defaultValue={initial?.harvest_date ?? today()}
            required
            className="num"
          />
        </Field>

        <PlotSelect plots={plots} value={pv.plotId} onChange={pv.selectPlot} required />

        <Field label="Variedade" htmlFor="variety_id" hint={pv.hint}>
          <Select
            id="variety_id"
            name="variety_id"
            value={pv.varietyId}
            onChange={(e) => pv.setVarietyId(e.target.value)}
          >
            <option value="">—</option>
            {pv.list.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Quantidade" htmlFor="quantity" required>
          <Input
            id="quantity"
            name="quantity"
            inputMode="decimal"
            required
            defaultValue={toBr(initial?.quantity ?? null, 3)}
            placeholder="900"
            className="num"
          />
        </Field>

        <Field label="Unidade" htmlFor="unit">
          <Select id="unit" name="unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {HARVEST_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>

        {needsWeight && (
          <Field
            label={`Peso de cada ${unit}`}
            htmlFor="unit_weight_kg"
            hint="Necessário para calcular custo por kg."
            required
          >
            <InputWithUnit
              id="unit_weight_kg"
              name="unit_weight_kg"
              unit="kg"
              inputMode="decimal"
              defaultValue={toBr(initial?.unit_weight_kg ?? null, 3)}
              placeholder="8,5"
              required
            />
          </Field>
        )}

        <Field label="Destino" htmlFor="destination" hint="Use o + para criar outra opção.">
          <CreatableSelect
            id="destination"
            name="destination"
            options={destOptions}
            defaultValue={initial?.destination ?? ''}
            addLabel="Novo destino"
            onCreate={async (label) => {
              const res = await createHarvestDestination(label)
              return 'error' in res ? res : { value: res.name, label: res.name }
            }}
          />
        </Field>

        <Field label="Equipe" htmlFor="team">
          <Input id="team" name="team" defaultValue={initial?.team ?? ''} placeholder="Turma da colheita" />
        </Field>
      </FormGrid>

      <div className="mt-5">
        <Field label="Observações" htmlFor="notes">
          <Textarea id="notes" name="notes" defaultValue={initial?.notes ?? ''} />
        </Field>
      </div>
    </FormPanel>
  )
}
