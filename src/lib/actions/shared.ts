import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getFarmContext } from '@/lib/farm'

export type ActionState = { error?: string; message?: string; fieldErrors?: Record<string, string> }

/*
 * IMPORTANTE — o .optional() antes do .transform() nao e' redundante.
 *
 * No zod 4, "a chave nao veio no formulario" e' diferente de "veio vazia".
 * Aceitar undefined dentro do union NAO torna a chave opcional: sem o
 * .optional(), todo campo condicional que nao esta na tela (peso da caixa
 * quando a unidade e' kg, horimetro de um implemento, vencimento de uma
 * despesa ja' paga...) derrubava o envio com
 * "Invalid input: expected nonoptional, received undefined".
 */

/** Converte "12,4" (pt-BR) em 12.4. Campo vazio ou ausente vira null. */
export const decimal = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === '') return null
    const n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : null
  })

export const requiredDecimal = decimal.refine((v): v is number => v !== null, 'Informe um número')

export const optionalText = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => {
    const s = typeof v === 'string' ? v.trim() : ''
    return s === '' ? null : s
  })

/** Select vazio ("") precisa virar null, nao string vazia, para o FK aceitar. */
export const optionalUuid = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (typeof v === 'string' && v.length === 36 ? v : null))

export const optionalDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null))

export function formToObject(formData: FormData) {
  const out: Record<string, string> = {}
  for (const [k, v] of formData.entries()) if (typeof v === 'string') out[k] = v
  return out
}

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Dados inválidos.'
}

/**
 * Contexto exigido por toda Server Action de escrita.
 *
 * O farm_id vem SEMPRE daqui, nunca do formulario: se viesse do cliente,
 * um usuario poderia gravar na propriedade de outro (o RLS barraria, mas a
 * validacao correta e' nao deixar a tentativa sair do servidor).
 */
export async function requireWriteContext() {
  const ctx = await getFarmContext()
  if (!ctx) return { error: 'Nenhuma propriedade ativa.' as const }
  if (ctx.role === 'viewer') return { error: 'Seu perfil é somente leitura.' as const }
  const supabase = await createClient()
  return { ctx, supabase }
}

export function dbError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('duplicate key')) return 'Já existe um registro com esse identificador.'
  if (m.includes('violates foreign key')) return 'Referência inválida — recarregue a página.'
  if (m.includes('violates row-level security'))
    return 'Você não tem permissão para gravar nesta propriedade.'
  if (m.includes('violates check constraint')) return 'Algum valor está fora do permitido.'
  return 'Não foi possível salvar. Tente novamente.'
}
