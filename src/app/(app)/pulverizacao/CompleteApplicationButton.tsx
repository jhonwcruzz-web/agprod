'use client'

import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { CheckIcon } from '@phosphor-icons/react/dist/ssr'
import { completeApplication } from '@/lib/actions/records'
import { today } from '@/lib/format'

/**
 * Marca a pulverizacao programada como realizada — baixa estoque e custo.
 * Sem dose cadastrada nao da' para calcular a baixa: abre a edicao.
 */
export function CompleteApplicationButton({ id, editHref }: { id: string; editHref: Route }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await completeApplication(id, today())
          if (res.error) {
            window.alert(res.error)
            router.push(editHref)
          }
        })
      }
      className="press inline-flex shrink-0 items-center gap-1 rounded-md border border-line-strong px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-accent-text disabled:opacity-50"
    >
      <CheckIcon size={13} weight="bold" />
      {pending ? 'Marcando…' : 'Marcar feita'}
    </button>
  )
}
