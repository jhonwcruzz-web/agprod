'use client'

import { useState } from 'react'
import type { Route } from 'next'
import { Field, Input, InputWithUnit, Select, Textarea } from '@/components/ui/Field'
import { CreatableSelect } from '@/components/ui/CreatableSelect'
import { FormGrid, FormPanel } from './FormPanel'
import {
  createProductCategory,
  saveBuyer,
  saveMovement,
  saveProduct,
} from '@/lib/actions/records'
import { parseBr, round, toBr } from '@/lib/calc'
import { money, num, today } from '@/lib/format'
import type { Tables } from '@/lib/types/database'

const UNITS = ['kg', 'L', 'saco', 'unidade', 'g', 'mL', 't', 'dose']

export function ProductForm({
  categories,
  closeHref,
  initial,
}: {
  categories: { id: string; name: string }[]
  closeHref: Route
  initial?: Partial<Tables<'products'>>
}) {
  const editing = !!initial?.id
  const defaultCat = categories.find((c) => c.name === 'Fertilizante')?.id ?? categories[0]?.id ?? ''

  return (
    <FormPanel
      action={saveProduct}
      title={editing ? 'Editar produto' : 'Cadastrar produto'}
      description="Depois de cadastrado, pulverizações, adubações e máquinas dão baixa sozinhas."
      closeHref={closeHref}
      submitLabel={editing ? 'Salvar alterações' : 'Cadastrar produto'}
      editId={initial?.id}
    >
      <FormGrid>
        <Field label="Nome" htmlFor="name" required className="sm:col-span-2">
          <Input id="name" name="name" required defaultValue={initial?.name ?? ''} placeholder="20-05-20" />
        </Field>

        <Field label="Categoria" htmlFor="category_id" required hint="Use o + para criar outra categoria.">
          <CreatableSelect
            id="category_id"
            name="category_id"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            defaultValue={initial?.category_id ?? defaultCat}
            addLabel="Nova categoria"
            onCreate={async (label) => {
              const res = await createProductCategory(label)
              return 'error' in res ? res : { value: res.id, label: res.name }
            }}
          />
        </Field>

        <Field label="Unidade" htmlFor="unit" required hint="É nela que as baixas acontecem.">
          <Select id="unit" name="unit" defaultValue={initial?.unit ?? 'kg'} required>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Ingrediente ativo" htmlFor="active_ingredient" className="sm:col-span-2" hint="Para defensivos.">
          <Input
            id="active_ingredient"
            name="active_ingredient"
            defaultValue={initial?.active_ingredient ?? ''}
            placeholder="Azoxistrobina"
          />
        </Field>

        <Field label="Estoque mínimo" htmlFor="min_stock" hint="Abaixo disso o sistema avisa.">
          <Input
            id="min_stock"
            name="min_stock"
            inputMode="decimal"
            className="num"
            defaultValue={toBr(initial?.min_stock ?? null, 3)}
            placeholder="20"
          />
        </Field>

        <Field
          label={editing ? 'Custo médio' : 'Custo unitário'}
          htmlFor="unit_cost"
          hint={editing ? 'Atualizado sozinho a cada compra.' : 'Opcional: as compras definem o custo médio.'}
        >
          <InputWithUnit
            id="unit_cost"
            name="unit_cost"
            unit="R$"
            inputMode="decimal"
            defaultValue={toBr(initial?.unit_cost ?? null, 4)}
          />
        </Field>

        <Field label="Localização" htmlFor="location">
          <Input id="location" name="location" defaultValue={initial?.location ?? ''} placeholder="Galpão" />
        </Field>
      </FormGrid>
    </FormPanel>
  )
}

