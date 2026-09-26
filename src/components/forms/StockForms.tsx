'use client'

import { useState } from 'react'
import type { Route } from 'next'
import { Field, Input, InputWithUnit, Select, Textarea } from '@/components/ui/Field'
import { FormGrid, FormPanel, type Option } from './FormPanel'
import { createBuyer, createMovement, createProduct } from '@/lib/actions/records'
import { PRODUCT_LABEL, today } from '@/lib/format'

const UNITS = ['kg', 'L', 'saco', 'unidade', 'g', 'mL', 't', 'dose']

export function ProductForm({ closeHref }: { closeHref: Route }) {
  const [category, setCategory] = useState('fertilizante')

  return (
    <FormPanel
      action={createProduct}
      title="Cadastrar produto"
      description="Depois de cadastrado, aplicações e adubações dão baixa sozinhas."
      closeHref={closeHref}
      submitLabel="Cadastrar produto"
    >
      <FormGrid>
        <Field label="Nome" htmlFor="name" required className="sm:col-span-2">
          <Input id="name" name="name" required placeholder="20-05-20" />
        </Field>

        <Field label="Categoria" htmlFor="category" required>
          <Select
            id="category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            {Object.entries(PRODUCT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Unidade" htmlFor="unit" required>
          <Select id="unit" name="unit" defaultValue="kg" required>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>

        {category === 'defensivo' && (
          <Field label="Ingrediente ativo" htmlFor="active_ingredient" className="sm:col-span-2">
            <Input id="active_ingredient" name="active_ingredient" placeholder="Azoxistrobina" />
          </Field>
        )}

        <Field
          label="Estoque mínimo"
          htmlFor="min_stock"
          hint="Abaixo disso o sistema avisa."
        >
          <Input id="min_stock" name="min_stock" inputMode="decimal" className="num" placeholder="20" />
        </Field>

        <Field label="Custo unitário" htmlFor="unit_cost">
          <InputWithUnit id="unit_cost" name="unit_cost" unit="R$" inputMode="decimal" />
        </Field>

        <Field label="Localização" htmlFor="location">
          <Input id="location" name="location" placeholder="Galpão" />
        </Field>
      </FormGrid>
    </FormPanel>
  )
}

export function MovementForm({
  products,
  closeHref,
  defaultType = 'entrada',
}: {
  products: (Option & { unit: string; current_stock: number })[]
  closeHref: Route
  defaultType?: 'entrada' | 'saida' | 'ajuste'
}) {
  const [type, setType] = useState<string>(defaultType)
  const [productId, setProductId] = useState('')
  const product = products.find((p) => p.id === productId)

  const label =
    type === 'entrada' ? 'Compra / entrada' : type === 'saida' ? 'Saída' : 'Ajuste de inventário'

  return (
    <FormPanel
      action={createMovement}
      title={`Registrar ${label.toLowerCase()}`}
      description={
        type === 'ajuste'
          ? 'O ajuste define o saldo real contado no inventário.'
          : undefined
      }
      closeHref={closeHref}
      submitLabel="Registrar movimento"
    >
      <FormGrid>
        <Field label="Tipo" htmlFor="movement_type" required>
          <Select
            id="movement_type"
            name="movement_type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            required
          >
            <option value="entrada">Entrada (compra)</option>
            <option value="saida">Saída (uso avulso)</option>
            <option value="ajuste">Ajuste de inventário</option>
          </Select>
        </Field>

        <Field label="Produto" htmlFor="product_id" required>
          <Select
            id="product_id"
            name="product_id"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            required
          >
            <option value="">—</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.current_stock} {p.unit})
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={type === 'ajuste' ? 'Saldo contado' : 'Quantidade'}
          htmlFor="quantity"
          required
        >
          <InputWithUnit
            id="quantity"
            name="quantity"
            unit={product?.unit ?? '—'}
            inputMode="decimal"
            required
            placeholder="50"
          />
        </Field>

        <Field label="Data" htmlFor="movement_date" required>
          <Input
            id="movement_date"
            name="movement_date"
            type="date"
            defaultValue={today()}
            required
            className="num"
          />
        </Field>

        {type === 'entrada' && (
          <>
            <Field label="Custo unitário" htmlFor="unit_cost">
              <InputWithUnit
                id="unit_cost"
                name="unit_cost"
                unit="R$"
                inputMode="decimal"
                placeholder="230,00"
              />
            </Field>

            <Field label="Valor total" htmlFor="total_cost" hint="Vazio calcula quantidade × custo.">
              <InputWithUnit id="total_cost" name="total_cost" unit="R$" inputMode="decimal" />
            </Field>
          </>
        )}

        <Field label="Observação" htmlFor="notes" className="sm:col-span-2">
          <Input id="notes" name="notes" placeholder="Nota fiscal 1234" />
        </Field>
      </FormGrid>

      {type === 'entrada' && (
        <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-md bg-bg-sunken px-3 py-3 text-sm">
          <input
            type="checkbox"
            name="register_expense"
            defaultChecked
            className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
          />
          <span>
            Lançar também como despesa no financeiro
            <span className="mt-0.5 block text-xs text-text-muted">
              Entra como saída de caixa. O custo de produção só é contado quando o insumo for
              aplicado no talhão — assim o valor não é somado duas vezes.
            </span>
          </span>
        </label>
      )}
    </FormPanel>
  )
}

export function BuyerForm({ closeHref }: { closeHref: Route }) {
  return (
    <FormPanel
      action={createBuyer}
      title="Cadastrar comprador"
      closeHref={closeHref}
      submitLabel="Cadastrar comprador"
    >
      <FormGrid>
        <Field label="Nome" htmlFor="name" required className="sm:col-span-2">
          <Input id="name" name="name" required placeholder="Atacadão de Frutas" />
        </Field>

        <Field label="CPF / CNPJ" htmlFor="tax_id">
          <Input id="tax_id" name="tax_id" inputMode="numeric" />
        </Field>

        <Field label="Telefone" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" inputMode="tel" />
        </Field>

        <Field label="E-mail" htmlFor="email">
          <Input id="email" name="email" type="email" inputMode="email" />
        </Field>

        <Field label="Localização" htmlFor="location">
          <Input id="location" name="location" placeholder="Juazeiro/BA" />
        </Field>
      </FormGrid>

      <div className="mt-5">
        <Field label="Observações" htmlFor="notes">
          <Textarea id="notes" name="notes" />
        </Field>
      </div>
    </FormPanel>
  )
}
