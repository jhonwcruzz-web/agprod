'use client'

import { useRef, useState } from 'react'
import type { Route } from 'next'
import { PlusIcon, TrashIcon } from '@phosphor-icons/react/dist/ssr'
import { Field, Input, InputWithUnit, Select, Textarea } from '@/components/ui/Field'
import { FormGrid, FormPanel, type PlotOption, type VarietyOption } from './FormPanel'
import { MachinePair, PlotSelect, ProductSelect, usePlotVariety, type MachineOption, type StockProduct } from './fields'
import { saveServiceOrder } from '@/lib/actions/orders'
import { DOSE_UNITS, parseBr, sprayQuantity, toBr } from '@/lib/calc'
import { num, today } from '@/lib/format'
import { ORDER_KIND_LABEL, orderNumber, sprayMix, type OrderKind } from '@/lib/orders'
import type { Tables } from '@/lib/types/database'

const DEFAULT_DOSE_UNIT: Record<string, string> = { L: 'L/ha', mL: 'mL/ha', kg: 'kg/ha', g: 'g/ha' }

export type OrderLine = { product_id: string; dose: number | null; dose_unit: string | null }
type Line = { key: number; productId: string; dose: string; unit: string }


const DESCRIPTION: Record<OrderKind, string> = {
  pulverizacao:
    'Monte a calda com um ou mais produtos do estoque. Quantidades por área e por tanque saem calculadas no PDF. Ao concluir, a baixa e o custo são lançados.',
  colheita: 'O que colher, onde e para onde vai. Ao registrar a colheita feita, a ordem é concluída.',
  manutencao: 'Máquina e lista do que fazer. Ao registrar a manutenção feita, a ordem é concluída.',
}

