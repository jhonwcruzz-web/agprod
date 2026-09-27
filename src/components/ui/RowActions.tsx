'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { LightningIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react/dist/ssr'
import { deleteRecord, type DeletableKind } from '@/lib/actions/delete'

/**
 * Editar e excluir, no fim de cada linha de lancamento.
 *
 * Excluir pede confirmacao no proprio lugar (sem janela). Lancamento
 * gerado automaticamente (custo de uma pulverizacao, baixa de estoque)
 * nao se edita aqui: mostra de onde veio.
 */
export function RowActions({
  id,
  kind,
  editHref,
  confirm = 'Excluir este lançamento?',
  autoFrom,
}: {
  id: string
  kind?: DeletableKind
  editHref?: Route
  confirm?: string
  /** Presente = gerado automaticamente por outro lancamento. */
  autoFrom?: { label: string; href?: Route }
}) {
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  if (autoFrom) {
    const content = (
      <>
        <LightningIcon size={13} weight="fill" /> {autoFrom.label}
      </>
    )
    return autoFrom.href ? (
      <Link
        href={autoFrom.href}
        title="Gerado automaticamente — edite na origem"
        className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-text-faint hover:text-accent-text"
      >
        {content}
      </Link>
    ) : (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-text-faint">{content}</span>
    )
  }

  function remove() {
    if (!kind) return
    setError(null)
    start(async () => {
      const r = await deleteRecord(kind, id)
      if (r.ok) {
        setAsking(false)
        if (r.message !== 'Excluído.') setNotice(r.message)
        router.refresh()
      } else {
        setError(r.error)
      }
    })
  }

  return (
    <span className="relative inline-flex items-center justify-end gap-1">
      {asking ? (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-danger-soft px-2 py-1 text-xs text-danger">
          {confirm}
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="press ml-1 rounded px-1.5 font-semibold hover:bg-danger hover:text-white disabled:opacity-50"
          >
            {pending ? '…' : 'Sim'}
          </button>
          <button type="button" onClick={() => setAsking(false)} className="rounded px-1.5 hover:bg-bg-raised">
            Não
          </button>
        </span>
      ) : (
        <>
          {editHref && (
            <Link
              href={editHref}
              scroll={false}
              aria-label="Editar"
              title="Editar"
              className="press rounded-md p-1.5 text-text-faint transition-colors hover:bg-bg-sunken hover:text-accent-text"
            >
              <PencilSimpleIcon size={15} />
            </Link>
          )}
          {kind && (
            <button
              type="button"
              onClick={() => {
                setError(null)
                setAsking(true)
              }}
              aria-label="Excluir"
              title="Excluir"
              className="press rounded-md p-1.5 text-text-faint transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <TrashIcon size={15} />
            </button>
          )}
        </>
      )}
      {(error || notice) && (
        <span
          role="alert"
          className={`absolute right-0 top-full z-20 mt-1 w-64 rounded-md border px-3 py-2 text-left text-xs shadow-sm ${
            error ? 'border-danger bg-danger-soft text-danger' : 'border-line bg-bg-raised text-text'
          }`}
        >
          {error ?? notice}
          <button type="button" onClick={() => { setError(null); setNotice(null) }} className="ml-2 underline">
            ok
          </button>
        </span>
      )}
    </span>
  )
}
