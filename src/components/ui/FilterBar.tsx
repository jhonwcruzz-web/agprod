'use client'

import type { Route } from 'next'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { FileXlsIcon, FunnelSimpleIcon, XIcon } from '@phosphor-icons/react/dist/ssr'

export type FilterSelect = {
  /** nome do parametro na URL: talhao, categoria, maquina, comprador, produto */
  param: string
  label: string
  options: { value: string; label: string }[]
}

/**
 * Filtros de uma lista + exportacao para Excel do mesmo recorte.
 *
 * Tudo vai para a URL, entao a tela e o arquivo exportado mostram sempre
 * os mesmos dados. A aba ativa (?aba=) e' preservada.
 */
export function FilterBar({
  selects = [],
  exportType,
  dates = true,
}: {
  selects?: FilterSelect[]
  /** tipo de relatorio em /api/exportar/<tipo>; ausente = sem botao */
  exportType?: string
  dates?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    // fecha formularios abertos ao filtrar
    next.delete('novo')
    next.delete('editar')
    start(() => router.replace(`${pathname}?${next.toString()}` as Route, { scroll: false }))
  }

  const keys = ['de', 'ate', ...selects.map((s) => s.param)]
  const active = keys.some((k) => params.get(k))

  function clear() {
    const next = new URLSearchParams(params.toString())
    for (const k of keys) next.delete(k)
    start(() => router.replace(`${pathname}?${next.toString()}` as Route, { scroll: false }))
  }

  const exportHref = exportType
    ? `/api/exportar/${exportType}?${new URLSearchParams(
        [...params.entries()].filter(([k]) => k !== 'novo' && k !== 'editar'),
      ).toString()}`
    : null

  const control =
    'h-9 rounded-md border border-line-strong bg-bg-raised px-2.5 text-sm text-text focus:border-accent focus:outline-none'

  return (
    <div
      className={`flex flex-wrap items-end gap-2 rounded-lg border border-line bg-bg-sunken/60 px-3 py-2.5 transition-opacity ${
        pending ? 'opacity-60' : ''
      }`}
    >
      <FunnelSimpleIcon size={16} className="mb-2.5 text-text-faint" aria-hidden />

      {dates && (
        <>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-text-faint">
            De
            <input
              type="date"
              className={`${control} num`}
              value={params.get('de') ?? ''}
              onChange={(e) => set('de', e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-text-faint">
            Até
            <input
              type="date"
              className={`${control} num`}
              value={params.get('ate') ?? ''}
              onChange={(e) => set('ate', e.target.value)}
            />
          </label>
        </>
      )}

      {selects.map((s) => (
        <label key={s.param} className="flex flex-col gap-1 text-[11px] font-medium text-text-faint">
          {s.label}
          <select
            className={`${control} max-w-[200px]`}
            value={params.get(s.param) ?? ''}
            onChange={(e) => set(s.param, e.target.value)}
          >
            <option value="">Todos</option>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      {active && (
        <button
          type="button"
          onClick={clear}
          className="press mb-0.5 inline-flex h-9 items-center gap-1 rounded-md px-2.5 text-sm text-text-muted hover:bg-bg-raised hover:text-text"
        >
          <XIcon size={14} /> Limpar
        </button>
      )}

      {exportHref && (
        <a
          href={exportHref}
          className="press mb-0.5 ml-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong bg-bg-raised px-3 text-sm font-medium text-text transition-colors hover:border-accent hover:text-accent-text"
        >
          <FileXlsIcon size={16} /> Exportar Excel
        </a>
      )}
    </div>
  )
}
