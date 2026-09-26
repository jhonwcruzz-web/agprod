import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/database'
import { resolveUser } from './resolve-user'

/** Cliente para Server Components, Route Handlers e Server Actions. */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component nao pode escrever cookie. O middleware ja'
            // renova a sessao, entao ignorar aqui e' seguro.
          }
        },
      },
    },
  )
}

export class AuthUnavailableError extends Error {
  constructor() {
    super('Não foi possível verificar sua sessão agora. Tente novamente em instantes.')
    this.name = 'AuthUnavailableError'
  }
}

/**
 * Usuario autenticado e verificado no servidor de auth.
 *
 * Sempre getUser(), nunca getSession(): a sessao vem do cookie e pode ser
 * forjada; getUser() valida o token contra o Supabase.
 *
 * Se o servidor de auth nao responder, lanca AuthUnavailableError em vez
 * de devolver null — null mandaria o produtor para o login como se a
 * sessao tivesse caido. O erro cai na tela "tentar de novo" (error.tsx).
 */
export async function getUser() {
  const supabase = await createClient()
  const check = await resolveUser(supabase)
  if (check.status === 'unreachable') throw new AuthUnavailableError()
  return check.status === 'authenticated' ? check.user : null
}
