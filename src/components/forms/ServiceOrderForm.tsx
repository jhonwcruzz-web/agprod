'use client'

import { useRef, useState } from 'react'
import type { Route } from 'next'
import { PlusIcon, TrashIcon } from '@phosphor-icons/react/dist/ssr'
import { Field, Input, InputWithUnit, Select, Textarea } from '@/components/ui/Field'
import { FormGrid, FormPanel, type PlotOption, type VarietyOption } from './FormPanel'
import { MachinePair, PlotSelect, ProductSelect, usePlotVariety, type MachineOption, type StockProduct } from './fields'
import { saveServiceOrder } from '@/lib/actions/orders'
import { DOSE_UNITS, FERT_DOSE_UNITS, fertQuantity, parseBr, sprayQuantity, toBr } from '@/lib/calc'
import { money, num, today } from '@/lib/format'
import { CULTURAL_ACTIVITIES, FERT_METHODS, ORDER_KIND_LABEL, orderNumber, sprayMix, type OrderKind } from '@/lib/orders'
import type { Tables } from '@/lib/types/database'

const DEFAULT_DOSE_UNIT: Record<string, string> = { L: 'L/ha', mL: 'mL/ha', kg: 'kg/ha', g: 'g/ha' }

export type OrderLine = { product_id: string; dose: number | null; dose_unit: string | null }
type Line = { key: number; productId: string; dose: string; unit: string }


const DESCRIPTION: Record<OrderKind, string> = {
  pulverizacao:
    'Monte a calda com um ou mais produtos do estoque. Quantidades por área e por tanque saem calculadas no PDF. Ao concluir, a baixa e o custo são lançados.',
  colheita: 'O que colher, onde e para onde vai. Ao registrar a colheita feita, a ordem é concluída.',
  manutencao: 'Máquina e lista do que fazer. Ao registrar a manutenção feita, a ordem é concluída.',
  adubacao:
    'Um ou mais adubos do estoque, com dose por hectare ou por planta. A quantidade total sai calculada. Ao concluir, a baixa e o custo são lançados.',
  tratos:
    'Poda, desbrota, raleio e outros tratos: turma, diárias e valor da diária. Ao concluir, a mão de obra entra no custo do talhão.',
}

const ASSIGNEE_LABEL: Record<OrderKind, string> = {
  pulverizacao: 'Aplicador',
  adubacao: 'Operador',
  tratos: 'Encarregado da turma',
  colheita: 'Encarregado da turma',
  manutencao: 'Mecânico / oficina',
}

