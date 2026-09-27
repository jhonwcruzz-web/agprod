'use client'

import { useState } from 'react'
import type { Route } from 'next'
import { Field, Input, InputWithUnit, Select, Textarea } from '@/components/ui/Field'
import { FormGrid, FormPanel, type Option, type PlotOption, type VarietyOption } from './FormPanel'
import { PlotSelect, usePlotVariety } from './fields'
import { saveSale } from '@/lib/actions/records'
import { parseBr, round, toBr } from '@/lib/calc'
import { money, num, today } from '@/lib/format'
import type { Tables } from '@/lib/types/database'

const MASS: Record<string, number> = { kg: 1, t: 1000, g: 0.001 }
const SALE_UNITS = ['kg', 'caixa', 't'] as const

export function SaleForm({
  plots,
  buyers,
  varieties,
  closeHref,
  initial,
}: {
  plots: PlotOption[]
  buyers: Option[]
  varieties: VarietyOption[]
  closeHref: Route
  initial?: Partial<Tables<'sales'>>
}) {
  const [unit, setUnit] = useState<string>(initial?.unit ?? 'kg')
  const [qtyTxt, setQtyTxt] = useState(toBr(initial?.quantity ?? null, 3))
  const [weightTxt, setWeightTxt] = useState(toBr(initial?.unit_weight_kg ?? null, 3))
  const [priceTxt, setPriceTxt] = useState(toBr(initial?.price_per_kg ?? null, 4))
  const [received, setReceived] = useState(
    initial?.status === 'pago' ? 'sim' : initial?.status === 'parcial' ? 'parcial' : 'nao',
  )
  const pv = usePlotVariety(plots, varieties, { plotId: initial?.plot_id, varietyId: initial?.variety_id })

  const needsWeight = !(unit in MASS)
  const qty = parseBr(qtyTxt)
  const kgTotal = qty === null ? null : unit in MASS ? qty * MASS[unit] : qty * (parseBr(weightTxt) ?? 0)
  const price = parseBr(priceTxt)
  const autoTotal = kgTotal !== null && price !== null ? round(kgTotal * price, 2) : null

  // Na edicao, total gravado igual a quantidade x preco continua automatico.
  const [totalOverride, setTotalOverride] = useState(() => {
    if (!initial?.id || initial.total_amount == null) return ''
    return autoTotal !== null && Math.abs(Number(initial.total_amount) - autoTotal) < 0.01
      ? ''
      : toBr(Number(initial.total_amount), 2)
  })
  const total = parseBr(totalOverride) ?? autoTotal
  const editing = !!initial?.id

  return (
    <FormPanel
      action={saveSale}
      title={editing ? 'Editar venda' : 'Registrar venda'}
      description="Quanto vendeu, para quem e por quanto. O total e o a receber saem sozinhos."
      closeHref={closeHref}
      submitLabel={editing ? 'Salvar alterações' : 'Registrar venda'}
      editId={initial?.id}
    >
      <FormGrid>
        <Field label="Data" htmlFor="sale_date" required>
          <Input
            id="sale_date"
            name="sale_date"
            type="date"
            defaultValue={initial?.sale_date ?? today()}
            required
            className="num"
          />
        </Field>

        <Field label="Comprador" htmlFor="buyer_id" required>
          <Select id="buyer_id" name="buyer_id" required defaultValue={initial?.buyer_id ?? ''}>
            <option value="">—</option>
            {buyers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
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
            value={qtyTxt}
            onChange={(e) => setQtyTxt(e.target.value)}
            placeholder="800"
            className="num"
          />
        </Field>

        <Field label="Unidade" htmlFor="unit">
          <Select id="unit" name="unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {SALE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>

        {needsWeight && (
          <Field label={`Peso de cada ${unit}`} htmlFor="unit_weight_kg" required>
            <InputWithUnit
              id="unit_weight_kg"
              name="unit_weight_kg"
              unit="kg"
              inputMode="decimal"
              required
              value={weightTxt}
              onChange={(e) => setWeightTxt(e.target.value)}
              placeholder="8,5"
            />
          </Field>
        )}

        <Field label="Preço por kg" htmlFor="price_per_kg" required>
          <InputWithUnit
            id="price_per_kg"
            name="price_per_kg"
            unit="R$"
            inputMode="decimal"
            value={priceTxt}
            onChange={(e) => setPriceTxt(e.target.value)}
            placeholder="6,20"
          />
        </Field>

        <Field
          label="Valor total"
          htmlFor="total_amount"
          hint={autoTotal !== null ? 'Calculado — digite só para corrigir.' : undefined}
        >
          <InputWithUnit
            id="total_amount"
            name="total_amount"
            unit="R$"
            inputMode="decimal"
            value={totalOverride}
            onChange={(e) => setTotalOverride(e.target.value)}
            placeholder={autoTotal !== null ? toBr(autoTotal, 2) : ''}
          />
        </Field>

        <PlotSelect plots={plots} value={pv.plotId} onChange={pv.selectPlot} label="Talhão de origem" />

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

        <Field label="Forma de pagamento" htmlFor="payment_method">
          <Select id="payment_method" name="payment_method" defaultValue={initial?.payment_method ?? ''}>
            <option value="">—</option>
            {['Pix', 'Dinheiro', 'Transferência', 'Cheque', 'Boleto', 'Prazo'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Já recebeu?" htmlFor="recebeu">
          <Select id="recebeu" value={received} onChange={(e) => setReceived(e.target.value)}>
            <option value="nao">Ainda não</option>
            <option value="sim">Sim, recebi tudo</option>
            <option value="parcial">Recebi em parte</option>
          </Select>
        </Field>

        {received === 'parcial' && (
          <Field label="Valor recebido" htmlFor="received_amount">
            <InputWithUnit
              id="received_amount"
              name="received_amount"
              unit="R$"
              inputMode="decimal"
              defaultValue={toBr(initial?.received_amount ?? null, 2)}
            />
          </Field>
        )}

        {received !== 'sim' && (
          <Field label="Vencimento" htmlFor="due_date">
            <Input id="due_date" name="due_date" type="date" defaultValue={initial?.due_date ?? ''} className="num" />
          </Field>
        )}

        {received === 'sim' && (
          <>
            {/* O servidor iguala o recebido ao total calculado da venda. */}
            <input type="hidden" name="received_full" value="on" />
            <input type="hidden" name="received_date" value={initial?.received_date ?? today()} />
          </>
        )}
      </FormGrid>

      <div className="mt-5 rounded-md bg-bg-sunken px-4 py-3 text-sm">
        {kgTotal !== null && total !== null ? (
          <p>
            <span className="num font-semibold">{num(kgTotal, 1)} kg</span> ·{' '}
            <span className="num font-semibold">{money(total)}</span>
            {received === 'nao' && <span className="text-text-muted"> — entra em &ldquo;A receber&rdquo;.</span>}
          </p>
        ) : (
          <p className="text-text-muted">Informe quantidade e preço para ver o total.</p>
        )}
      </div>

      <div className="mt-5">
        <Field label="Observações" htmlFor="sale_notes">
          <Textarea id="sale_notes" name="notes" defaultValue={initial?.notes ?? ''} />
        </Field>
      </div>
    </FormPanel>
  )
}
