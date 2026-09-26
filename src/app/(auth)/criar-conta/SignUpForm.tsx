'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react/dist/ssr'
import { signUp, type AuthState } from '../actions'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? 'Criando…' : 'Criar conta'}
    </Button>
  )
}

export function SignUpForm() {
  const [state, action] = useActionState<AuthState, FormData>(signUp, {})

  if (state.message) {
    return (
      <div className="mt-8 flex items-start gap-3 rounded-lg bg-accent-soft px-4 py-4">
        <CheckCircleIcon size={20} weight="fill" className="mt-px shrink-0 text-accent" />
        <p className="text-sm text-accent-text">{state.message}</p>
      </div>
    )
  }

  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <Field label="Seu nome" htmlFor="fullName" required>
        <Input id="fullName" name="fullName" autoComplete="name" required placeholder="João da Silva" />
      </Field>

      <Field label="E-mail" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="voce@exemplo.com"
        />
      </Field>

      <Field label="Telefone" htmlFor="phone" hint="Opcional. Usado para o WhatsApp no futuro.">
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="(87) 90000-0000"
        />
      </Field>

      <Field label="Senha" htmlFor="password" hint="Mínimo de 8 caracteres." required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          placeholder="••••••••"
        />
      </Field>

      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger"
        >
          <WarningCircleIcon size={18} weight="bold" className="mt-px shrink-0" />
          {state.error}
        </p>
      )}

      <Submit />
    </form>
  )
}
