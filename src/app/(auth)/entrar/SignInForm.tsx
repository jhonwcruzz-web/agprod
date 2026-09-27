'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/ssr'
import { signIn, type AuthState } from '../actions'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="ink" size="lg" disabled={pending} className="w-full">
      {pending ? 'Entrando…' : 'Entrar'}
    </Button>
  )
}

export function SignInForm({ destino }: { destino?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(signIn, {})

  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <input type="hidden" name="destino" value={destino ?? '/'} />

      <Field label="E-mail" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="voce@exemplo.com"
          aria-invalid={state.error ? true : undefined}
        />
      </Field>

      <Field label="Senha" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          aria-invalid={state.error ? true : undefined}
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
