import Link from 'next/link'
import type { Metadata } from 'next'
import { SignUpForm } from './SignUpForm'

export const metadata: Metadata = { title: 'Criar conta' }

export default function CriarContaPage() {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-accent-text lg:hidden">
        Academia da Uva PRO
      </p>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight lg:mt-0">Criar conta</h1>
      <p className="mt-2 text-sm text-text-muted">
        Em poucos minutos sua propriedade está cadastrada.
      </p>

      <SignUpForm />

      <p className="mt-8 border-t border-line pt-6 text-sm text-text-muted">
        Já tem conta?{' '}
        <Link href="/entrar" className="font-medium text-accent-text hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}
