'use client'

import { useState } from 'react'
import type { Route } from 'next'
import { Field, Input, InputWithUnit, Select } from '@/components/ui/Field'
import { FormGrid, FormPanel, plotLabel, type PlotOption } from './FormPanel'
import { ProductSelect, type StockProduct } from './fields'
import type { MachineOption } from './MachineForms'
import { saveMachineLog } from '@/lib/actions/machines'
import { parseBr, stockCost, toBr } from '@/lib/calc'
import { LOG_TYPE_LABEL, meterUnit, money, num, today } from '@/lib/format'
import type { Tables } from '@/lib/types/database'

/** Manutencao e abastecimento, ligados ao estoque (diesel, oleo, pecas). */
export function MachineLogForm({
  machines,
  plots,
  products,
  closeHref,
  defaultMachineId,
  defaultType = 'preventiva',
  initial,
}: {
  machines: MachineOption[]
  plots: PlotOption[]
  products: StockProduct[]
  closeHref: Route
  defaultMachineId?: string
  defaultType?: 'preventiva' | 'corretiva' | 'revisao' | 'abastecimento'
  initial?: Partial<Tables<'machine_logs'>>
}) {
  const [type, setType] = useState<string>(initial?.log_type ?? defaultType)
  const [machineId, setMachineId] = useState(initial?.machine_id ?? defaultMachineId ?? '')
  const [productId, setProductId] = useState(initial?.product_id ?? '')
  const [litersTxt, setLitersTxt] = useState(toBr(initial?.liters ?? null, 2))
  const [qtyTxt, setQtyTxt] = useState(
    initial?.log_type === 'abastecimento' ? '' : toBr(initial?.product_quantity ?? null, 3),
  )
  const machine = machines.find((m) => m.id === machineId)
  const unit = meterUnit(machine?.meter_type)
  const tracksMeter = !!machine && machine.meter_type !== 'nenhum'
  const isFuel = type === 'abastecimento'

  const product = products.find((p) => p.id === productId)
  // Quantidade tirada do estoque: no abastecimento sao os proprios litros.
  const qty = productId ? (parseBr(qtyTxt) ?? (isFuel ? parseBr(litersTxt) : null)) : null
  const autoCost = product ? stockCost(qty, product.unit_cost) : null
  const [costOverride, setCostOverride] = useState(() => {
    if (!initial?.id || initial.cost == null) return ''
    return autoCost !== null && Math.abs(Number(initial.cost) - autoCost) < 0.01
      ? ''
      : toBr(Number(initial.cost), 2)
  })
  const cost = parseBr(costOverride) ?? autoCost
  const editing = !!initial?.id

  return (
    <FormPanel
      action={saveMachineLog}
      title={`${editing ? 'Editar' : 'Registrar'} ${isFuel ? 'abastecimento' : 'manutenção'}`}
      description="Tirou do estoque? Escolha o produto: a baixa e o custo são automáticos."
      closeHref={closeHref}
      submitLabel={editing ? 'Salvar alterações' : 'Salvar registro'}
      editId={initial?.id}
    >
      <FormGrid>
        <Field label="Máquina ou implemento" htmlFor="machine_id" required>
          <Select id="machine_id" name="machine_id" value={machineId} onChange={(e) => setMachineId(e.target.value)} required>
            <option value="">—</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="O que foi" htmlFor="log_type" required>
          <Select id="log_type" name="log_type" value={type} onChange={(e) => setType(e.target.value)} required>
            {Object.entries(LOG_TYPE_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Data" htmlFor="log_date" required>
          <Input id="log_date" name="log_date" type="date" defaultValue={initial?.log_date ?? today()} required className="num" />
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
              defaultValue={toBr(initial?.meter_reading ?? null, 1)}
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
              value={litersTxt}
              onChange={(e) => setLitersTxt(e.target.value)}
              placeholder="80"
            />
          </Field>
        ) : (
          <Field label="O que foi feito" htmlFor="description" required className="sm:col-span-2">
            <Input
              id="description"
              name="description"
              required
              defaultValue={initial?.description ?? ''}
              placeholder={type === 'corretiva' ? 'Troca da bomba hidráulica' : 'Troca de óleo e filtros'}
            />
          </Field>
        )}

        <ProductSelect
          products={products}
          value={productId}
          onChange={setProductId}
          label={isFuel ? 'Combustível do estoque' : 'Peça ou óleo do estoque'}
          emptyLabel={isFuel ? 'Abasteceu fora (posto)' : 'Nada do estoque'}
        />

        {productId && !isFuel && (
          <Field label="Quantidade usada" htmlFor="product_quantity" required>
            <InputWithUnit
              id="product_quantity"
              name="product_quantity"
              unit={product?.unit ?? '—'}
              inputMode="decimal"
              required
              value={qtyTxt}
              onChange={(e) => setQtyTxt(e.target.value)}
            />
          </Field>
        )}

        <Field
          label="Valor"
          htmlFor="cost"
          hint={autoCost !== null ? 'Calculado pelo custo médio do estoque.' : 'Valor pago (mão de obra, peças de fora).'}
        >
          <InputWithUnit
            id="cost"
            name="cost"
            unit="R$"
            inputMode="decimal"
            value={costOverride}
            onChange={(e) => setCostOverride(e.target.value)}
            placeholder={autoCost !== null ? toBr(autoCost, 2) : '0,00'}
          />
        </Field>

        <Field label={isFuel ? 'Posto' : 'Oficina / fornecedor'} htmlFor="supplier">
          <Input id="supplier" name="supplier" defaultValue={initial?.supplier ?? ''} />
        </Field>

        {!isFuel && (
          <>
            <Field label="Próxima manutenção" htmlFor="next_due_date" hint="Por data…">
              <Input id="next_due_date" name="next_due_date" type="date" defaultValue={initial?.next_due_date ?? ''} className="num" />
            </Field>
            {tracksMeter && (
              <Field label="…ou pelo uso" htmlFor="next_due_meter" hint="O que vencer primeiro.">
                <InputWithUnit
                  id="next_due_meter"
                  name="next_due_meter"
                  unit={unit}
                  inputMode="decimal"
                  defaultValue={toBr(initial?.next_due_meter ?? null, 1)}
                  key={`n-${machineId}`}
                />
              </Field>
            )}
          </>
        )}

        <Field label="Talhão" htmlFor="plot_id" hint="Só se o custo for de um talhão específico.">
          <Select id="plot_id" name="plot_id" defaultValue={initial?.plot_id ?? ''}>
            <option value="">Custo geral</option>
            {plots.map((p) => (
              <option key={p.id} value={p.id}>
                {plotLabel(p)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Responsável" htmlFor="responsible">
          <Input id="responsible" name="responsible" defaultValue={initial?.responsible ?? ''} />
        </Field>
      </FormGrid>

      {product && qty !== null && (
        <p className="mt-5 rounded-md bg-bg-sunken px-4 py-3 text-sm">
          Sai do estoque <span className="num font-semibold">{num(qty, 3)} {product.unit}</span> de {product.name}
          {cost !== null && (
            <>
              {' '}· <span className="num font-semibold">{money(cost)}</span>
            </>
          )}
        </p>
      )}
    </FormPanel>
  )
}
