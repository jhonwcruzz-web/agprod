import { isAuthRetryableFetchError, type SupabaseClient, type User } from '@supabase/supabase-js'

export type UserCheck =
  | { status: 'authenticated'; user: User }
  | { status: 'anonymous' }
  /** O servidor de autenticacao nao respondeu — nao sabemos se ha' sessao. */
  | { status: 'unreachable' }

// ~4s no total. Medido: no primeiro carregamento do servidor de dev, com o
// disco lento, a chamada falha ("fetch failed") por alguns segundos e
// depois volta. Com servidor saudavel, nenhuma espera acontece.
const RETRY_DELAYS_MS = [300, 1000, 2500]

/**
 * Valida a sessao com o servidor de auth, tentando de novo em falha de rede.
 *
 * Existe porque "nao consegui perguntar" e "nao ha' sessao" sao coisas
 * diferentes. Tratar os dois igual jogava o produtor na tela de login a
 * cada soluco de rede — ou a cada compilacao lenta do servidor de dev, que
 * atrasava a chamada ate' ela estourar.
 */
export async function resolveUser(supabase: SupabaseClient): Promise<UserCheck> {
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await supabase.auth.getUser()

    if (!error) {
      return data.user ? { status: 'authenticated', user: data.user } : { status: 'anonymous' }
    }

    // Token invalido, expirado ou ausente: resposta definitiva do servidor.
    if (!isAuthRetryableFetchError(error)) return { status: 'anonymous' }

    if (process.env.NODE_ENV !== 'production') {
      const cause = (error as { cause?: { code?: string; message?: string } }).cause
      console.warn(
        `[auth] servidor de autenticacao nao respondeu (tentativa ${attempt + 1}):`,
        error.message,
        cause?.code ?? cause?.message ?? '',
      )
    }

    if (attempt >= RETRY_DELAYS_MS.length) return { status: 'unreachable' }
    await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]))
  }
}
