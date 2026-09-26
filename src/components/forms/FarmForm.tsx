'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { Field, Input, InputWithUnit, Select } from '@/components/ui/Field'
import { Section } from '@/components/ui/Layout'
import type { ActionState } from '@/lib/actions/shared'
import type { Tables } from '@/lib/types/database'

const UF = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Salvando…' : label}
    </Button>
  )
}

export function FarmForm({
  action,
  farm,
  submitLabel = 'Salvar propriedade',
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  farm?: Tables<'farms'>
  submitLabel?: string
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {})
  const v = (k: keyof Tables<'farms'>) => (farm?.[k] as string | number | null) ?? ''

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <Section title="Identificação">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nome da propriedade" htmlFor="name" required className="sm:col-span-2">
            <Input
              id="name"
              name="name"
              defaultValue={v('name')}
              required
              placeholder="Fazenda Boa Esperança"
            />
          </Field>

          <Field label="Nome fantasia" htmlFor="trade_name">
            <Input id="trade_name" name="trade_name" defaultValue={v('trade_name')} />
          </Field>

          <Field label="Proprietário" htmlFor="owner_name">
            <Input
              id="owner_name"
              name="owner_name"
              defaultValue={v('owner_name')}
              placeholder="João da Silva"
            />
          </Field>

          <Field label="CPF / CNPJ" htmlFor="tax_id">
            <Input
              id="tax_id"
              name="tax_id"
              defaultValue={v('tax_id')}
              inputMode="numeric"
              placeholder="000.000.000-00"
            />
          </Field>

          <Field label="Atividade principal" htmlFor="main_activity">
            <Input
              id="main_activity"
              name="main_activity"
              defaultValue={v('main_activity')}
              placeholder="Fruticultura irrigada"
            />
          </Field>
        </div>
      </Section>

      <Section title="Contato">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Telefone" htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              defaultValue={v('phone')}
              placeholder="(87) 90000-0000"
            />
          </Field>

          <Field label="E-mail" htmlFor="email">
            <Input id="email" name="email" type="email" inputMode="email" defaultValue={v('email')} />
          </Field>
        </div>
      </Section>

      <Section title="Localização">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Endereço" htmlFor="address" className="sm:col-span-2">
            <Input id="address" name="address" defaultValue={v('address')} />
          </Field>

          <Field label="Comunidade / localidade" htmlFor="community">
            <Input
              id="community"
              name="community"
              defaultValue={v('community')}
              placeholder="Maria Tereza"
            />
          </Field>

          <Field label="Cidade" htmlFor="city">
            <Input id="city" name="city" defaultValue={v('city')} placeholder="Petrolina" />
          </Field>

          <Field label="Estado" htmlFor="state">
            <Select id="state" name="state" defaultValue={v('state')}>
              <option value="">—</option>
              {UF.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="CEP" htmlFor="postal_code">
            <Input
              id="postal_code"
              name="postal_code"
              inputMode="numeric"
              defaultValue={v('postal_code')}
              placeholder="56300-000"
            />
          </Field>

          <Field label="Latitude" htmlFor="latitude" hint="Opcional. Ex.: -9,3891">
            <Input id="latitude" name="latitude" inputMode="decimal" defaultValue={v('latitude')} />
          </Field>

          <Field label="Longitude" htmlFor="longitude" hint="Opcional. Ex.: -40,5030">
            <Input
              id="longitude"
              name="longitude"
              inputMode="decimal"
              defaultValue={v('longitude')}
            />
          </Field>
        </div>
      </Section>

      <Section title="Área">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Área total" htmlFor="total_area" hint="Use vírgula para decimais.">
            <InputWithUnit
              id="total_area"
              name="total_area"
              unit="ha"
              inputMode="decimal"
              defaultValue={v('total_area')}
              placeholder="12,4"
            />
          </Field>

          <Field label="Unidade" htmlFor="area_unit">
            <Select id="area_unit" name="area_unit" defaultValue={farm?.area_unit ?? 'ha'}>
              <option value="ha">Hectare (ha)</option>
              <option value="m2">Metro quadrado (m²)</option>
              <option value="alqueire">Alqueire</option>
            </Select>
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
