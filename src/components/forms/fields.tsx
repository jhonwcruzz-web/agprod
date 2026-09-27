'use client'

import { useState } from 'react'
import { Field, Select } from '@/components/ui/Field'
import { money, num } from '@/lib/format'
import { plotLabel, type PlotOption, type VarietyOption } from './FormPanel'

/* Pecas reaproveitadas pelos formularios de lancamento. */

export type MachineOption = { id: string; name: string; kind: string | null }
export type StockProduct = {
  id: string
  name: string
  unit: string
  unit_cost: number
  current_stock: number
  active_ingredient: string | null
  category: string
}

/**
 * Talhao e variedade ligados: ao escolher o talhao, a variedade cadastrada
 * nele vem preenchida, e a lista mostra so' variedades da cultura dele.
 */
export function usePlotVariety(
  plots: PlotOption[],
  varieties: VarietyOption[],
  initial?: { plotId?: string | null; varietyId?: string | null },
) {
  const [plotId, setPlotId] = useState(initial?.plotId ?? '')
  const [varietyId, setVarietyId] = useState(initial?.varietyId ?? '')
  const plot = plots.find((p) => p.id === plotId)

  const list = plot?.crop_id
    ? varieties.filter((v) => v.crop_id === plot.crop_id || v.id === varietyId)
    : varieties

  function selectPlot(id: string) {
    setPlotId(id)
    setVarietyId(plots.find((p) => p.id === id)?.variety_id ?? '')
  }

  const fromPlot = !!plot?.variety_id && plot.variety_id === varietyId
  const hint = !plot
    ? 'Vem do cadastro do talhão.'
    : !plot.variety_id
      ? 'Este talhão não tem variedade cadastrada.'
      : fromPlot
        ? 'Preenchida pelo cadastro do talhão.'
        : 'Diferente da cadastrada no talhão.'

  return { plotId, plot, selectPlot, varietyId, setVarietyId, list, hint }
}

export function PlotSelect({
  plots,
  value,
  onChange,
  required,
  label = 'Talhão',
  emptyLabel = '—',
}: {
  plots: PlotOption[]
  value: string
  onChange: (id: string) => void
  required?: boolean
  label?: string
  emptyLabel?: string
}) {
  return (
    <Field label={label} htmlFor="plot_id" required={required}>
      <Select
        id="plot_id"
        name="plot_id"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {plots.map((p) => (
          <option key={p.id} value={p.id}>
            {plotLabel(p)}
          </option>
        ))}
      </Select>
    </Field>
  )
}

/** Produto do estoque, agrupado por categoria, com saldo e custo medio. */
export function ProductSelect({
  products,
  value,
  onChange,
  label = 'Produto do estoque',
  required,
  emptyLabel = '—',
}: {
  products: StockProduct[]
  value: string
  onChange: (id: string) => void
  label?: string
  required?: boolean
  emptyLabel?: string
}) {
  const groups = new Map<string, StockProduct[]>()
  for (const p of products) {
    const k = p.category || 'Outros'
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(p)
  }
  const selected = products.find((p) => p.id === value)

  return (
    <Field
      label={label}
      htmlFor="product_id"
      required={required}
      hint={
        selected
          ? `Saldo ${num(selected.current_stock, 2)} ${selected.unit} · custo médio ${money(selected.unit_cost)}/${selected.unit}`
          : products.length === 0
            ? 'Cadastre produtos em Estoque.'
            : undefined
      }
    >
      <Select
        id="product_id"
        name="product_id"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {[...groups.entries()].map(([cat, list]) => (
          <optgroup key={cat} label={cat}>
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </Field>
  )
}

/** Trator e implemento usados, das maquinas cadastradas. */
export function MachinePair({
  tractors,
  implements: impls,
  machineId,
  implementId,
}: {
  tractors: MachineOption[]
  implements: MachineOption[]
  machineId?: string | null
  implementId?: string | null
}) {
  return (
    <>
      <Field label="Trator / máquina" htmlFor="machine_id" hint={tractors.length === 0 ? 'Cadastre em Máquinas.' : undefined}>
        <Select id="machine_id" name="machine_id" defaultValue={machineId ?? ''}>
          <option value="">—</option>
          {tractors.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Implemento" htmlFor="implement_id">
        <Select id="implement_id" name="implement_id" defaultValue={implementId ?? ''}>
          <option value="">—</option>
          {impls.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.kind ? ` (${m.kind})` : ''}
            </option>
          ))}
        </Select>
      </Field>
    </>
  )
}

/**
 * Campo calculado que o produtor pode sobrescrever.
 *
 * Mostra o valor calculado como sugestao (placeholder) e envia vazio
 * enquanto ninguem digitou — o servidor refaz a mesma conta. Se o produtor
 * digitar, vale o que ele digitou.
 */
export function useOverridable(initial?: string) {
  const [value, setValue] = useState(initial ?? '')
  return { value, setValue, touched: value.trim() !== '' }
}
