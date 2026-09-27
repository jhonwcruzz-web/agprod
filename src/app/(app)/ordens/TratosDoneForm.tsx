'use client'

import { useState } from 'react'
import type { Route } from 'next'
import { Field, Input, InputWithUnit, Textarea } from '@/components/ui/Field'
import { FormGrid, FormPanel } from '@/components/forms/FormPanel'
import { completeTratosOrder } from '@/lib/actions/orders'
import { parseBr, round, toBr } from '@/lib/calc'
import { money, today } from '@/lib/format'
import { orderNumber } from '@/lib/orders'

/**
 * Concluir OS de tratos culturais: diarias realizadas x valor da diaria
 * viram a mao de obra do talhao (ou o valor digitado, se foi empreitada).
 */
export function TratosDoneForm({
  order,
  closeHref,
}: {
  order: { id: string; number: number; activity: string | null; plot: string | null; laborDays: number | null; dailyRate: number | null }
  closeHref: Route
}) {
  const [daysTxt, setDaysTxt] = useState(toBr(order.laborDays, 1))
  const [rateTxt, setRateTxt] = useState(toBr(order.dailyRate, 2))
  const [costTxt, setCostTxt] = useState('')
  const days = parseBr(daysTxt)
  const rate = parseBr(rateTxt)
  const auto = days !== null && rate !== null ? round(days * rate, 2) : null
  const cost = parseBr(costTxt) ?? auto

  return (
    <FormPanel
      action={completeTratosOrder}
      title={`Concluir OS ${orderNumber(order.number)} — ${order.activity ?? 'Tratos culturais'}${order.plot ? ` · ${order.plot}` : ''}`}
      description="Informe as diárias realizadas. A mão de obra entra em Custos, no talhão, na categoria Mão de obra."
      closeHref={closeHref}
      submitLabel="Concluir ordem"
      editId={order.id}
    >
      <FormGrid>
        <Field label="Data da conclusão" htmlFor="done_date" required>
          <Input id="done_date" name="done_date" type="date" required defaultValue={today()} className="num" />
        </Field>
        <Field label="Diárias realizadas" htmlFor="labor_days" hint="Pessoas x dias trabalhados.">
          <InputWithUnit
            id="labor_days"
            name="labor_days"
            unit="diárias"
            inputMode="decimal"
            value={daysTxt}
            onChange={(e) => setDaysTxt(e.target.value)}
          />
        </Field>
        <Field label="Valor da diária" htmlFor="daily_rate">
          <InputWithUnit
            id="daily_rate"
            name="daily_rate"
            unit="R$"
            inputMode="decimal"
            value={rateTxt}
            onChange={(e) => setRateTxt(e.target.value)}
          />
        </Field>
        <Field
          label="Mão de obra total"
          htmlFor="labor_cost"
          hint={auto !== null ? `Calculada: ${money(auto)} — digite só se foi outro valor (empreitada).` : 'Sem valor, a ordem é concluída sem lançar custo.'}
        >
          <InputWithUnit
            id="labor_cost"
            name="labor_cost"
            unit="R$"
            inputMode="decimal"
            value={costTxt}
            onChange={(e) => setCostTxt(e.target.value)}
            placeholder={auto !== null ? toBr(auto, 2) : ''}
          />
        </Field>
      </FormGrid>
      <div className="mt-5">
        <Field label="Observações" htmlFor="notes">
          <Textarea id="notes" name="notes" rows={2} />
        </Field>
      </div>
      {cost !== null && cost > 0 && (
        <p className="mt-4 text-sm text-text-muted">
          Será lançado: <span className="num font-medium text-text">{money(cost)}</span> em Mão de obra.
        </p>
      )}
    </FormPanel>
  )
}
