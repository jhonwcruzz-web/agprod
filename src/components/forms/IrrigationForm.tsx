'use client'

import type { Route } from 'next'
import { Field, Input, InputWithUnit, Select } from '@/components/ui/Field'
import { FormGrid, FormPanel, plotLabel, type PlotOption } from './FormPanel'
import { saveIrrigation } from '@/lib/actions/records'
import { toBr } from '@/lib/calc'
import { today } from '@/lib/format'
import type { Tables } from '@/lib/types/database'

/** Modulo oculto (FEATURES.irrigation); mantido pronto para reativar. */
export function IrrigationForm({
  plots,
  closeHref,
  initial,
}: {
  plots: PlotOption[]
  closeHref: Route
  initial?: Partial<Tables<'irrigation_records'>>
}) {
  const editing = !!initial?.id
  return (
    <FormPanel
      action={saveIrrigation}
      title={editing ? 'Editar irrigação' : 'Registrar irrigação'}
      closeHref={closeHref}
      submitLabel={editing ? 'Salvar alterações' : 'Registrar irrigação'}
      editId={initial?.id}
    >
      <FormGrid>
        <Field label="Data" htmlFor="irrigation_date" required>
          <Input
            id="irrigation_date"
            name="irrigation_date"
            type="date"
            defaultValue={initial?.irrigation_date ?? today()}
            required
            className="num"
          />
        </Field>
        <Field label="Talhão" htmlFor="plot_id" required>
          <Select id="plot_id" name="plot_id" required defaultValue={initial?.plot_id ?? ''}>
            <option value="">—</option>
            {plots.map((p) => (
              <option key={p.id} value={p.id}>
                {plotLabel(p)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Duração" htmlFor="duration_minutes">
          <InputWithUnit
            id="duration_minutes"
            name="duration_minutes"
            unit="min"
            inputMode="numeric"
            defaultValue={toBr(initial?.duration_minutes ?? null, 0)}
          />
        </Field>
        <Field label="Volume" htmlFor="volume_m3">
          <InputWithUnit
            id="volume_m3"
            name="volume_m3"
            unit="m³"
            inputMode="decimal"
            defaultValue={toBr(initial?.volume_m3 ?? null, 2)}
          />
        </Field>
        <Field label="Método" htmlFor="method">
          <Select id="method" name="method" defaultValue={initial?.method ?? ''}>
            <option value="">—</option>
            {['Gotejamento', 'Microaspersão', 'Aspersão', 'Sulco'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Custo" htmlFor="cost">
          <InputWithUnit id="cost" name="cost" unit="R$" inputMode="decimal" defaultValue={toBr(initial?.cost ?? null, 2)} />
        </Field>
        <Field label="Responsável" htmlFor="responsible">
          <Input id="responsible" name="responsible" defaultValue={initial?.responsible ?? ''} />
        </Field>
      </FormGrid>
    </FormPanel>
  )
}
