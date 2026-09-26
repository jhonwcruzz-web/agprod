'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Route } from 'next'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export type AuthState = { error?: string; message?: string }

const credentials = z.object({
  email: z.email('E-mail inválido').trim().toLowerCase(),
  password: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres'),
})

const signUpSchema = credentials.extend({
  fullName: z.string().trim().min(2, 'Informe seu nome'),
  phone: z.string().trim().optional(),
})

/** Mensagens do Supabase em ingles traduzidas, sem revelar se o e-mail existe. */
function translate(message: string) {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (m.includes('user already registered')) return 'Este e-mail já tem conta. Tente entrar.'
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Muitas tentativas. Aguarde alguns minutos.'
  if (m.includes('password')) return 'Senha fora do padrão exigido.'
  return 'Não foi possível concluir. Tente novamente.'
}

/** Origem publica da requisicao (respeita o proxy da Vercel). */
async function siteOrigin() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: translate(error.message) }

  const destino = String(formData.get('destino') || '/')
  // So' aceita caminho interno: evita open redirect via ?destino=
  const safe = destino.startsWith('/') && !destino.startsWith('//') ? destino : '/'

  revalidatePath('/', 'layout')
  redirect(safe as Route)
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
    phone: formData.get('phone'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // O link do e-mail de confirmacao volta para o mesmo endereco onde a
      // pessoa se cadastrou (localhost em dev, o dominio da Vercel em
      // producao). O dominio tambem precisa estar em Redirect URLs no Supabase.
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/primeiros-passos`,
      // Vai para raw_user_meta_data. NUNCA usar esses campos em decisao de
      // autorizacao: o proprio usuario consegue edita-los.
      data: { full_name: parsed.data.fullName, phone: parsed.data.phone ?? null },
    },
  })
  if (error) return { error: translate(error.message) }

  if (!data.session) {
    return { message: 'Enviamos um link de confirmação para o seu e-mail.' }
  }

  revalidatePath('/', 'layout')
  redirect('/primeiros-passos')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/entrar')
}
