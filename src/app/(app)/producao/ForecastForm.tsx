'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { saveForecast } from '@/lib/actions/forecast'
import type { ActionState } from '@/lib/actions/shared'
import { num } from '@/lib/format'

export type ForecastRow = {
  plot_id: string
  code: string
  area: number
  variety_name: string | null
  crop_name: string | null
  expected_t_ha: number | null
  realized_kg: number
}

function parse(v: string): number | null {
  const s = v.trim()
  if (!s) return null
  const n = Number(s.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

const t = (kg: number) => `${num(kg / 1000, 1)} t`

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Salvando…' : 'Salvar previsão'}
    </Button>
  )
}

/** Barra de "quanto da previsao ja' foi colhido". */
export function AchievedBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-text-faint">—</span>
  const width = Math.min(pct, 100)
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-bg-sunken">
        <span
          className={`block h-full rounded-full ${pct > 100 ? 'bg-accent-text' : 'bg-accent'}`}
          style={{ width: `${width.toFixed(1)}%` }}
        />
      </span>
      <span className="num w-12 shrink-0 text-right">{num(pct, 0)}%</span>
    </span>
  )
}

export function ForecastForm({ rows, seasonName }: { rows: ForecastRow[]; seasonName: string }) {
  const [state, action] = useActionState<ActionState, FormData>(saveForecast, {})
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.plot_id,
        r.expected_t_ha !== null ? String(r.expected_t_ha).replace('.', ',') : '',
      ]),
    ),
  )

  // Totais recalculados a cada tecla — o produtor ve o volume da safra
  // mudar enquanto ajusta a previsao de cada talhao.
  let area = 0
  let expectedKg = 0
  let realizedKg = 0
  let realizedOnForecast = 0
  for (const r of rows) {
    area += r.area
    realizedKg += r.realized_kg
    const tHa = parse(values[r.plot_id] ?? '')
    if (tHa !== null) {
      expectedKg += tHa * r.area * 1000
      realizedOnForecast += r.realized_kg
    }
  }
  const totalPct = expectedKg > 0 ? (realizedOnForecast / expectedKg) * 100 : null

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[860px] table-fixed border-collapse text-sm">
          <colgroup>
            <col style={{ width: '8%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '18%' }} />
          </colgroup>
          <thead>
            <tr className="border-b border-line-strong text-left">
              {[
                ['Talhão', ''],
                ['Variedade', ''],
                ['Área', 'text-right'],
                ['Previsão', 'text-right'],
                ['Volume previsto', 'text-right'],
                ['Realizado', 'text-right'],
                ['t/ha realizado', 'text-right'],
                ['% da previsão', 'pl-4'],
              ].map(([h, cls]) => (
                <th
                  key={h}
                  className={`pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-faint ${cls}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const tHa = parse(values[r.plot_id] ?? '')
              const expected = tHa !== null ? tHa * r.area * 1000 : null
              const pct = expected ? (r.realized_kg / expected) * 100 : null
              return (
                <tr key={r.plot_id}>
                  <td className="num py-2 font-medium">{r.code}</td>
                  <td className="truncate py-2 pr-3 text-text-muted">
                    {r.variety_name ?? r.crop_name ?? '—'}
                  </td>
                  <td className="num py-2 text-right text-text-muted">{num(r.area, 2)} ha</td>
                  <td className="py-2 pl-3">
                    <div className="relative">
                      <input
                        name={`t_ha__${r.plot_id}`}
                        value={values[r.plot_id] ?? ''}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [r.plot_id]: e.target.value }))
                        }
                        inputMode="decimal"
                        placeholder="—"
                        aria-label={`Previsão em t/ha do talhão ${r.code}`}
                        className="num h-9 w-full rounded-md border border-line-strong bg-bg-raised pl-2 pr-11 text-right text-sm text-text placeholder:text-text-faint hover:border-sand-400 focus:border-accent focus:outline-none"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-faint">
                        t/ha
                      </span>
                    </div>
                  </td>
                  <td className="num py-2 text-right">{expected !== null ? t(expected) : '—'}</td>
                  <td className="num py-2 text-right">{t(r.realized_kg)}</td>
                  <td className="num py-2 text-right text-text-muted">
                    {r.area > 0 ? num(r.realized_kg / 1000 / r.area, 1) : '—'}
                  </td>
                  <td className="py-2 pl-4">
                    <AchievedBar pct={pct} />
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-line-strong font-medium">
              <td className="py-3 text-[11px] uppercase tracking-[0.1em] text-text-muted">
                Safra
              </td>
              <td className="py-3 text-text-muted">{seasonName}</td>
              <td className="num py-3 text-right">{num(area, 2)} ha</td>
              <td className="num py-3 text-right text-text-muted">
                {expectedKg > 0 && area > 0 ? `${num(expectedKg / 1000 / area, 1)} t/ha` : '—'}
              </td>
              <td className="num py-3 text-right">{expectedKg > 0 ? t(expectedKg) : '—'}</td>
              <td className="num py-3 text-right">{t(realizedKg)}</td>
              <td className="num py-3 text-right text-text-muted">
                {area > 0 ? num(realizedKg / 1000 / area, 1) : '—'}
              </td>
              <td className="py-3 pl-4">
                <AchievedBar pct={totalPct} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger"
        >
          <WarningCircleIcon size={18} weight="bold" className="mt-px shrink-0" />
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="flex items-start gap-2 rounded-md bg-accent-soft px-3 py-2.5 text-sm text-accent-text">
          <CheckCircleIcon size={18} weight="fill" className="mt-px shrink-0" />
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Submit />
        <p className="text-xs text-text-muted">
          Informe em toneladas por hectare. O volume é calculado pela área de cada talhão; campo
          vazio remove a previsão.
        </p>
      </div>
    </form>
  )
}
