'use client'

import { useActionState, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { Field, Input, InputWithUnit, Select, Textarea } from '@/components/ui/Field'
import { Section } from '@/components/ui/Layout'
import type { ActionState } from '@/lib/actions/shared'
import type { Tables } from '@/lib/types/database'

type Crop = Pick<Tables<'crops'>, 'id' | 'slug' | 'name'>
type Item = { id: string; crop_id: string; name: string }

/** Campos e opcoes que mudam conforme a cultura (secao 46). */
const IRRIGATION = ['Gotejamento', 'Microaspersão', 'Aspersão', 'Sulco', 'Sequeiro']
const TRAINING: Record<string, string[]> = {
  uva: ['Latada', 'Espaldeira', 'Y', 'Manjedoura', 'Lira'],
  manga: ['Copa livre', 'Taça', 'Adensado', 'Líder central'],
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Salvando…' : label}
    </Button>
  )
}

export function PlotForm({
  action,
  crops,
  varieties,
  rootstocks,
  plot,
  submitLabel = 'Salvar talhão',
  allowContinue = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  crops: Crop[]
  varieties: Item[]
  rootstocks: Item[]
  plot?: Tables<'plots'>
  submitLabel?: string
  allowContinue?: boolean
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {})
  const [cropId, setCropId] = useState(plot?.crop_id ?? crops[0]?.id ?? '')

  const slug = crops.find((c) => c.id === cropId)?.slug ?? ''
  const cropVarieties = useMemo(
    () => varieties.filter((v) => v.crop_id === cropId),
    [varieties, cropId],
  )
  const cropRootstocks = useMemo(
    () => rootstocks.filter((r) => r.crop_id === cropId),
    [rootstocks, cropId],
  )
  const trainingOptions = TRAINING[slug] ?? []

  const v = (k: keyof Tables<'plots'>) => (plot?.[k] as string | number | null) ?? ''

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {plot && <input type="hidden" name="id" value={plot.id} />}

      <Section title="Identificação">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Código" htmlFor="code" hint="Como você chama no dia a dia." required>
            <Input
              id="code"
              name="code"
              defaultValue={v('code')}
              required
              placeholder="P-03"
              className="num"
            />
          </Field>

          <Field label="Nome" htmlFor="name" hint="Opcional.">
            <Input id="name" name="name" defaultValue={v('name')} placeholder="Parcela da frente" />
          </Field>

          <Field label="Área" htmlFor="area" required>
            <InputWithUnit
              id="area"
              name="area"
              unit="ha"
              inputMode="decimal"
              defaultValue={v('area')}
              placeholder="3,2"
              required
            />
          </Field>

          <Field label="Situação" htmlFor="status">
            <Select id="status" name="status" defaultValue={plot?.status ?? 'producao'}>
              <option value="producao">Em produção</option>
              <option value="formacao">Em formação</option>
              <option value="repouso">Em repouso</option>
              <option value="inativo">Inativo</option>
            </Select>
          </Field>
        </div>
        <input type="hidden" name="area_unit" value="ha" />
      </Section>

      <Section title="Cultura e material vegetal">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Cultura" htmlFor="crop_id" required>
            <Select
              id="crop_id"
              name="crop_id"
              value={cropId}
              onChange={(e) => setCropId(e.target.value)}
              required
            >
              {crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Variedade / cultivar" htmlFor="variety_id">
            <Select id="variety_id" name="variety_id" defaultValue={v('variety_id')}>
              <option value="">—</option>
              {cropVarieties.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Porta-enxerto"
            htmlFor="rootstock_id"
            hint={slug === 'manga' ? 'Quando aplicável.' : undefined}
          >
            <Select id="rootstock_id" name="rootstock_id" defaultValue={v('rootstock_id')}>
              <option value="">—</option>
              {cropRootstocks.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Data de plantio" htmlFor="planting_date">
            <Input
              id="planting_date"
              name="planting_date"
              type="date"
              defaultValue={String(v('planting_date')).slice(0, 10)}
              className="num"
            />
          </Field>
        </div>
      </Section>

      <Section title="Plantio e manejo">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Quantidade de plantas" htmlFor="plant_count">
            <Input
              id="plant_count"
              name="plant_count"
              inputMode="numeric"
              defaultValue={v('plant_count')}
              placeholder="4850"
              className="num"
            />
          </Field>

          <Field label="Espaçamento entre linhas" htmlFor="row_spacing">
            <InputWithUnit
              id="row_spacing"
              name="row_spacing"
              unit="m"
              inputMode="decimal"
              defaultValue={v('row_spacing')}
              placeholder="3,5"
            />
          </Field>

          <Field label="Espaçamento entre plantas" htmlFor="plant_spacing">
            <InputWithUnit
              id="plant_spacing"
              name="plant_spacing"
              unit="m"
              inputMode="decimal"
              defaultValue={v('plant_spacing')}
              placeholder="2,0"
            />
          </Field>

          <Field label="Sistema de irrigação" htmlFor="irrigation_system">
            <Select
              id="irrigation_system"
              name="irrigation_system"
              defaultValue={v('irrigation_system')}
            >
              <option value="">—</option>
              {IRRIGATION.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
          </Field>

          {trainingOptions.length > 0 && (
            <Field label="Sistema de condução" htmlFor="training_system">
              <Select
                id="training_system"
                name="training_system"
                defaultValue={v('training_system')}
              >
                <option value="">—</option>
                {trainingOptions.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      </Section>

      <Section title="Observações">
        <Field label="Anotações" htmlFor="notes">
          <Textarea
            id="notes"
            name="notes"
            defaultValue={v('notes')}
            placeholder="Qualquer coisa que valha lembrar sobre este talhão."
          />
        </Field>
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

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <Submit label={submitLabel} />
        {allowContinue && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
            <input
              type="checkbox"
              name="continuar"
              className="size-4 accent-[var(--accent)]"
            />
            Cadastrar outro talhão em seguida
          </label>
        )}
      </div>
    </form>
  )
}
