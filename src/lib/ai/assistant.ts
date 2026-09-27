import Anthropic from '@anthropic-ai/sdk'
import type { FarmSnapshot } from './snapshot'
import { answerLocally } from './local-answers'

/** Proposta de lancamento que a IA monta a partir de texto livre (secao 30). */
export type ProposedRecord = {
  tipo: 'colheita' | 'aplicacao' | 'adubacao' | 'irrigacao' | 'venda' | 'despesa' | 'compra'
  resumo: string
  campos: Record<string, string | number | null>
  faltando: string[]
}

export type AssistantReply = {
  text: string
  proposal?: ProposedRecord
  /** true quando a resposta veio do motor local (sem chave de API). */
  offline: boolean
}

const MODEL = 'claude-opus-5'

const SYSTEM = `Você é o assistente da AGPROD, um sistema de gestão para pequenos produtores rurais de uva e manga no Brasil.

COMO RESPONDER
- Fale português do Brasil, de forma simples e direta, como quem conversa com um produtor rural. Nada de jargão de software.
- Respostas curtas: duas ou três frases. Sem listas longas, sem markdown pesado.
- Valores em reais no formato R$ 1.234,56 e quantidades em kg.

REGRA MAIS IMPORTANTE
- Os números da propriedade estão no bloco DADOS. Use SOMENTE esses números.
- NUNCA calcule nada por conta própria além de somas e subtrações simples entre os valores fornecidos. Os totais, custo por kg e preço médio já vêm prontos — repita-os, não recalcule.
- Se a informação não estiver nos DADOS, diga que ainda não há esse registro no sistema e indique onde registrar.

LIMITE DO SEU PAPEL
- Você organiza, interpreta, calcula, explica, compara e alerta. Você NÃO prescreve manejo agronômico.
- Se a pergunta pedir recomendação técnica (qual produto aplicar, qual dose, como tratar uma doença), responda o que os dados mostram e encerre com: "Informação técnica sujeita à validação do responsável técnico."

REGISTRO POR TEXTO
- Quando a pessoa descrever algo que aconteceu ("hoje colhi 900 kg de Vitória no P-03", "comprei 10 sacos de 20-05-20 por R$ 230 cada"), chame a ferramenta propor_lancamento.
- Nunca invente dados que a pessoa não informou. O que faltar vai na lista "faltando".
- Você apenas propõe. Quem confirma e grava é a pessoa.`

const TOOL: Anthropic.Tool = {
  name: 'propor_lancamento',
  description:
    'Propõe um lançamento a partir da descrição em texto livre do produtor. Use sempre que a mensagem relatar um fato que deve virar registro: colheita, aplicação, adubação, irrigação, venda, despesa ou compra de insumo.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      tipo: {
        type: 'string',
        enum: ['colheita', 'aplicacao', 'adubacao', 'irrigacao', 'venda', 'despesa', 'compra'],
        description: 'Que tipo de lançamento a pessoa descreveu.',
      },
      resumo: {
        type: 'string',
        description: 'Uma frase confirmando o que será registrado, na voz do sistema.',
      },
      campos: {
        type: 'object',
        additionalProperties: false,
        description: 'Somente os campos que a pessoa realmente informou.',
        properties: {
          data: { type: ['string', 'null'], description: 'AAAA-MM-DD' },
          talhao: { type: ['string', 'null'], description: 'Código do talhão, ex.: P-03' },
          variedade: { type: ['string', 'null'] },
          produto: { type: ['string', 'null'] },
          quantidade: { type: ['number', 'null'] },
          unidade: { type: ['string', 'null'], description: 'kg, caixa, L, saco, unidade' },
          preco_unitario: { type: ['number', 'null'], description: 'Em reais' },
          valor_total: { type: ['number', 'null'], description: 'Em reais' },
          comprador: { type: ['string', 'null'] },
          categoria: { type: ['string', 'null'], description: 'Para despesas' },
          observacao: { type: ['string', 'null'] },
        },
        required: [
          'data','talhao','variedade','produto','quantidade','unidade',
          'preco_unitario','valor_total','comprador','categoria','observacao',
        ],
      },
      faltando: {
        type: 'array',
        items: { type: 'string' },
        description: 'Campos essenciais que a pessoa não informou e precisam ser perguntados.',
      },
    },
    required: ['tipo', 'resumo', 'campos', 'faltando'],
  },
}

