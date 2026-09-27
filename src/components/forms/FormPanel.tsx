'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { CheckCircleIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react/dist/ssr'
import type { Route } from 'next'
import { Button } from '@/components/ui/Button'
import type { ActionState } from '@/lib/actions/shared'

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Salvando…' : label}
    </Button>
  )
}

/**
 * Painel de lancamento aberto por ?novo=1 na propria pagina do modulo.
 *
 * Sem modal: no celular um painel na pagina rola melhor, o teclado nao
 * cobre o campo e o botao voltar funciona como esperado.
 */
export function FormPanel({
  action,
  title,
  description,
  closeHref,
  children,
  submitLabel,
  editId,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  title: string
  description?: string
  closeHref: Route
  children: ReactNode
  submitLabel: string
  /** Presente = editando esse registro (o formulario nao se limpa). */
  editId?: string
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {})
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)

  // Novo lancamento: limpa o formulario para o proximo — quem registra uma
  // colheita costuma registrar varias seguidas. Edicao: mantem os valores
  // (sao exatamente o que acabou de ser salvo).
  useEffect(() => {
    if (state.message) {
      if (!editId) formRef.current?.reset()
      router.refresh()
    }
  }, [state.message, router, editId])

  return (
    <form
      ref={formRef}
      action={formAction}
      className={`rounded-lg border bg-bg-raised p-5 sm:p-6 ${
        editId ? 'border-accent' : 'border-line-strong'
      }`}
    >
      {editId && <input type="hidden" name="id" value={editId} />}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-1 text-xs text-text-muted">{description}</p>}
        </div>
        <Link
          href={closeHref}
          aria-label="Fechar"
          className="press shrink-0 rounded-md p-1 text-text-muted hover:bg-bg-sunken"
        >
          <XIcon size={18} />
        </Link>
      </div>

      {children}

      {state.error && (
        <p
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger"
        >
          <WarningCircleIcon size={18} weight="bold" className="mt-px shrink-0" />
          {state.error}
        </p>
      )}

      {state.message && (
        <p className="mt-5 flex items-start gap-2 rounded-md bg-accent-soft px-3 py-2.5 text-sm text-accent-text">
          <CheckCircleIcon size={18} weight="fill" className="mt-px shrink-0" />
          {state.message}
        </p>
      )}

      <div className="mt-6 flex items-center gap-3 border-t border-line pt-5">
        <SubmitButton label={submitLabel} />
        <Link href={closeHref} className="text-sm text-text-muted hover:text-text">
          Fechar
        </Link>
      </div>
    </form>
  )
}

/** Grade padrao dos campos dentro do painel. */
export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
}

export type PlotOption = {
  id: string
  code: string
  name: string | null
  area: number
  crop_id?: string | null
  variety_id?: string | null
  plant_count?: number | null
}
export type Option = { id: string; name: string }
export type VarietyOption = Option & { crop_id: string }

export function plotLabel(p: PlotOption) {
  return p.name ? `${p.code} — ${p.name}` : p.code
}