const INSTRUCTIONS_HINT: Record<OrderKind, string> = {
  pulverizacao: 'Começar pelas linhas 1 a 20. Não pulverizar após as 10h.',
  adubacao: 'Distribuir na projeção da copa. Irrigar logo após a aplicação.',
  tratos: 'Deixar 2 ramos por esporão. Retirar feminelas.',
  colheita: 'Colher só cachos com 16 °Brix. Caixas limpas.',
  manutencao: 'Usar óleo 15W40. Avisar se encontrar vazamento.',
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
  const hasLines = kind === 'pulverizacao' || kind === 'adubacao'
  const units: readonly string[] = kind === 'adubacao' ? FERT_DOSE_UNITS : DOSE_UNITS
  const defaultUnit = kind === 'adubacao' ? 'kg/ha' : 'L/ha'
  const pv = usePlotVariety(plots, varieties, {
    plotId: initial?.plot_id ?? defaultPlotId,
    varietyId: initial?.variety_id,
  })

  // --- calda
  // Chaves das linhas: comecam em 0 no servidor e no navegador (os ids dos
  // campos dependem delas; contador global dava ids diferentes na hidratacao).
  const nextKey = useRef(initialLines?.length || 1)
  const blankLine = (): Line => ({ key: nextKey.current++, productId: '', dose: '', unit: defaultUnit })
  const [lines, setLines] = useState<Line[]>(() =>
    initialLines?.length
      ? initialLines.map((l, i) => ({
          key: i,
          productId: l.product_id,
          dose: toBr(l.dose, 4),
          unit: l.dose_unit ?? defaultUnit,
        }))
      : [{ key: 0, productId: '', dose: '', unit: defaultUnit }],
  )
  const [areaTxt, setAreaTxt] = useState(toBr(initial?.area ?? null, 4))
  const [sprayTxt, setSprayTxt] = useState(toBr(initial?.spray_volume ?? null, 2))
  const [tankTxt, setTankTxt] = useState(toBr(initial?.tank_capacity ?? null, 0))

  const plot = plots.find((p) => p.id === pv.plotId)
  const areaHa = parseBr(areaTxt) ?? (plot ? Number(plot.area) : null)
  const sprayLha = parseBr(sprayTxt)
  const tankL = parseBr(tankTxt)
  const mix = sprayMix(areaHa, sprayLha, tankL)

  // tratos: trato da lista ou "outro" digitado; custo previsto = diarias x diaria
  const known = (CULTURAL_ACTIVITIES as readonly string[]).includes(initial?.activity ?? '')
  const [activity, setActivity] = useState(initial?.activity ? (known ? initial.activity : 'outro') : '')
  const [daysTxt, setDaysTxt] = useState(toBr(initial?.labor_days ?? null, 1))
  const [rateTxt, setRateTxt] = useState(toBr(initial?.daily_rate ?? null, 2))
  const days = parseBr(daysTxt)
  const rate = parseBr(rateTxt)

  function lineQty(l: Line, unit: string | null) {
    const dose = parseBr(l.dose)
    return kind === 'adubacao'
      ? fertQuantity({
          dose,
          doseUnit: l.unit,
          areaHa,
          plotAreaHa: plot ? Number(plot.area) : null,
          plants: plot?.plant_count ?? null,
          productUnit: unit,
        })
      : sprayQuantity({ dose, doseUnit: l.unit, areaHa, sprayLha, productUnit: unit })
  }

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }
  function chooseProduct(key: number, id: string) {
    const p = products.find((x) => x.id === id)
    setLines((ls) =>
      ls.map((l) =>
        l.key === key
          ? { ...l, productId: id, unit: !l.dose && p && units.includes(DEFAULT_DOSE_UNIT[p.unit]) ? DEFAULT_DOSE_UNIT[p.unit] : l.unit }
          : l,
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

        <Field label={ASSIGNEE_LABEL[kind]} htmlFor="assignee">
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

        {kind === 'adubacao' && (
          <>
            <MachinePair
              tractors={tractors}
              implements={impls}
              machineId={initial?.machine_id}
              implementId={initial?.implement_id}
            />
            <Field
              label="Área a adubar"
              htmlFor="area"
              hint={
                plot
                  ? `Vazio = talhão inteiro (${num(Number(plot.area), 2)} ha${plot.plant_count ? ` · ${num(plot.plant_count)} plantas` : ''}).`
                  : undefined
              }
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
            <Field label="Forma de aplicação" htmlFor="application_method">
              <Select id="application_method" name="application_method" defaultValue={initial?.application_method ?? ''}>
                <option value="">—</option>
                {FERT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}

        {kind === 'tratos' && (
          <>
            <Field label="Trato cultural" htmlFor="activity_pick" required>
              <Select id="activity_pick" value={activity} onChange={(e) => setActivity(e.target.value)} required>
                <option value="">—</option>
                {CULTURAL_ACTIVITIES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
                <option value="outro">Outro…</option>
              </Select>
            </Field>
            {activity === 'outro' ? (
              <Field label="Qual trato" htmlFor="activity" required>
                <Input id="activity" name="activity" required defaultValue={known ? '' : (initial?.activity ?? '')} placeholder="Ex.: Pinçamento" />
              </Field>
            ) : (
              <input type="hidden" name="activity" value={activity} />
            )}
            <Field label="Tamanho da turma" htmlFor="team_size">
              <InputWithUnit id="team_size" name="team_size" unit="pessoas" inputMode="numeric" defaultValue={initial?.team_size ?? ''} placeholder="6" />
            </Field>
            <Field label="Diárias previstas" htmlFor="labor_days" hint="Pessoas x dias. Ex.: 6 pessoas por 2 dias = 12.">
              <InputWithUnit
                id="labor_days"
                name="labor_days"
                unit="diárias"
                inputMode="decimal"
                value={daysTxt}
                onChange={(e) => setDaysTxt(e.target.value)}
                placeholder="12"
              />
            </Field>
            <Field
              label="Valor da diária"
              htmlFor="daily_rate"
              hint={days && rate ? `Mão de obra prevista: ${money(days * rate)}.` : undefined}
            >
              <InputWithUnit
                id="daily_rate"
                name="daily_rate"
                unit="R$"
                inputMode="decimal"
                value={rateTxt}
                onChange={(e) => setRateTxt(e.target.value)}
                placeholder="80,00"
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

      {hasLines && (
        <fieldset className="mt-6">
          <legend className="text-[13px] font-medium text-text-muted">
            {kind === 'adubacao' ? 'Adubos' : 'Produtos da calda'}
          </legend>
          <div className="mt-2 flex flex-col gap-3">
            {lines.map((l, i) => {
              const p = products.find((x) => x.id === l.productId)
              const q = lineQty(l, p?.unit ?? null)
              const perTank = kind === 'pulverizacao' && q.ok && mix.totalL && tankL ? (q.quantity * tankL) / mix.totalL : null
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
                      {units.map((u) => (
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
            <PlusIcon size={14} weight="bold" /> {kind === 'adubacao' ? 'Adicionar adubo' : 'Adicionar produto à calda'}
          </button>
        </fieldset>
      )}

      {(kind === 'manutencao' || kind === 'tratos') && (
        <div className="mt-5">
          <Field label="O que fazer" htmlFor="checklist" hint="Um item por linha — vira uma lista para marcar no PDF.">
            <Textarea
              id="checklist"
              name="checklist"
              rows={5}
              defaultValue={initial?.checklist ?? ''}
              placeholder={
                kind === 'tratos'
                  ? 'Linhas 1 a 30\nDeixar 2 brotos por esporão\nRecolher ramos das entrelinhas'
                  : 'Trocar óleo do motor\nTrocar filtro de óleo\nEngraxar articulações\nVerificar pneus'
              }
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
            placeholder={INSTRUCTIONS_HINT[kind]}
          />
        </Field>
      </div>
    </FormPanel>
  )
}
