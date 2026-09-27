/**
 * Calculos de lancamento — usados no formulario (ao vivo) e no servidor.
 *
 * Principio do produto: o produtor informa o que viu no campo (dose, area,
 * litros de calda); quantidade gasta e custo sao calculados, nunca pedidos.
 * Rodam igual nos dois lados, entao o valor que aparece na tela e' o mesmo
 * que o servidor grava quando o campo fica em branco.
 */

/** Unidades convertiveis entre si, com o fator para a unidade base. */
const FAMILY: Record<string, { family: 'volume' | 'massa'; factor: number }> = {
  L: { family: 'volume', factor: 1 },
  mL: { family: 'volume', factor: 0.001 },
  kg: { family: 'massa', factor: 1 },
  g: { family: 'massa', factor: 0.001 },
  t: { family: 'massa', factor: 1000 },
}

export const DOSE_UNITS = ['L/ha', 'mL/ha', 'kg/ha', 'g/ha', 'L/100L', 'mL/100L', 'kg/100L', 'g/100L'] as const
export type DoseUnit = (typeof DOSE_UNITS)[number]

export type QtyResult =
  | { ok: true; quantity: number }
  | { ok: false; reason: string }

/** Converte uma quantidade entre unidades da mesma familia (L<->mL, kg<->g<->t). */
export function convert(value: number, from: string, to: string): number | null {
  if (from === to) return value
  const a = FAMILY[from]
  const b = FAMILY[to]
  if (!a || !b || a.family !== b.family) return null
  return (value * a.factor) / b.factor
}

/**
 * Quantidade de produto gasta na pulverizacao, na unidade do estoque.
 *
 * - dose por hectare (L/ha, kg/ha...): dose x area
 * - dose por 100 L de calda (mL/100L...): dose x (calda por ha x area / 100)
 */
export function sprayQuantity(p: {
  dose: number | null
  doseUnit: string
  areaHa: number | null
  sprayLha: number | null
  productUnit: string | null
}): QtyResult {
  if (!p.dose || p.dose <= 0) return { ok: false, reason: 'Informe a dose.' }
  if (!p.areaHa || p.areaHa <= 0) return { ok: false, reason: 'Informe a área aplicada.' }
  if (!p.productUnit) return { ok: false, reason: 'Escolha o produto do estoque.' }

  const [doseUnit, basis] = p.doseUnit.split('/')
  let amount: number
  if (basis === 'ha') {
    amount = p.dose * p.areaHa
  } else {
    if (!p.sprayLha || p.sprayLha <= 0)
      return { ok: false, reason: 'Dose por 100 L precisa do volume de calda por hectare.' }
    amount = p.dose * ((p.sprayLha * p.areaHa) / 100)
  }

  const quantity = convert(amount, doseUnit, p.productUnit)
  if (quantity === null)
    return {
      ok: false,
      reason: `O produto está em ${p.productUnit} e a dose em ${doseUnit}: não dá para converter. Ajuste a unidade da dose.`,
    }
  return { ok: true, quantity: round(quantity, 3) }
}

/** Custo = quantidade gasta x custo medio do estoque. */
export function stockCost(quantity: number | null, unitCost: number | null): number | null {
  if (quantity === null || unitCost === null || unitCost <= 0) return null
  return round(quantity * unitCost, 2)
}

export function round(v: number, digits: number) {
  const f = 10 ** digits
  return Math.round(v * f) / f
}

/** "12,5" (pt-BR) -> 12.5; vazio -> null. */
export function parseBr(v: string | null | undefined): number | null {
  const s = (v ?? '').trim()
  if (!s) return null
  const n = Number(s.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** 12.5 -> "12,5" para preencher campos. */
export function toBr(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return ''
  return String(round(v, digits)).replace('.', ',')
}
