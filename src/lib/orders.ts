/* Ordens de servico: rotulos e contas usados na tela, no PDF e no WhatsApp. */

export const ORDER_KINDS = ['pulverizacao', 'adubacao', 'tratos', 'colheita', 'manutencao'] as const
export type OrderKind = (typeof ORDER_KINDS)[number]

export const ORDER_KIND_LABEL: Record<OrderKind, string> = {
  pulverizacao: 'Pulverização',
  adubacao: 'Adubação',
  tratos: 'Tratos culturais',
  colheita: 'Colheita',
  manutencao: 'Manutenção',
}

/** Tratos culturais mais comuns em uva e manga ("Outro" permite digitar). */
export const CULTURAL_ACTIVITIES = [
  'Poda',
  'Desbrota',
  'Raleio de cachos',
  'Raleio de frutos',
  'Amarração / condução',
  'Desfolha',
  'Anelamento',
  'Ensacamento',
  'Capina / roçagem',
  'Limpeza de área',
] as const

/** Formas de aplicar adubo. */
export const FERT_METHODS = ['A lanço', 'Em cova / sulco', 'Fertirrigação', 'Foliar', 'Incorporado'] as const

export const ORDER_STATUS = ['aberta', 'concluida', 'cancelada'] as const
export type OrderStatus = (typeof ORDER_STATUS)[number]

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  aberta: 'Aberta',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export function isOrderKind(v: unknown): v is OrderKind {
  return (ORDER_KINDS as readonly string[]).includes(String(v))
}

/** "7" -> "0007": o numero impresso na OS. */
export function orderNumber(n: number) {
  return String(n).padStart(4, '0')
}

/**
 * Telefone para o link do WhatsApp: so' digitos, com DDI 55 quando o
 * numero foi digitado no formato nacional (DDD + numero).
 */
export function whatsappPhone(raw: string | null | undefined): string | null {
  const d = (raw ?? '').replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) return `55${d}`
  if (d.length >= 12 && d.length <= 13) return d
  return null
}

/** "87999990000" -> "(87) 99999-0000"; o que nao reconhece fica como veio. */
export function formatPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let d = raw.replace(/\D/g, '')
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return raw
}

/** Nome do arquivo: OS-0007-pulverizacao-T03.pdf */
export function orderFileName(number: number, kind: OrderKind, where?: string | null) {
  const slug = (where ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '')
  return `OS-${orderNumber(number)}-${kind}${slug ? `-${slug}` : ''}.pdf`
}

/**
 * Calda: volume total e numero de tanques. Com a capacidade do tanque,
 * cada produto tambem sai "por tanque" — e' o que o aplicador mede.
 */
export function sprayMix(areaHa: number | null, sprayLha: number | null, tankL: number | null) {
  const totalL = areaHa && sprayLha ? areaHa * sprayLha : null
  const tanks = totalL && tankL ? totalL / tankL : null
  return { totalL, tanks, tanksRounded: tanks ? Math.ceil(tanks - 1e-9) : null }
}
