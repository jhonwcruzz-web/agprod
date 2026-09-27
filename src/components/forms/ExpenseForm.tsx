'use client'

import { useState } from 'react'
import type { Route } from 'next'
import { Field, Input, InputWithUnit, Select, Textarea } from '@/components/ui/Field'
import { CreatableSelect } from '@/components/ui/CreatableSelect'
import { FormGrid, FormPanel, plotLabel, type PlotOption } from './FormPanel'
import { createExpenseCategory, saveExpense } from '@/lib/actions/records'
import { toBr } from '@/lib/calc'
import { today } from '@/lib/format'
import type { Tables } from '@/lib/types/database'

export function ExpenseForm({
  plots,
  categories,
  closeHref,
  initial,
}: {
  plots: PlotOption[]
  categories: { code: string; name: string }[]
  closeHref: Route
  initial?: Partial<Tables<'expenses'>>
}) {
  const [status, setStatus] = useState<string>(initial?.status ?? 'pago')
  const editing = !!initial?.id

  return (
    <FormPanel
      action={saveExpense}
      title={editing ? 'Editar despesa' : 'Registrar despesa'}
      description="Informe só o essencial: categoria, descrição e valor."
      closeHref={closeHref}
      submitLabel={editing ? 'Salvar alterações' : 'Registrar despesa'}
      editId={initial?.id}
    >
      <FormGrid>
        <Field label="Categoria" htmlFor="category" required hint="Use o + para criar outra categoria.">
          <CreatableSelect
            id="category"
            name="category"
            options={categories.map((c) => ({ value: c.code, label: c.name }))}
            defaultValue={initial?.category ?? 'mao_de_obra'}
            addLabel="Nova categoria"
            onCreate={async (label) => {
              const res = await createExpenseCategory(label)
              return 'error' in res ? res : { value: res.code, label: res.name }
            }}
          />
        </Field>

        <Field label="Descrição" htmlFor="description" required className="sm:col-span-2">
          <Input
            id="description"
            name="description"
            required
            defaultValue={initial?.description ?? ''}
            placeholder="Diária da turma de poda"
          />
        </Field>

        <Field label="Valor" htmlFor="amount" required>
          <InputWithUnit
            id="amount"
            name="amount"
            unit="R$"
            inputMode="decimal"
            required
            defaultValue={toBr(initial?.amount ?? null, 2)}
            placeholder="2400,00"
          />
        </Field>

        <Field label="Data" htmlFor="expense_date" required>
          <Input
            id="expense_date"
            name="expense_date"
            type="date"
            defaultValue={initial?.expense_date ?? today()}
            required
            className="num"
          />
        </Field>

        <Field label="Talhão" htmlFor="plot_id" hint="Vincule para entrar no custo por kg do talhão.">
          <Select id="plot_id" name="plot_id" defaultValue={initial?.plot_id ?? ''}>
            <option value="">Custo geral da propriedade</option>
            {plots.map((p) => (
              <option key={p.id} value={p.id}>
                {plotLabel(p)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Situação" htmlFor="status">
          <Select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pago">Já paguei</option>
            <option value="pendente">A pagar</option>
          </Select>
        </Field>

        {status !== 'pago' && (
          <Field label="Vencimento" htmlFor="due_date">
            <Input id="due_date" name="due_date" type="date" defaultValue={initial?.due_date ?? ''} className="num" />
          </Field>
        )}

        <Field label="Fornecedor" htmlFor="supplier">
          <Input id="supplier" name="supplier" defaultValue={initial?.supplier ?? ''} />
        </Field>
      </FormGrid>

      <div className="mt-5">
        <Field label="Observações" htmlFor="notes">
          <Textarea id="notes" name="notes" defaultValue={initial?.notes ?? ''} />
        </Field>
      </div>
    </FormPanel>
  )
}
