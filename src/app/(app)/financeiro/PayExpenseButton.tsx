'use client'

import { useTransition } from 'react'
import { CheckIcon } from '@phosphor-icons/react/dist/ssr'
import { payExpense } from '@/lib/actions/records'

/** Quita a despesa por inteiro. */
export function PayExpenseButton({ id }: { id: string }) {
  const [pending, start] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void payExpense(id))}
      className="press inline-flex shrink-0 items-center gap-1 rounded-md border border-line-strong px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-accent-text disabled:opacity-50"
    >
      <CheckIcon size={13} weight="bold" />
      {pending ? 'Pagando…' : 'Paguei'}
    </button>
  )
}
