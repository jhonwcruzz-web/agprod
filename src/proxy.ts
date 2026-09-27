import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { resolveUser } from '@/lib/supabase/resolve-user'

/** Rotas acessiveis sem sessao. */
const PUBLIC_PATHS = ['/entrar', '/criar-conta', '/recuperar-senha', '/auth']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Renova a sessao. Precisa vir antes de qualquer decisao de rota.
  const check = await resolveUser(supabase)

  // Servidor de auth inacessivel: nao da' para afirmar que nao ha' sessao,
  // entao nao manda para o login. O proxy nao e' a barreira de seguranca —
  // o RLS e' — e a pagina valida a sessao de novo e mostra o erro.
  if (check.status === 'unreachable') return response

  const user = check.status === 'authenticated' ? check.user : null
  const { pathname, search } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/entrar'
    // Os parametros da pagina (ex.: ?aba=) vao dentro do destino, nao
    // soltos na URL de login — assim a volta cai na mesma aba.
    url.search = ''
    url.searchParams.set('destino', pathname + search)
    return NextResponse.redirect(url)
  }

  if (user && (pathname === '/entrar' || pathname === '/criar-conta')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    // Tudo, menos estaticos e imagens — esses nao precisam de sessao.
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
