import type { FarmSnapshot } from './snapshot'

/**
 * Motor local de respostas.
 *
 * Responde as perguntas do dia a dia (secao 29 do escopo) diretamente do
 * snapshot, sem chamar modelo nenhum. Existe por dois motivos: o recurso
 * funciona antes de configurar a chave da API, e uma falha de rede nunca
 * deixa o produtor sem resposta.
 */

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const kg = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`

/** Remove acentos para o casamento de palavras-chave. */
const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

type Rule = {
  test: (q: string) => boolean
  answer: (s: FarmSnapshot) => string
}

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w))

const RULES: Rule[] = [
  {
    test: (q) => has(q, 'atencao', 'pendencia', 'problema', 'alerta'),
    answer: (s) => {
      const parts: string[] = []
      const low = s.stock.filter((i) => i.level !== 'normal')
      if (low.length) {
        parts.push(
          `${low.length} produto${low.length > 1 ? 's' : ''} abaixo do mínimo no estoque (${low
            .slice(0, 3)
            .map((i) => i.name)
            .join(', ')})`,
        )
      }
      if (s.totals.receivable > 0) parts.push(`${brl(s.totals.receivable)} a receber`)
      if (s.totals.payable > 0) parts.push(`${brl(s.totals.payable)} a pagar`)
      if (!parts.length) return 'Nada pendente no momento. Estoque em dia e nenhuma conta em aberto.'
      return `Precisa da sua atenção: ${parts.join('; ')}.`
    },
  },
  {
    test: (q) => has(q, 'gastei', 'gasto', 'despesa', 'custo') && has(q, 'mes', 'mês'),
    answer: (s) =>
      `Neste mês saíram ${brl(s.monthExpenses.total)} da propriedade. No total da safra, o custo de produção está em ${brl(s.totals.productionCost)}.`,
  },
  {
    test: (q) => has(q, 'custo') && has(q, 'kg', 'quilo'),
    answer: (s) =>
      s.totals.costPerKg === null
        ? 'Ainda não dá para calcular o custo por quilo: falta registrar produção.'
        : `Seu custo está em ${brl(s.totals.costPerKg)} por quilo. Isso vem de ${brl(s.totals.productionCost)} de custo para ${kg(s.totals.productionKg)} produzidos.`,
  },
  {
    test: (q) => has(q, 'talhao', 'talhão') && has(q, 'maior custo', 'mais caro', 'maior gasto'),
    answer: (s) => {
      const top = [...s.plots].sort((a, b) => b.cost - a.cost)[0]
      if (!top || top.cost === 0) return 'Nenhum custo foi lançado em talhão ainda.'
      return `O talhão ${top.code} teve o maior custo: ${brl(top.cost)}${
        top.costPerKg !== null ? `, o que dá ${brl(top.costPerKg)} por quilo` : ''
      }.`
    },
  },
  {
    test: (q) => has(q, 'talhao', 'talhão') && has(q, 'melhor', 'resultado', 'lucro'),
    answer: (s) => {
      const top = [...s.plots].sort((a, b) => b.result - a.result)[0]
      if (!top) return 'Nenhum talhão cadastrado ainda.'
      return `O melhor resultado é do talhão ${top.code}: ${brl(top.result)}, com ${kg(top.productionKg)} produzidos.`
    },
  },
  {
    test: (q) => has(q, 'receber', 'me devem', 'pendente de pagamento'),
    answer: (s) => {
      if (s.totals.receivable <= 0) return 'Você não tem nada a receber no momento.'
      const list = s.openSales
        .slice(0, 3)
        .map((v) => `${v.buyer} (${brl(v.pending)})`)
        .join(', ')
      return `Você tem ${brl(s.totals.receivable)} a receber${list ? `: ${list}` : ''}.`
    },
  },
  {
    test: (q) => has(q, 'pagar', 'devo', 'conta'),
    answer: (s) =>
      s.totals.payable > 0
        ? `Você tem ${brl(s.totals.payable)} em contas a pagar.`
        : 'Não há contas em aberto.',
  },
  {
    test: (q) => has(q, 'estoque', 'sobrou de produto', 'tenho de produto'),
    answer: (s) => {
      if (!s.stock.length) return 'Nenhum produto cadastrado no estoque ainda.'
      const low = s.stock.filter((i) => i.level !== 'normal')
      const head = s.stock
        .slice(0, 4)
        .map((i) => `${i.name}: ${i.current} ${i.unit}`)
        .join('; ')
      return `${head}.${low.length ? ` Atenção: ${low.map((i) => i.name).join(', ')} abaixo do mínimo.` : ''}`
    },
  },
  {
    test: (q) => has(q, 'vendi', 'venda', 'vendeu'),
    answer: (s) =>
      s.totals.soldKg === 0
        ? 'Nenhuma venda registrada nesta safra.'
        : `Você vendeu ${kg(s.totals.soldKg)} por ${brl(s.totals.revenue)}${
            s.totals.avgPricePerKg !== null
              ? `, a um preço médio de ${brl(s.totals.avgPricePerKg)} por quilo`
              : ''
          }. Desse valor, ${brl(s.totals.received)} já entrou.`,
  },
  {
    test: (q) => has(q, 'comprador', 'quem paga melhor', 'melhor preco', 'melhor preço'),
    answer: (s) => {
      const best = [...s.buyers].sort((a, b) => (b.avgPrice ?? 0) - (a.avgPrice ?? 0))[0]
      if (!best) return 'Nenhuma venda registrada ainda.'
      return `Quem paga melhor é ${best.name}: ${best.avgPrice !== null ? brl(best.avgPrice) : '—'} por quilo, em ${kg(best.kg)} comprados.`
    },
  },
  {
    test: (q) => has(q, 'produzi', 'producao', 'produção', 'colhi', 'colheita'),
    answer: (s) => {
      if (s.totals.productionKg === 0) return 'Nenhuma colheita registrada nesta safra.'
      const perHa = s.farm.area > 0 ? s.totals.productionKg / s.farm.area : null
      return `Você produziu ${kg(s.totals.productionKg)} nesta safra${
        perHa ? `, o que dá ${kg(perHa)} por hectare` : ''
      }.`
    },
  },
  {
    test: (q) => has(q, 'resultado', 'lucro', 'ganhei', 'sobrou'),
    answer: (s) =>
      `Nesta safra o resultado está em ${brl(s.totals.result)}: ${brl(s.totals.revenue)} de receita menos ${brl(s.totals.productionCost)} de custo de produção.`,
  },
  {
    test: (q) => has(q, 'resumo', 'como esta', 'como está', 'panorama', 'situacao', 'situação'),
    answer: (s) =>
      `${s.farm.name}: ${kg(s.totals.productionKg)} produzidos, ${brl(s.totals.revenue)} de receita, ${brl(s.totals.productionCost)} de custo e ${brl(s.totals.result)} de resultado${
        s.totals.costPerKg !== null ? `, a ${brl(s.totals.costPerKg)} por quilo` : ''
      }.`,
  },
]

const FALLBACK =
  'Ainda não consigo responder isso sozinho. Posso falar sobre produção, custos, custo por quilo, vendas, valores a receber, estoque e o que precisa de atenção.'

export function answerLocally(
  snapshot: FarmSnapshot,
  question: string,
): { text: string } {
  const q = norm(question)
  const rule = RULES.find((r) => r.test(q))
  return { text: rule ? rule.answer(snapshot) : FALLBACK }
}
