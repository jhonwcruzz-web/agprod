import Link from 'next/link'
import type { Metadata } from 'next'
import { SignUpForm } from './SignUpForm'

export const metadata: Metadata = { title: 'Criar conta' }

export default function CriarContaPage() {
  return (
    <div>
      <h1 className="text-center text-3xl font-semibold tracking-tighter">Criar conta</h1>
      <p className="mt-2 text-center text-sm text-text-muted">
        Grátis para começar. Em poucos minutos sua propriedade está cadastrada.
      </p>

      <SignUpForm />

      <p className="mt-8 border-t border-line pt-6 text-center text-sm text-text-muted">
        Já tem conta?{' '}
        <Link href="/entrar" className="font-medium text-text underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}
