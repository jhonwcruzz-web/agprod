'use client'

import { useRef, useState, useTransition } from 'react'
import { CheckIcon, PlusIcon, XIcon } from '@phosphor-icons/react/dist/ssr'
import { Select } from './Field'

export type CreatableOption = { value: string; label: string }

/**
 * Lista suspensa com botao "+" para o produtor criar a propria opcao.
 *
 * A opcao criada e' gravada no servidor (onCreate), entra na lista e ja'
 * fica selecionada — nao precisa recarregar a pagina nem sair do
 * formulario. Reutilizavel para qualquer lista que o produtor estenda.
 */
export function CreatableSelect({
  id,
  name,
  options: initial,
  defaultValue = '',
  placeholder = '—',
  addLabel = 'Nova opção',
  onCreate,
}: {
  id: string
  name: string
  options: CreatableOption[]
  defaultValue?: string
  placeholder?: string
  addLabel?: string
  onCreate: (label: string) => Promise<CreatableOption | { error: string }>
}) {
  const [options, setOptions] = useState(initial)
  const [value, setValue] = useState(defaultValue)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function openAdd() {
    setAdding(true)
    setError(null)
    // foca depois do input existir no DOM
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function cancel() {
    setAdding(false)
    setDraft('')
    setError(null)
  }

  function save() {
    const label = draft.trim()
    if (!label) return
    start(async () => {
      const res = await onCreate(label)
      if ('error' in res) {
        setError(res.error)
        return
      }
      setOptions((prev) =>
        prev.some((o) => o.value === res.value) ? prev : [...prev, res],
      )
      setValue(res.value)
      cancel()
    })
  }

  if (adding) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            value={draft}
            maxLength={60}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter aqui nao pode enviar o formulario inteiro.
              if (e.key === 'Enter') {
                e.preventDefault()
                save()
              }
              if (e.key === 'Escape') cancel()
            }}
            placeholder={addLabel}
            aria-label={addLabel}
            className="h-10 w-full min-w-0 rounded-md border border-accent bg-bg-raised px-3 text-sm text-text placeholder:text-text-faint focus:outline-none"
          />
          <button
            type="button"
            onClick={save}
            disabled={pending || !draft.trim()}
            aria-label="Adicionar"
            className="press flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-on-accent transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <CheckIcon size={16} weight="bold" />
          </button>
          <button
            type="button"
            onClick={cancel}
            aria-label="Cancelar"
            className="press flex size-10 shrink-0 items-center justify-center rounded-md border border-line-strong text-text-muted hover:bg-bg-sunken"
          >
            <XIcon size={16} />
          </button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        {/* mantem o valor atual no envio enquanto o campo de criacao esta aberto */}
        <input type="hidden" name={name} value={value} />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select
        id={id}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-w-0 flex-1"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <button
        type="button"
        onClick={openAdd}
        aria-label={addLabel}
        title={addLabel}
        className="press flex size-10 shrink-0 items-center justify-center rounded-md border border-line-strong text-text-muted transition-colors hover:border-accent hover:text-accent-text"
      >
        <PlusIcon size={16} weight="bold" />
      </button>
    </div>
  )
}