/** Monta o bloco DADOS. Fica separado do system para manter o prefixo cacheável. */
function renderSnapshot(s: FarmSnapshot): string {
  const brl = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const kg = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`

  const lines = [
    `Propriedade: ${s.farm.name}${s.farm.city ? ` — ${s.farm.city}/${s.farm.state ?? ''}` : ''}`,
    `Área total: ${s.farm.area} ${s.farm.areaUnit}`,
    `Safra: ${s.season ?? 'nenhuma safra ativa'}`,
    '',
    'TOTAIS DA SAFRA',
    `Produção: ${kg(s.totals.productionKg)}`,
    `Vendido: ${kg(s.totals.soldKg)}`,
    `Receita: ${brl(s.totals.revenue)}`,
    `Já recebido: ${brl(s.totals.received)}`,
    `A receber: ${brl(s.totals.receivable)}`,
    `Custo de produção: ${brl(s.totals.productionCost)}`,
    `Saída de caixa total: ${brl(s.totals.cashOut)}`,
    `A pagar: ${brl(s.totals.payable)}`,
    `Resultado: ${brl(s.totals.result)}`,
    `Custo por kg: ${s.totals.costPerKg !== null ? brl(s.totals.costPerKg) : 'sem produção registrada'}`,
    `Preço médio de venda por kg: ${s.totals.avgPricePerKg !== null ? brl(s.totals.avgPricePerKg) : 'sem vendas'}`,
    `Despesas do mês ${s.monthExpenses.month}: ${brl(s.monthExpenses.total)}`,
  ]

  if (s.plots.length) {
    lines.push('', 'TALHÕES')
    for (const p of s.plots) {
      lines.push(
        `${p.code} | ${[p.crop, p.variety].filter(Boolean).join(' ') || 'sem cultura'} | ${p.areaHa} ha | produção ${kg(p.productionKg)} | custo ${brl(p.cost)} | custo/kg ${p.costPerKg !== null ? brl(p.costPerKg) : '—'} | receita ${brl(p.revenue)} | resultado ${brl(p.result)}`,
      )
    }
  }

  if (s.costsByCategory.length) {
    lines.push('', 'CUSTOS POR CATEGORIA')
    for (const c of s.costsByCategory) lines.push(`${c.category}: ${brl(c.amount)}`)
  }

  if (s.stock.length) {
    lines.push('', 'ESTOQUE')
    for (const i of s.stock) {
      lines.push(
        `${i.name}: ${i.current} ${i.unit} (mínimo ${i.min} ${i.unit}) — ${i.level}`,
      )
    }
  }

  if (s.buyers.length) {
    lines.push('', 'COMPRADORES')
    for (const b of s.buyers) {
      lines.push(
        `${b.name}: ${kg(b.kg)} | ${brl(b.amount)} | preço médio ${b.avgPrice !== null ? brl(b.avgPrice) : '—'}`,
      )
    }
  }

  if (s.openSales.length) {
    lines.push('', 'VENDAS EM ABERTO')
    for (const v of s.openSales) {
      lines.push(
        `${v.buyer}: falta ${brl(v.pending)} de ${brl(v.amount)}${v.dueDate ? ` — vence em ${v.dueDate}` : ''}`,
      )
    }
  }

  return lines.join('\n')
}

export type Turn = { role: 'user' | 'assistant'; content: string }

export async function askAssistant(
  snapshot: FarmSnapshot,
  history: Turn[],
  question: string,
): Promise<AssistantReply> {
  // Sem credencial configurada, o motor local responde as perguntas do
  // dia a dia a partir do mesmo snapshot. O recurso nunca fica indisponivel.
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ...answerLocally(snapshot, question), offline: true }
  }

  const client = new Anthropic()

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      // Pergunta simples sobre dados prontos: esforco baixo responde melhor
      // e mais barato do que deixar o modelo divagar.
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `DADOS\n${renderSnapshot(snapshot)}` },
      ],
      tools: [TOOL],
      messages: [
        ...history.slice(-8).map((t) => ({ role: t.role, content: t.content })),
        { role: 'user' as const, content: question },
      ],
    })

    if (response.stop_reason === 'refusal') {
      return {
        text: 'Não consigo responder isso. Tente perguntar sobre os números da sua propriedade.',
        offline: false,
      }
    }

    let text = ''
    let proposal: ProposedRecord | undefined

    for (const block of response.content) {
      if (block.type === 'text') text += block.text
      if (block.type === 'tool_use' && block.name === 'propor_lancamento') {
        proposal = block.input as ProposedRecord
      }
    }

    if (!text && proposal) text = proposal.resumo

    return { text: text.trim(), proposal, offline: false }
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return { text: 'Muitas perguntas ao mesmo tempo. Tente de novo em instantes.', offline: false }
    }
    if (error instanceof Anthropic.AuthenticationError) {
      // Chave invalida nao deve derrubar o recurso: cai para o motor local.
      return { ...answerLocally(snapshot, question), offline: true }
    }
    if (error instanceof Anthropic.APIError) {
      return { ...answerLocally(snapshot, question), offline: true }
    }
    throw error
  }
}
