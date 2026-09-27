'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { ArrowDownIcon, CheckCircleIcon, WarningIcon } from '@phosphor-icons/react/dist/ssr'
import { Field, InputWithUnit, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { saveForecast } from '@/lib/actions/forecast'
import type { ActionState } from '@/lib/actions/shared'
import { parseBr, toBr } from '@/lib/calc'
import { num } from '@/lib/format'
import { simulate, SIM_DEFAULTS, type PruneOption, type SimInput } from '@/lib/simulator'

export type SimPlot = {
  id: string
  code: string
  name: string | null
  area: number
  row_spacing: number | null
  plant_spacing: number | null
  plant_count: number | null
  variety: string | null
}

type Key = keyof SimInput
type Texts = Record<Key, string>

const STORAGE = 'agprod-simulador'

const toTexts = (i: SimInput): Texts =>
  Object.fromEntries(Object.entries(i).map(([k, v]) => [k, toBr(v, 2).replace(/,00$/, '')])) as Texts

/** Campos, na ordem da conversa com o produtor, com a explicacao do consultor. */
const GROUPS: { title: string; fields: { key: Key; label: string; unit: string; hint: string }[] }[] = [
  {
    title: 'O que você quer colher',
    fields: [
      { key: 'targetTHa', label: 'Meta de produção comercial', unit: 't/ha', hint: 'O que você quer vender por hectare, já embalado.' },
      { key: 'lossPct', label: 'Perdas na colheita e no packing', unit: '%', hint: 'Descarte de cacho, podridão, baga rachada. 10% é uma referência comum.' },
    ],
  },
  {
    title: 'Plantio',
    fields: [
      { key: 'rowSpacingM', label: 'Espaçamento entre linhas', unit: 'm', hint: 'Latada no Vale costuma ficar entre 2,5 e 4 m.' },
      { key: 'plantSpacingM', label: 'Espaçamento entre plantas', unit: 'm', hint: 'Distância entre uma planta e outra na linha.' },
      { key: 'armsPerPlant', label: 'Saídas (braços) por planta', unit: 'saídas', hint: 'Braços ou cordões que saem do tronco e carregam as varas.' },
    ],
  },
  {
    title: 'Cacho',
    fields: [
      { key: 'bunchWeightG', label: 'Peso do cacho comercial', unit: 'g', hint: 'O cacho que o mercado paga melhor. Mesa: em geral 400 a 700 g.' },
      { key: 'berryWeightG', label: 'Peso médio da baga', unit: 'g', hint: 'Pese 50 bagas do padrão desejado e divida por 50.' },
      { key: 'bunchesPerShoot', label: 'Cachos por broto fértil', unit: 'cachos', hint: 'Depois do raleio. Em uva de mesa o comum é deixar 1.' },
    ],
  },
  {
    title: 'Gemas',
    fields: [
      { key: 'budFertilityPct', label: 'Fertilidade das gemas', unit: '%', hint: 'Da análise de gemas: 40% = em cada 10 gemas, 4 trazem cacho.' },
      { key: 'budBreakPct', label: 'Brotação', unit: '%', hint: 'Das gemas deixadas na poda, quantas brotam. Com boa quebra de dormência, 80 a 90%.' },
    ],
  },
]

function Stat({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-2.5 ${strong ? 'border-accent bg-accent-soft' : 'border-line bg-bg-raised'}`}>
      <p className="text-[11px] text-text-faint">{label}</p>
      <p className={`num mt-0.5 text-lg font-semibold tracking-tight ${strong ? 'text-accent-text' : 'text-text'}`}>{value}</p>
      {sub && <p className="text-[11px] text-text-muted">{sub}</p>}
    </div>
  )
}

export function Simulator({ plots, seasonName }: { plots: SimPlot[]; seasonName: string | null }) {
  const [texts, setTexts] = useState<Texts>(() => toTexts(SIM_DEFAULTS))
  const [plotId, setPlotId] = useState('')
  const [chosen, setChosen] = useState<number | null>(null) // gemas por vara escolhidas
  const [saveState, saveAction, saving] = useActionState<ActionState, FormData>(saveForecast, {})

  // Ultima simulacao do produtor neste navegador (conveniencia, nao dado).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE)
      if (raw) setTexts((t) => ({ ...t, ...JSON.parse(raw) }))
    } catch {}
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(texts))
    } catch {}
  }, [texts])

  const input = useMemo(
    () => Object.fromEntries(Object.entries(texts).map(([k, v]) => [k, parseBr(v) ?? NaN])) as SimInput,
    [texts],
  )
  const r = useMemo(() => simulate(input), [input])
  const plot = plots.find((p) => p.id === plotId)

  function set(key: Key, v: string) {
    setTexts((t) => ({ ...t, [key]: v }))
    setChosen(null)
  }

  function pickPlot(id: string) {
    setPlotId(id)
    const p = plots.find((x) => x.id === id)
    if (p?.row_spacing && p.plant_spacing)
      setTexts((t) => ({ ...t, rowSpacingM: toBr(p.row_spacing, 2).replace(/,00$/, ''), plantSpacingM: toBr(p.plant_spacing, 2).replace(/,00$/, '') }))
  }

  const option: PruneOption | null = r.ok
    ? (r.options.find((o) => o.budsPerCane === chosen) ?? r.recommended ?? r.options[0])
    : null

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* ------------------------------------------------ entradas */}
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-line bg-bg-raised p-4">
          <Field
            label="Talhão (opcional)"
            htmlFor="sim_plot"
            hint={
              plot
                ? `${num(Number(plot.area), 2)} ha${plot.variety ? ` · ${plot.variety}` : ''}${
                    plot.row_spacing && plot.plant_spacing ? ' · espaçamento do cadastro' : ' · sem espaçamento no cadastro'
                  }`
                : 'Preenche o espaçamento e calcula o total do talhão.'
            }
          >
            <Select id="sim_plot" value={plotId} onChange={(e) => pickPlot(e.target.value)}>
              <option value="">Simular por hectare</option>
              {plots.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ? `${p.code} — ${p.name}` : p.code}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {GROUPS.map((g) => (
          <fieldset key={g.title} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <legend className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">{g.title}</legend>
            {g.fields.map((f) => (
              <Field key={f.key} label={f.label} htmlFor={`sim_${f.key}`} hint={f.hint}>
                <InputWithUnit
                  id={`sim_${f.key}`}
                  unit={f.unit}
                  inputMode="decimal"
                  value={texts[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              </Field>
            ))}
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() => {
            setTexts(toTexts(SIM_DEFAULTS))
            setChosen(null)
          }}
          className="self-start text-sm text-text-muted underline-offset-4 hover:text-text hover:underline"
        >
          Voltar aos valores de referência
        </button>
      </div>

      {/* ------------------------------------------------ resultado */}
      <div className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
        {!r.ok ? (
          <div className="rounded-lg border border-line bg-bg-raised p-5">
            <p className="text-sm font-medium">Complete os dados para simular</p>
            <ul className="mt-2 list-disc pl-5 text-sm text-text-muted">
              {r.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            {/* o caminho da conta */}
            <section className="rounded-lg border border-line bg-bg-raised p-5">
              <h3 className="text-sm font-semibold">O que a planta precisa entregar</h3>
              <ol className="mt-4 flex flex-col">
                {[
                  ['Produção bruta no pé', `${num(r.grossTHa, 2)} t/ha`, `meta de ${num(input.targetTHa, 2)} t/ha + ${num(input.lossPct, 1)}% de perdas`],
                  ['Plantas por hectare', num(Math.round(r.plantsPerHa)), `${num(input.rowSpacingM, 2)} × ${num(input.plantSpacingM, 2)} m`],
                  ['Produção por planta', `${num(r.kgPerPlant, 2)} kg`, undefined],
                  ['Cachos por planta', num(Math.ceil(r.bunchesPerPlant - 1e-9)), `cachos de ${num(input.bunchWeightG)} g`],
                  ['Cachos por saída', num(r.bunchesPerArm, 1), `${num(input.armsPerPlant)} saídas por planta`],
                  ['Brotos férteis por planta', num(Math.ceil(r.fertileShootsPerPlant - 1e-9)), `${num(input.bunchesPerShoot, 1)} cacho por broto`],
                  ['Gemas por planta', num(Math.ceil(r.budsPerPlant - 1e-9)), `${num(input.budBreakPct)}% brotam × ${num(input.budFertilityPct)}% férteis`],
                  ['Gemas por saída', num(Math.ceil(r.budsPerArm - 1e-9)), undefined],
                ].map(([label, value, sub], idx, arr) => (
                  <li key={label} className="flex flex-col">
                    <div className="flex items-baseline justify-between gap-4 py-1.5">
                      <span className="text-sm text-text-muted">
                        {label}
                        {sub && <span className="block text-[11px] text-text-faint">{sub}</span>}
                      </span>
                      <span className="num shrink-0 text-base font-semibold">{value}</span>
                    </div>
                    {idx < arr.length - 1 && <ArrowDownIcon size={12} className="ml-1 text-text-faint" aria-hidden />}
                  </li>
                ))}
              </ol>
            </section>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Bagas por cacho" value={num(Math.round(r.berriesPerBunch))} sub={`bagas de ${num(input.berryWeightG, 1)} g`} />
              <Stat label="Cachos por m²" value={num(r.bunchesPerM2, 1)} />
              <Stat label="Gemas por m²" value={num(r.budsPerM2, 1)} />
              {plot ? (
                <Stat label={`Total no ${plot.code}`} value={`${num(input.targetTHa * Number(plot.area), 1)} t`} sub={`${num(Number(plot.area), 2)} ha comerciais`} />
              ) : (
                <Stat label="Cachos por hectare" value={num(Math.round(r.bunchesPerPlant * r.plantsPerHa))} />
              )}
            </div>

            {/* opcoes de poda */}
            <section className="rounded-lg border border-line bg-bg-raised p-5">
              <h3 className="text-sm font-semibold">Como podar</h3>
              <p className="mt-1 text-xs text-text-muted">
                Para chegar a {num(Math.ceil(r.budsPerArm - 1e-9))} gemas por saída. Toque numa linha para ver o resultado da poda. A
                produção abaixo já considera varas inteiras.
              </p>
              <div className="-mx-5 mt-3 overflow-x-auto px-5">
                <table className="w-full min-w-[460px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line-strong text-left">
                      {['Gemas por vara', 'Varas por saída', 'Varas por planta', 'Produção', 'Meta'].map((h, idx) => (
                        <th key={h} className={`pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-faint ${idx > 0 ? 'text-right' : ''}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {r.options.map((o) => {
                      const isRec = r.recommended?.budsPerCane === o.budsPerCane
                      const isSel = option?.budsPerCane === o.budsPerCane
                      return (
                        <tr
                          key={o.budsPerCane}
                          onClick={() => setChosen(o.budsPerCane)}
                          className={`cursor-pointer transition-colors ${isSel ? 'bg-accent-soft' : 'hover:bg-bg-sunken'}`}
                        >
                          <td className="py-2.5 pl-1">
                            <span className="num font-medium">{o.budsPerCane}</span>
                            {isRec && (
                              <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-on-accent">indicada</span>
                            )}
                          </td>
                          <td className="num py-2.5 text-right font-semibold">{o.canesPerArm}</td>
                          <td className="num py-2.5 text-right text-text-muted">{o.canesPerPlant}</td>
                          <td className="num py-2.5 text-right">{num(o.commercialTHa, 1)} t/ha</td>
                          <td className={`num py-2.5 pr-1 text-right text-xs ${o.marginPct < -0.5 ? 'text-danger' : o.marginPct > 20 ? 'text-warn' : 'text-text-muted'}`}>
                            {o.marginPct >= 0 ? '+' : ''}
                            {num(o.marginPct, 0)}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {option && (
                <div className="mt-4 rounded-md border border-line bg-bg px-4 py-3 text-sm">
                  <p className="font-medium">
                    Poda com {option.budsPerCane} gemas por vara e {option.canesPerArm} varas por saída
                  </p>
                  <p className="mt-1 text-text-muted">
                    {option.canesPerPlant} varas e {option.budsPerPlant} gemas por planta →{' '}
                    {num(option.bunchesPerPlant, 1)} cachos esperados por planta → {num(option.grossTHa, 1)} t/ha no pé →{' '}
                    <span className="font-medium text-text">{num(option.commercialTHa, 1)} t/ha comerciais</span>
                    {plot ? ` (${num(option.commercialTHa * Number(plot.area), 1)} t no ${plot.code})` : ''}.
                  </p>
                  <p className="mt-2 text-xs text-text-faint">
                    No raleio, deixe {num(Math.ceil(r.bunchesPerPlant - 1e-9))} cachos por planta (cerca de{' '}
                    {num(Math.ceil(r.bunchesPerArm - 1e-9))} por saída), com {num(Math.round(r.berriesPerBunch))} bagas por cacho.
                  </p>
                </div>
              )}
            </section>

            {r.warnings.length > 0 && (
              <section className="flex flex-col gap-2">
                {r.warnings.map((w) => (
                  <p key={w} className="flex items-start gap-2 rounded-md bg-warn-soft px-3 py-2.5 text-sm text-warn">
                    <WarningIcon size={17} weight="bold" className="mt-px shrink-0" /> {w}
                  </p>
                ))}
              </section>
            )}

            {plot && seasonName && (
              <form action={saveAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name={`t_ha__${plot.id}`} value={toBr(input.targetTHa, 2)} />
                <Button type="submit" variant="secondary" disabled={saving}>
                  Usar {num(input.targetTHa, 1)} t/ha como previsão do {plot.code}
                </Button>
                {saveState.message && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-accent-text">
                    <CheckCircleIcon size={16} weight="fill" /> Previsão da safra {seasonName} salva.
                  </span>
                )}
                {saveState.error && <span className="text-sm text-danger">{saveState.error}</span>}
              </form>
            )}

            <p className="text-xs leading-relaxed text-text-faint">
              Simulação de referência. Fertilidade e brotação mudam com a variedade, a safra e o manejo — use os números da
              análise de gemas do seu talhão e ajuste no raleio.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
