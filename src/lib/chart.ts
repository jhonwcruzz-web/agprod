/** Cor de grafico da posicao i (tokens --chart-1..6 do tema, em ciclo). */
export function chartColor(i: number) {
  return `var(--chart-${(i % 6) + 1})`
}
