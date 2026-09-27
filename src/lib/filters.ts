/**
 * Filtros das listas (data, talhao, categoria, maquina...), lidos da URL.
 *
 * Ficam na URL de proposito: o filtro sobrevive ao recarregar, pode ser
 * compartilhado, e a exportacao para Excel recebe exatamente o mesmo
 * recorte que a tela esta mostrando.
 */
export type Filters = {
  de: string | null
  ate: string | null
  talhao: string | null
  categoria: string | null
  maquina: string | null
  comprador: string | null
  produto: string | null
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f-]{36}$/i

type Params = Record<string, string | string[] | undefined> | URLSearchParams

function get(p: Params, k: string): string | null {
  const v = p instanceof URLSearchParams ? p.get(k) : p[k]
  const s = Array.isArray(v) ? v[0] : v
  return s && s.trim() ? s.trim() : null
}

export function readFilters(p: Params): Filters {
  const de = get(p, 'de')
  const ate = get(p, 'ate')
  const uuid = (k: string) => {
    const v = get(p, k)
    return v && UUID.test(v) ? v : null
  }
  const cat = get(p, 'categoria')
  return {
    de: de && ISO.test(de) ? de : null,
    ate: ate && ISO.test(ate) ? ate : null,
    talhao: uuid('talhao'),
    // categoria pode ser codigo (custos) ou id (estoque)
    categoria: cat && /^[a-z0-9_-]{2,64}$/i.test(cat) ? cat : null,
    maquina: uuid('maquina'),
    comprador: uuid('comprador'),
    produto: uuid('produto'),
  }
}

export function hasFilters(f: Filters) {
  return Object.values(f).some((v) => v !== null)
}

/** Aplica o intervalo de datas numa consulta do supabase-js. */
export function byDate<Q extends { gte: (c: string, v: string) => Q; lte: (c: string, v: string) => Q }>(
  q: Q,
  column: string,
  f: Filters,
): Q {
  let out = q
  if (f.de) out = out.gte(column, f.de)
  if (f.ate) out = out.lte(column, f.ate)
  return out
}

/** Aplica igualdade so' quando o filtro esta preenchido. */
export function eqIf<Q extends { eq: (c: string, v: string) => Q }>(q: Q, column: string, value: string | null): Q {
  return value ? q.eq(column, value) : q
}
