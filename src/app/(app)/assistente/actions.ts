'use server'

import { requireFarm } from '@/lib/farm'
import { buildFarmSnapshot } from '@/lib/ai/snapshot'
import { askAssistant, type AssistantReply, type Turn } from '@/lib/ai/assistant'

export type AskState = {
  history: Turn[]
  reply?: AssistantReply
  error?: string
}

/**
 * Faz a pergunta contra o snapshot da propriedade ativa.
 *
 * O snapshot e' montado no servidor a cada pergunta, a partir do RLS do
 * usuario: nao ha' como perguntar sobre uma propriedade que nao e' sua.
 */
export async function ask(prev: AskState, formData: FormData): Promise<AskState> {
  const question = String(formData.get('pergunta') ?? '').trim()
  if (!question) return prev
  if (question.length > 500)
    return { ...prev, error: 'Pergunta muito longa. Tente resumir.' }

  const ctx = await requireFarm()

  try {
    const snapshot = await buildFarmSnapshot(ctx)
    const reply = await askAssistant(snapshot, prev.history, question)

    return {
      history: [
        ...prev.history,
        { role: 'user' as const, content: question },
        { role: 'assistant' as const, content: reply.text },
      ].slice(-12),
      reply,
    }
  } catch {
    return { ...prev, error: 'Não consegui responder agora. Tente novamente.' }
  }
}