export function ServiceOrderForm({
  kind,
  plots,
  varieties,
  products,
  tractors,
  implements: impls,
  machines,
  destinations,
  closeHref,
  initial,
  lines: initialLines,
  defaultPlotId,
  defaultMachineId,
}: {
  kind: OrderKind
  plots: PlotOption[]
  varieties: VarietyOption[]
  products: StockProduct[]
  tractors: MachineOption[]
  implements: MachineOption[]
  machines: (MachineOption & { class: string })[]
  destinations: { id: string; name: string }[]
  closeHref: Route
  initial?: Partial<Tables<'service_orders'>>
  lines?: OrderLine[]
  defaultPlotId?: string
  defaultMachineId?: string
}) {
  const editing = !!initial?.id
  const pv = usePlotVariety(plots, varieties, {
    plotId: initial?.plot_id ?? defaultPlotId,
    varietyId: initial?.variety_id,
  })

  // --- calda
  // Chaves das linhas: comecam em 0 no servidor e no navegador (os ids dos
  // campos dependem delas; contador global dava ids diferentes na hidratacao).
  const nextKey = useRef(initialLines?.length || 1)
  const blankLine = (): Line => ({ key: nextKey.current++, productId: '', dose: '', unit: 'L/ha' })
  const [lines, setLines] = useState<Line[]>(() =>
    initialLines?.length
      ? initialLines.map((l, i) => ({
          key: i,
          productId: l.product_id,
          dose: toBr(l.dose, 4),
          unit: l.dose_unit ?? 'L/ha',
        }))
      : [{ key: 0, productId: '', dose: '', unit: 'L/ha' }],
  )
  const [areaTxt, setAreaTxt] = useState(toBr(initial?.area ?? null, 4))
  const [sprayTxt, setSprayTxt] = useState(toBr(initial?.spray_volume ?? null, 2))
  const [tankTxt, setTankTxt] = useState(toBr(initial?.tank_capacity ?? null, 0))

  const plot = plots.find((p) => p.id === pv.plotId)
  const areaHa = parseBr(areaTxt) ?? (plot ? Number(plot.area) : null)
  const sprayLha = parseBr(sprayTxt)
  const tankL = parseBr(tankTxt)
  const mix = sprayMix(areaHa, sprayLha, tankL)

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }
  function chooseProduct(key: number, id: string) {
    const p = products.find((x) => x.id === id)
    setLines((ls) =>
      ls.map((l) =>
        l.key === key ? { ...l, productId: id, unit: !l.dose && p && DEFAULT_DOSE_UNIT[p.unit] ? DEFAULT_DOSE_UNIT[p.unit] : l.unit } : l,
      ),
    )
  }

  const title = editing
    ? `Editar OS ${orderNumber(initial?.number ?? 0)} — ${ORDER_KIND_LABEL[kind]}`
    : `Nova ordem de serviço — ${ORDER_KIND_LABEL[kind]}`

  return (
    <FormPanel
      action={saveServiceOrder}
      title={title}
      description={DESCRIPTION[kind]}
      closeHref={closeHref}
      submitLabel={editing ? 'Salvar alterações' : 'Criar ordem de serviço'}
      editId={initial?.id}
    >
      <input type="hidden" name="kind" value={kind} />
      <FormGrid>
        <Field label="Data prevista" htmlFor="scheduled_date" required>
          <Input
            id="scheduled_date"
            name="scheduled_date"
            type="date"
            required
            defaultValue={initial?.scheduled_date ?? today()}
            className="num"
          />
        </Field>

        {kind === 'manutencao' ? (
          <Field label="Máquina" htmlFor="machine_id" required>
            <Select id="machine_id" name="machine_id" required defaultValue={initial?.machine_id ?? defaultMachineId ?? ''}>
              <option value="">—</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.class === 'implemento' ? ' (implemento)' : ''}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <PlotSelect plots={plots} value={pv.plotId} onChange={pv.selectPlot} required />
        )}

        <Field label={kind === 'manutencao' ? 'Mecânico / oficina' : kind === 'colheita' ? 'Encarregado da turma' : 'Aplicador'} htmlFor="assignee">
          <Input id="assignee" name="assignee" defaultValue={initial?.assignee ?? ''} placeholder="Nome de quem executa" />
        </Field>

        <Field label="WhatsApp de quem executa" htmlFor="assignee_phone" hint="Com DDD. Usado no botão Enviar.">
          <Input
            id="assignee_phone"
            name="assignee_phone"
            type="tel"
            inputMode="tel"
            defaultValue={initial?.assignee_phone ?? ''}
            placeholder="(87) 99999-9999"
            className="num"
          />
        </Field>

        {kind === 'pulverizacao' && (
          <>
            <MachinePair
              tractors={tractors}
              implements={impls}
              machineId={initial?.machine_id}
              implementId={initial?.implement_id}
            />
            <Field
              label="Área a pulverizar"
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
            <Field label="Volume de calda" htmlFor="spray_volume" hint="Necessário para dose por 100 L e para contar os tanques.">
              <InputWithUnit
                id="spray_volume"
                name="spray_volume"
                unit="L/ha"
                inputMode="decimal"
                value={sprayTxt}
                onChange={(e) => setSprayTxt(e.target.value)}
                placeholder="1000"
              />
            </Field>
            <Field
              label="Capacidade do tanque"
              htmlFor="tank_capacity"
              hint={
                mix.totalL
                  ? `Calda total ${num(mix.totalL)} L${mix.tanks ? ` · ${mix.tanksRounded} tanque(s)` : ''}.`
                  : 'Com ela o PDF mostra quanto vai em cada tanque.'
              }
            >
              <InputWithUnit
                id="tank_capacity"
                name="tank_capacity"
                unit="L"
                inputMode="decimal"
                value={tankTxt}
                onChange={(e) => setTankTxt(e.target.value)}
                placeholder="2000"
              />
            </Field>
          </>
        )}

        {kind === 'colheita' && (
          <>
            <Field label="Variedade" htmlFor="variety_id" hint={pv.hint}>
              <Select id="variety_id" name="variety_id" value={pv.varietyId} onChange={(e) => pv.setVarietyId(e.target.value)}>
                <option value="">—</option>
                {pv.list.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Quantidade prevista" htmlFor="expected_quantity">
              <div className="flex gap-2">
                <Input
                  id="expected_quantity"
                  name="expected_quantity"
                  inputMode="decimal"
                  defaultValue={toBr(initial?.expected_quantity ?? null, 3)}
                  placeholder="500"
                  className="num min-w-0 flex-1"
                />
                <Select name="expected_unit" aria-label="Unidade" defaultValue={initial?.expected_unit ?? 'caixa'} className="w-28">
                  <option value="caixa">caixas</option>
                  <option value="kg">kg</option>
                  <option value="t">t</option>
                </Select>
              </div>
            </Field>
            <Field label="Destino" htmlFor="destination">
              <Select id="destination" name="destination" defaultValue={initial?.destination ?? ''}>
                <option value="">—</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tamanho da turma" htmlFor="team_size">
              <InputWithUnit
                id="team_size"
                name="team_size"
                unit="pessoas"
                inputMode="numeric"
                defaultValue={initial?.team_size ?? ''}
                placeholder="8"
              />
            </Field>
          </>
        )}

        {kind === 'manutencao' && (
          <>
            <Field label="Tipo de serviço" htmlFor="log_type">
              <Select id="log_type" name="log_type" defaultValue={initial?.log_type ?? 'preventiva'}>
                <option value="preventiva">Preventiva</option>
                <option value="corretiva">Corretiva</option>
                <option value="revisao">Revisão</option>
              </Select>
            </Field>
            <PlotSelect plots={plots} value={pv.plotId} onChange={pv.selectPlot} label="Talhão (opcional)" />
          </>
        )}
      </FormGrid>

      {kind === 'pulverizacao' && (
        <fieldset className="mt-6">
          <legend className="text-[13px] font-medium text-text-muted">Produtos da calda</legend>
          <div className="mt-2 flex flex-col gap-3">
            {lines.map((l, i) => {
              const p = products.find((x) => x.id === l.productId)
              const q = sprayQuantity({ dose: parseBr(l.dose), doseUnit: l.unit, areaHa, sprayLha, productUnit: p?.unit ?? null })
              const perTank = q.ok && mix.totalL && tankL ? (q.quantity * tankL) / mix.totalL : null
              return (
                <div key={l.key} className="grid gap-3 rounded-md border border-line p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                  <ProductSelect
                    products={products}
                    value={l.productId}
                    onChange={(id) => chooseProduct(l.key, id)}
                    name="line_product_id"
                    id={`line_product_${l.key}`}
                    label={`Produto ${i + 1}`}
                  />
                  <Field label="Dose" htmlFor={`line_dose_${l.key}`}>
                    <Input
                      id={`line_dose_${l.key}`}
                      name="line_dose"
                      inputMode="decimal"
                      value={l.dose}
                      onChange={(e) => updateLine(l.key, { dose: e.target.value })}
                      placeholder="2,5"
                      className="num"
                    />
                  </Field>
                  <Field label="Unidade" htmlFor={`line_unit_${l.key}`}>
                    <Select
                      id={`line_unit_${l.key}`}
                      name="line_dose_unit"
                      value={l.unit}
                      onChange={(e) => updateLine(l.key, { unit: e.target.value })}
                    >
                      {DOSE_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <button
                    type="button"
                    onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [blankLine()]))}
                    aria-label={`Remover produto ${i + 1}`}
                    className="press mb-0.5 flex h-10 items-center justify-center rounded-md px-2 text-text-muted hover:bg-danger-soft hover:text-danger"
                  >
                    <TrashIcon size={16} />
                  </button>
                  {p && (
                    <p className="text-xs text-text-faint sm:col-span-4">
                      {q.ok
                        ? `Total na área: ${num(q.quantity, 2)} ${p.unit}${perTank !== null ? ` · por tanque cheio: ${num(perTank, 2)} ${p.unit}` : ''} · saldo ${num(p.current_stock, 2)} ${p.unit}`
                        : l.dose
                          ? q.reason
                          : `Saldo ${num(p.current_stock, 2)} ${p.unit}`}
                      {q.ok && q.quantity > p.current_stock && (
                        <span className="ml-1 font-medium text-warn">— estoque insuficiente</span>
                      )}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => setLines((ls) => [...ls, blankLine()])}
            className="press mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-line-strong px-3 py-2 text-sm text-text-muted hover:border-accent hover:text-accent-text"
          >
            <PlusIcon size={14} weight="bold" /> Adicionar produto à calda
          </button>
        </fieldset>
      )}

      {kind === 'manutencao' && (
        <div className="mt-5">
          <Field label="O que fazer" htmlFor="checklist" hint="Um item por linha — vira uma lista para marcar no PDF.">
            <Textarea
              id="checklist"
              name="checklist"
              rows={5}
              defaultValue={initial?.checklist ?? ''}
              placeholder={'Trocar óleo do motor\nTrocar filtro de óleo\nEngraxar articulações\nVerificar pneus'}
            />
          </Field>
        </div>
      )}

      <div className="mt-5">
        <Field label="Instruções para quem executa" htmlFor="instructions">
          <Textarea
            id="instructions"
            name="instructions"
            rows={3}
            defaultValue={initial?.instructions ?? ''}
            placeholder={
              kind === 'pulverizacao'
                ? 'Começar pelas linhas 1 a 20. Não pulverizar após as 10h.'
                : kind === 'colheita'
                  ? 'Colher só cachos com 16 °Brix. Caixas limpas.'
                  : 'Usar óleo 15W40. Avisar se encontrar vazamento.'
            }
          />
        </Field>
      </div>
    </FormPanel>
  )
}
