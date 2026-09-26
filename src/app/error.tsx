'use client'

import { useEffect } from 'react'
import { ArrowClockwiseIcon, WifiSlashIcon } from '@phosphor-icons/react/dist/ssr'

/**
 * Erro inesperado ao carregar uma tela.
 *
 * Fica na raiz de app/ porque um error.tsx nao captura erros do layout do
 * proprio segmento — e e' no layout da area logada que a sessao e'
 * validada. Quando o servidor de autenticacao nao responde, o produtor
 * cai aqui (com "tentar de novo") em vez de ser jogado na tela de login.
 *
 * Em producao o Next nao repassa a mensagem de erro do servidor ao
 * navegador, entao o texto e' generico de proposito.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-6">
      <div className="w-full max-w-[420px]">
        <WifiSlashIcon size={28} className="text-text-faint" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          Não foi possível carregar agora
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          Pode ser a conexão com a internet ou uma instabilidade momentânea. Seus dados estão
          seguros — é só tentar de novo.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="press mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-on-accent transition-opacity hover:opacity-90"
        >
          <ArrowClockwiseIcon size={16} weight="bold" />
          Tentar de novo
        </button>
        {error.digest && (
          <p className="num mt-6 text-xs text-text-faint">Código: {error.digest}</p>
        )}
      </div>
    </main>
  )
}
