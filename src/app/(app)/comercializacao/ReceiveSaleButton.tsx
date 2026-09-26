'use client'

import { useTransition } from 'react'
import { CheckIcon } from '@phosphor-icons/react/dist/ssr'
import { receiveSale } from '@/lib/actions/records'

/** Baixa o recebimento integral da venda. */
export function ReceiveSaleButton({ id }: { id: string }) {
  const [pending, start] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void receiveSale(id))}
      className="press inline-flex shrink-0 items-center gap-1 rounded-md border border-line-strong px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-accent-text disabled:opacity-50"
    >
      <CheckIcon size={13} weight="bold" />
      {pending ? 'Baixando…' : 'Recebi'}
    </button>
  )
}
