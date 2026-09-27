import type { Route } from 'next'

type SP = Record<string, string | string[] | undefined>

/**
 * Mesmo endereco com parametros trocados — preserva aba e filtros.
 * `null` remove o parametro.
 */
export function withParams(path: string, sp: SP, changes: Record<string, string | null>): Route {
  const next = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    const s = Array.isArray(v) ? v[0] : v
    if (s) next.set(k, s)
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) next.delete(k)
    else next.set(k, v)
  }
  const qs = next.toString()
  return (qs ? `${path}?${qs}` : path) as Route
}

/** Link para abrir a edicao de um registro na propria pagina. */
export function editLink(path: string, sp: SP, id: string): Route {
  return withParams(path, sp, { editar: id, novo: null })
}

/** Link para fechar o formulario (novo ou edicao), mantendo filtros. */
export function closeLink(path: string, sp: SP): Route {
  return withParams(path, sp, { editar: null, novo: null })
}
