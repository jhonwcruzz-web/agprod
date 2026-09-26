import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Troca o code do link de e-mail/OAuth por uma sessao. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  // So' caminho interno: bloqueia open redirect.
  const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${safe}`)
  }

  return NextResponse.redirect(`${origin}/entrar?erro=link_invalido`)
}