export function MovementForm({
  products,
  closeHref,
  defaultType = 'entrada',
  initial,
}: {
  products: { id: string; name: string; unit: string; current_stock: number; unit_cost: number }[]
  closeHref: Route
  defaultType?: 'entrada' | 'saida' | 'ajuste'
  initial?: Partial<Tables<'inventory_movements'>>
}) {
  const [type, setType] = useState<string>(initial?.movement_type ?? defaultType)
  const [productId, setProductId] = useState(initial?.product_id ?? '')
  const [qtyTxt, setQtyTxt] = useState(toBr(initial?.quantity ?? null, 3))
  const [unitTxt, setUnitTxt] = useState(toBr(initial?.unit_cost ?? null, 4))
  const [totalTxt, setTotalTxt] = useState('')
  const product = products.find((p) => p.id === productId)
  const editing = !!initial?.id

  // Custo unitario ou total: o que faltar sai da conta (servidor faz igual).
  const qty = parseBr(qtyTxt)
  const unitCost = parseBr(unitTxt)
  const totalTyped = parseBr(totalTxt)
  const total = totalTyped ?? (qty !== null && unitCost !== null ? round(qty * unitCost, 2) : null)
  const unitShown = unitCost ?? (qty && totalTyped !== null ? round(totalTyped / qty, 4) : null)

  const label = type === 'entrada' ? 'Compra / entrada' : type === 'saida' ? 'Saída' : 'Ajuste de inventário'

  return (
    <FormPanel
      action={saveMovement}
      title={`${editing ? 'Editar' : 'Registrar'} ${label.toLowerCase()}`}
      description={type === 'ajuste' ? 'O ajuste define o saldo real contado no inventário.' : undefined}
      closeHref={closeHref}
      submitLabel={editing ? 'Salvar alterações' : 'Registrar movimento'}
      editId={initial?.id}
    >
      <FormGrid>
        <Field label="Tipo" htmlFor="movement_type" required>
          <Select id="movement_type" name="movement_type" value={type} onChange={(e) => setType(e.target.value)} required>
            <option value="entrada">Entrada (compra)</option>
            <option value="saida">Saída (uso avulso)</option>
            <option value="ajuste">Ajuste de inventário</option>
          </Select>
        </Field>

        <Field
          label="Produto"
          htmlFor="product_id"
          required
          hint={product ? `Saldo ${num(product.current_stock, 2)} ${product.unit} · custo médio ${money(product.unit_cost)}` : undefined}
        >
          <Select id="product_id" name="product_id" value={productId} onChange={(e) => setProductId(e.target.value)} required>
            <option value="">—</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={type === 'ajuste' ? 'Saldo contado' : 'Quantidade'} htmlFor="quantity" required>
          <InputWithUnit
            id="quantity"
            name="quantity"
            unit={product?.unit ?? '—'}
            inputMode="decimal"
            required
            value={qtyTxt}
            onChange={(e) => setQtyTxt(e.target.value)}
            placeholder="50"
          />
        </Field>

        <Field label="Data" htmlFor="movement_date" required>
          <Input
            id="movement_date"
            name="movement_date"
            type="date"
            defaultValue={initial?.movement_date ?? today()}
            required
            className="num"
          />
        </Field>

        {type === 'entrada' && (
          <>
            <Field label="Preço unitário" htmlFor="unit_cost" hint="Ou informe o valor total da nota.">
              <InputWithUnit
                id="unit_cost"
                name="unit_cost"
                unit="R$"
                inputMode="decimal"
                value={unitTxt}
                onChange={(e) => {
                  setUnitTxt(e.target.value)
                  if (e.target.value) setTotalTxt('')
                }}
                placeholder={unitShown !== null && unitCost === null ? toBr(unitShown, 2) : '230,00'}
              />
            </Field>

            <Field label="Valor total" htmlFor="total_cost">
              <InputWithUnit
                id="total_cost"
                name="total_cost"
                unit="R$"
                inputMode="decimal"
                value={totalTxt}
                onChange={(e) => {
                  setTotalTxt(e.target.value)
                  if (e.target.value) setUnitTxt('')
                }}
                placeholder={total !== null && totalTyped === null ? toBr(total, 2) : ''}
              />
            </Field>
          </>
        )}

        <Field label="Observação" htmlFor="notes" className="sm:col-span-2">
          <Input id="notes" name="notes" defaultValue={initial?.notes ?? ''} placeholder="Nota fiscal 1234" />
        </Field>
      </FormGrid>

      {type === 'entrada' && total !== null && product && (
        <p className="mt-5 rounded-md bg-bg-sunken px-4 py-3 text-sm">
          Entram <span className="num font-semibold">{num(qty ?? 0, 3)} {product.unit}</span> por{' '}
          <span className="num font-semibold">{money(total)}</span>
          {unitShown !== null && <span className="text-text-muted"> ({money(unitShown)}/{product.unit})</span>}.
          O custo médio do produto é recalculado sozinho.
        </p>
      )}

      {type === 'entrada' && !editing && (
        <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-md bg-bg-sunken px-3 py-3 text-sm">
          <input type="checkbox" name="register_expense" defaultChecked className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
          <span>
            Lançar também como despesa no financeiro
            <span className="mt-0.5 block text-xs text-text-muted">
              Entra como saída de caixa. O custo de produção só é contado quando o insumo for aplicado no
              talhão — assim o valor não é somado duas vezes.
            </span>
          </span>
        </label>
      )}
    </FormPanel>
  )
}

export function BuyerForm({
  closeHref,
  initial,
}: {
  closeHref: Route
  initial?: Partial<Tables<'buyers'>>
}) {
  const editing = !!initial?.id
  return (
    <FormPanel
      action={saveBuyer}
      title={editing ? 'Editar comprador' : 'Cadastrar comprador'}
      closeHref={closeHref}
      submitLabel={editing ? 'Salvar alterações' : 'Cadastrar comprador'}
      editId={initial?.id}
    >
      <FormGrid>
        <Field label="Nome" htmlFor="name" required className="sm:col-span-2">
          <Input id="name" name="name" required defaultValue={initial?.name ?? ''} placeholder="Atacadão de Frutas" />
        </Field>
        <Field label="CPF / CNPJ" htmlFor="tax_id">
          <Input id="tax_id" name="tax_id" inputMode="numeric" defaultValue={initial?.tax_id ?? ''} />
        </Field>
        <Field label="Telefone" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={initial?.phone ?? ''} />
        </Field>
        <Field label="E-mail" htmlFor="email">
          <Input id="email" name="email" type="email" inputMode="email" defaultValue={initial?.email ?? ''} />
        </Field>
        <Field label="Localização" htmlFor="location">
          <Input id="location" name="location" defaultValue={initial?.location ?? ''} placeholder="Juazeiro/BA" />
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
