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
import { saveSpray } from '@/lib/actions/records'
import { DOSE_UNITS, parseBr, sprayQuantity, stockCost, toBr } from '@/lib/calc'
import { money, num, today } from '@/lib/format'
import type { Tables } from '@/lib/types/database'

/** Unidade de dose mais provavel para a unidade do produto. */
const DEFAULT_DOSE_UNIT: Record<string, string> = { L: 'L/ha', mL: 'mL/ha', kg: 'kg/ha', g: 'g/ha' }

type Initial = Partial<Tables<'applications'>>

export function SprayForm({
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
  const [status, setStatus] = useState<string>(initial?.status ?? 'realizada')
  const [plotId, setPlotId] = useState(initial?.plot_id ?? '')
  const [productId, setProductId] = useState(initial?.product_id ?? '')
  const [dose, setDose] = useState(toBr(initial?.dose ?? null, 4))
  const [doseUnit, setDoseUnit] = useState(initial?.dose_unit ?? 'L/ha')
  const [areaTxt, setAreaTxt] = useState(toBr(initial?.area ?? null, 4))
  const [spray, setSpray] = useState(toBr(initial?.spray_volume ?? null, 2))

  const product = products.find((p) => p.id === productId)
  const plot = plots.find((p) => p.id === plotId)
  // Area em branco = talhao inteiro (o servidor faz o mesmo).
  const areaHa = parseBr(areaTxt) ?? (plot ? Number(plot.area) : null)

  const calc = sprayQuantity({
    dose: parseBr(dose),
    doseUnit,
    areaHa,
    sprayLha: parseBr(spray),
    productUnit: product?.unit ?? null,
  })
  const autoQty = calc.ok ? calc.quantity : null

  // Na edicao, valores gravados iguais ao calculo continuam "automaticos";
  // diferentes sao ajustes do produtor e ficam como estao.
  const [qtyOverride, setQtyOverride] = useState(() => {
    if (initial?.total_quantity == null) return ''
    return autoQty !== null && Math.abs(Number(initial.total_quantity) - autoQty) < 0.001
      ? ''
      : toBr(Number(initial.total_quantity), 3)
  })
  const qty = parseBr(qtyOverride) ?? autoQty
  const autoCost = product ? stockCost(qty, product.unit_cost) : null
  const [costOverride, setCostOverride] = useState(() => {
    if (initial?.cost == null || !initial.id) return ''
    return autoCost !== null && Math.abs(Number(initial.cost) - autoCost) < 0.01
      ? ''
      : toBr(Number(initial.cost), 2)
  })
  const cost = parseBr(costOverride) ?? autoCost

  function chooseProduct(id: string) {
    setProductId(id)
    const p = products.find((x) => x.id === id)
    if (p && DEFAULT_DOSE_UNIT[p.unit] && !dose) setDoseUnit(DEFAULT_DOSE_UNIT[p.unit])
  }

  const editing = !!initial?.id

  return (
    <FormPanel
      action={saveSpray}
      title={editing ? 'Editar pulverização' : 'Registrar pulverização'}
      description="Escolha o produto e informe a dose: a quantidade gasta e o custo saem do estoque sozinhos."
      closeHref={closeHref}
      submitLabel={editing ? 'Salvar alterações' : 'Registrar pulverização'}
      editId={initial?.id}
    >
      <FormGrid>
        <Field label="Situação" htmlFor="status">
          <Select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="realizada">Realizada</option>
            <option value="programada">Programada</option>
            <option value="pendente">Pendente</option>
          </Select>
        </Field>

        {status === 'programada' ? (
          <Field label="Data prevista" htmlFor="scheduled_date" required>
            <Input
              id="scheduled_date"
              name="scheduled_date"
              type="date"
              defaultValue={initial?.scheduled_date ?? today()}
              required
              className="num"
            />
          </Field>
        ) : (
          <Field label="Data da pulverização" htmlFor="application_date" required>
            <Input
              id="application_date"
              name="application_date"
              type="date"
              defaultValue={initial?.application_date ?? today()}
              required
              className="num"
            />
          </Field>
        )}

        <PlotSelect plots={plots} value={plotId} onChange={setPlotId} />

        <ProductSelect products={products} value={productId} onChange={chooseProduct} required />

        <Field label="Dose" htmlFor="dose" required>
          <Input
            id="dose"
            name="dose"
            inputMode="decimal"
            required
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            placeholder="2,5"
            className="num"
          />
        </Field>

        <Field label="Unidade da dose" htmlFor="dose_unit">
          <Select id="dose_unit" name="dose_unit" value={doseUnit} onChange={(e) => setDoseUnit(e.target.value)}>
            {DOSE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Área aplicada"
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

        <Field
          label="Volume de calda"
          htmlFor="spray_volume"
          hint={doseUnit.endsWith('/100L') ? 'Obrigatório para dose por 100 L.' : 'Opcional.'}
        >
          <InputWithUnit
            id="spray_volume"
            name="spray_volume"
            unit="L/ha"
            inputMode="decimal"
            value={spray}
            onChange={(e) => setSpray(e.target.value)}
            placeholder="1000"
          />
        </Field>

        <Field
          label="Quantidade gasta"
          htmlFor="total_quantity"
          hint={autoQty !== null ? 'Calculada — digite só para corrigir.' : undefined}
        >
          <InputWithUnit
            id="total_quantity"
            name="total_quantity"
            unit={product?.unit ?? '—'}
            inputMode="decimal"
            value={qtyOverride}
            onChange={(e) => setQtyOverride(e.target.value)}
            placeholder={autoQty !== null ? toBr(autoQty, 3) : ''}
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

      {/* Resumo do calculo: o produtor confere antes de salvar. */}
      <div className="mt-5 rounded-md bg-bg-sunken px-4 py-3 text-sm">
        {product && qty !== null ? (
          <p>
            Sai do estoque{' '}
            <span className="num font-semibold">
              {num(qty, 3)} {product.unit}
            </span>{' '}
            de {product.name}
            {cost !== null && (
              <>
                {' '}· custo <span className="num font-semibold">{money(cost)}</span>
                <span className="text-text-muted"> ({money(product.unit_cost)}/{product.unit})</span>
              </>
            )}
            {status !== 'realizada' && (
              <span className="text-text-muted"> — a baixa acontece quando for marcada como feita.</span>
            )}
            {status === 'realizada' && qty > product.current_stock && (
              <span className="block text-warn">
                O estoque tem só {num(product.current_stock, 2)} {product.unit} — lance a compra depois.
              </span>
            )}
          </p>
        ) : (
          <p className="text-text-muted">
            {calc.ok ? 'Escolha o produto do estoque.' : calc.reason}
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
