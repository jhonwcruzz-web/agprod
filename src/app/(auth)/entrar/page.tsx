import Link from 'next/link'
import type { Metadata } from 'next'
import { SignInForm } from './SignInForm'

export const metadata: Metadata = { title: 'Entrar' }

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>
}) {
  const { destino } = await searchParams

  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-accent-text lg:hidden">
        Academia da Uva PRO
      </p>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight lg:mt-0">Entrar</h1>
      <p className="mt-2 text-sm text-text-muted">
        Acesse o painel da sua propriedade.
      </p>

      <SignInForm destino={destino} />

      <p className="mt-8 border-t border-line pt-6 text-sm text-text-muted">
        Ainda não tem conta?{' '}
        <Link href="/criar-conta" className="font-medium text-accent-text hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  )
}
