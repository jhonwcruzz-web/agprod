'use client'

import { useState } from 'react'
import type { Route } from 'next'
import { Field, Input, InputWithUnit, Select, Textarea } from '@/components/ui/Field'
import { FormGrid, FormPanel, type PlotOption } from './FormPanel'
import {
  MachinePair,
  PlotSelect,
  ProductSelect,
  type MachineOption,
  type StockProduct,
} from './fields'
import { saveFertilization } from '@/lib/actions/records'
import { parseBr, round, stockCost, toBr } from '@/lib/calc'
import { money, num, today } from '@/lib/format'
import type { Tables } from '@/lib/types/database'

type Initial = Partial<Tables<'fertilizations'>>

export function FertilizationForm({
  plots,
  products,
  tractors,
  implements: impls,
  closeHref,
  initial,
}: {
  plots: PlotOption[]
  products: StockProduct[]
  tractors: MachineOption[]
  implements: MachineOption[]
  closeHref: Route
  initial?: Initial
}) {
  const [plotId, setPlotId] = useState(initial?.plot_id ?? '')
  const [productId, setProductId] = useState(initial?.product_id ?? '')
  const [areaTxt, setAreaTxt] = useState(toBr(initial?.area ?? null, 4))
  // Na edicao parte da dose gravada; quantidade fica calculada a partir dela.
  const [doseTxt, setDoseTxt] = useState(toBr(initial?.dose_per_ha ?? null, 4))
  const [qtyTxt, setQtyTxt] = useState(initial?.dose_per_ha ? '' : toBr(initial?.quantity ?? null, 3))

  const product = products.find((p) => p.id === productId)
  const plot = plots.find((p) => p.id === plotId)
  const areaHa = parseBr(areaTxt) ?? (plot ? Number(plot.area) : null)

  const dose = parseBr(doseTxt)
  const typedQty = parseBr(qtyTxt)
  // Dose por hectare ou quantidade total: o que faltar sai da conta.
  const qty = typedQty ?? (dose !== null && areaHa ? round(dose * areaHa, 3) : null)
  const shownDose = dose ?? (typedQty !== null && areaHa ? round(typedQty / areaHa, 4) : null)

  const autoCost = product ? stockCost(qty, product.unit_cost) : null
  const [costOverride, setCostOverride] = useState(() => {
    if (!initial?.id || initial.cost == null) return ''
    return autoCost !== null && Math.abs(Number(initial.cost) - autoCost) < 0.01
      ? ''
      : toBr(Number(initial.cost), 2)
  })
  const cost = parseBr(costOverride) ?? autoCost
  const unit = product?.unit ?? '—'
  const editing = !!initial?.id

  return (
    <FormPanel
      action={saveFertilization}
      title={editing ? 'Editar adubação' : 'Registrar adubação'}
      description="Informe a dose por hectare ou a quantidade total — o outro valor e o custo são calculados."
      closeHref={closeHref}
      submitLabel={editing ? 'Salvar alterações' : 'Registrar adubação'}
      editId={initial?.id}
    >
      <FormGrid>
        <Field label="Data" htmlFor="fertilization_date" required>
          <Input
            id="fertilization_date"
            name="fertilization_date"
            type="date"
            defaultValue={initial?.fertilization_date ?? today()}
            required
            className="num"
          />
        </Field>

        <PlotSelect plots={plots} value={plotId} onChange={setPlotId} />

        <ProductSelect products={products} value={productId} onChange={setProductId} required />

        <Field
          label="Área"
          htmlFor="area"
          hint={plot ? `Vazio = talhão inteiro (${num(Number(plot.area), 2)} ha).` : undefined}
        >
          <InputWithUnit
            id="area"
            name="area"
            unit="ha"
            inputMode="decimal"
            value={areaTxt}
            onChange={(e) => setAreaTxt(e.target.value)}
            placeholder={plot ? toBr(Number(plot.area), 2) : ''}
          />
        </Field>

        <Field label="Dose por hectare" htmlFor="dose_per_ha" hint="Ou informe a quantidade total.">
          <InputWithUnit
            id="dose_per_ha"
            name="dose_per_ha"
            unit={`${unit}/ha`}
            inputMode="decimal"
            value={doseTxt}
            onChange={(e) => {
              setDoseTxt(e.target.value)
              if (e.target.value) setQtyTxt('')
            }}
            placeholder={shownDose !== null && !dose ? toBr(shownDose, 2) : '150'}
          />
        </Field>

        <Field label="Quantidade total" htmlFor="quantity">
          <InputWithUnit
            id="quantity"
            name="quantity"
            unit={unit}
            inputMode="decimal"
            value={qtyTxt}
            onChange={(e) => {
              setQtyTxt(e.target.value)
              if (e.target.value) setDoseTxt('')
            }}
            placeholder={qty !== null && typedQty === null ? toBr(qty, 3) : ''}
          />
        </Field>

        <Field
          label="Custo"
          htmlFor="cost"
          hint={autoCost !== null ? 'Calculado pelo custo médio do estoque.' : undefined}
        >
          <InputWithUnit
            id="cost"
            name="cost"
            unit="R$"
            inputMode="decimal"
            value={costOverride}
            onChange={(e) => setCostOverride(e.target.value)}
            placeholder={autoCost !== null ? toBr(autoCost, 2) : ''}
          />
        </Field>

        <Field label="Tipo" htmlFor="fert_type">
          <Select id="fert_type" name="fert_type" defaultValue={initial?.fert_type ?? ''}>
            <option value="">—</option>
            {['Cobertura', 'Fundação', 'Foliar', 'Fertirrigação', 'Orgânico', 'Corretivo'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Forma de aplicação" htmlFor="application_method">
          <Select
            id="application_method"
            name="application_method"
            defaultValue={initial?.application_method ?? ''}
          >
            <option value="">—</option>
            {['A lanço', 'Em linha', 'Fertirrigação', 'Foliar (pulverizado)', 'Manual na cova'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <MachinePair
          tractors={tractors}
          implements={impls}
          machineId={initial?.machine_id}
          implementId={initial?.implement_id}
        />

        <Field label="Responsável" htmlFor="responsible">
          <Input id="responsible" name="responsible" defaultValue={initial?.responsible ?? ''} />
        </Field>
      </FormGrid>

      <div className="mt-5 rounded-md bg-bg-sunken px-4 py-3 text-sm">
        {product && qty !== null ? (
          <p>
            Sai do estoque{' '}
            <span className="num font-semibold">
              {num(qty, 3)} {product.unit}
            </span>{' '}
            de {product.name}
            {shownDose !== null && (
              <span className="text-text-muted">
                {' '}({num(shownDose, 2)} {product.unit}/ha)
              </span>
            )}
            {cost !== null && (
              <>
                {' '}· custo <span className="num font-semibold">{money(cost)}</span>
              </>
            )}
            {qty > product.current_stock && (
              <span className="block text-warn">
                O estoque tem só {num(product.current_stock, 2)} {product.unit} — lance a compra depois.
              </span>
            )}
          </p>
        ) : (
          <p className="text-text-muted">
            {!product ? 'Escolha o produto do estoque.' : 'Informe a dose por hectare ou a quantidade total.'}
          </p>
        )}
      </div>

      <div className="mt-5">
        <Field label="Observações" htmlFor="notes">
          <Textarea id="notes" name="notes" defaultValue={initial?.notes ?? ''} />
        </Field>
      </div>
    </FormPanel>
  )
}
