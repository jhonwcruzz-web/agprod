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
      <h1 className="text-3xl font-semibold tracking-tighter">Bom te ver de novo</h1>
      <p className="mt-2 text-sm text-text-muted">
        Entre para ver os números da sua propriedade.
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
