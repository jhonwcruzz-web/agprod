'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import type { Route } from 'next'
import {
  ArrowUpIcon,
  SparkleIcon,
  UserIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react/dist/ssr'
import { ask, type AskState } from './actions'
import type { ProposedRecord } from '@/lib/ai/assistant'

/** Atalhos das perguntas mais comuns (secao 29). */
const SUGGESTIONS = [
  'Quanto produzi nesta safra?',
  'Qual meu custo por kg?',
  'Quanto tenho a receber?',
  'Qual talhão teve maior custo?',
  'Quanto tenho no estoque?',
  'O que precisa da minha atenção?',
]

/** Para onde levar o produtor para concluir o lançamento proposto. */
const TARGET: Record<ProposedRecord['tipo'], Route> = {
  colheita: '/producao?novo=1',
  aplicacao: '/aplicacoes?novo=1',
  adubacao: '/adubacao?novo=1',
  irrigacao: '/irrigacao?novo=1',
  venda: '/comercializacao?novo=1',
  despesa: '/custos?novo=1',
  compra: '/estoque?novo=1',
}

const FIELD_LABEL: Record<string, string> = {
  data: 'Data',
  talhao: 'Talhão',
  variedade: 'Variedade',
  produto: 'Produto',
  quantidade: 'Quantidade',
  unidade: 'Unidade',
  preco_unitario: 'Preço unitário',
  valor_total: 'Valor total',
  comprador: 'Comprador',
  categoria: 'Categoria',
  observacao: 'Observação',
}

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Enviar pergunta"
      className="press absolute bottom-2 right-2 flex size-9 items-center justify-center rounded-md bg-accent text-on-accent transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      <ArrowUpIcon size={18} weight="bold" />
    </button>
  )
}

function Thinking() {
  const { pending } = useFormStatus()
  if (!pending) return null
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft">
        <SparkleIcon size={15} weight="fill" className="text-accent" />
      </span>
      <div className="flex-1 space-y-2 pt-1">
        <div className="shimmer h-3 w-3/5 rounded" />
        <div className="shimmer h-3 w-2/5 rounded" />
      </div>
    </div>
  )
}

function ProposalCard({ proposal }: { proposal: ProposedRecord }) {
  const filled = Object.entries(proposal.campos).filter(
    ([, v]) => v !== null && v !== '' && v !== undefined,
  )

  return (
    <div className="mt-3 rounded-lg border border-line-strong bg-bg-sunken p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
        Lançamento identificado · {proposal.tipo}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {filled.map(([key, value]) => (
          <div key={key}>
            <dt className="text-[10px] uppercase tracking-[0.1em] text-text-faint">
              {FIELD_LABEL[key] ?? key}
            </dt>
            <dd className="num mt-0.5 text-sm">{String(value)}</dd>
          </div>
        ))}
      </dl>

      {proposal.faltando.length > 0 && (
        <p className="mt-3 border-t border-line pt-3 text-xs text-warn">
          Falta informar: {proposal.faltando.join(', ')}.
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Link
          href={TARGET[proposal.tipo]}
          className="press inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-on-accent transition-opacity hover:opacity-90"
        >
          Conferir e registrar
        </Link>
        <span className="text-xs text-text-muted">
          Nada é gravado sem você confirmar.
        </span>
      </div>
    </div>
  )
}

export function Chat() {
  const [state, action] = useActionState<AskState, FormData>(ask, { history: [] })
  const endRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.history.length) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      formRef.current?.reset()
    }
  }, [state.history.length])

  const isEmpty = state.history.length === 0

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-6">
      {isEmpty ? (
        <div className="border-t border-line pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">
            Comece por aqui
          </p>
          <div className="stagger mt-4 grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={s}
                type="submit"
                name="pergunta"
                value={s}
                style={{ '--i': i } as React.CSSProperties}
                className="press rounded-md border border-line px-4 py-3 text-left text-sm text-text-muted transition-colors hover:border-accent hover:text-text"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 border-t border-line pt-6">
          {state.history.map((turn, i) => {
            const isLast = i === state.history.length - 1
            return (
              <div key={i} className="flex gap-3">
                <span
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
                    turn.role === 'user' ? 'bg-bg-sunken' : 'bg-accent-soft'
                  }`}
                >
                  {turn.role === 'user' ? (
                    <UserIcon size={14} className="text-text-muted" />
                  ) : (
                    <SparkleIcon size={15} weight="fill" className="text-accent" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm leading-relaxed ${
                      turn.role === 'user' ? 'text-text-muted' : 'text-text'
                    }`}
                  >
                    {turn.content}
                  </p>

                  {isLast && turn.role === 'assistant' && state.reply?.proposal && (
                    <ProposalCard proposal={state.reply.proposal} />
                  )}
                </div>
              </div>
            )
          })}
          <Thinking />
          <div ref={endRef} />
        </div>
      )}

      {state.error && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger"
        >
          <WarningCircleIcon size={17} weight="bold" />
          {state.error}
        </p>
      )}

      <div className="sticky bottom-20 lg:bottom-4">
        <div className="relative">
          <textarea
            name="pergunta"
            rows={2}
            maxLength={500}
            placeholder="Pergunte sobre sua fazenda ou descreva o que aconteceu…"
            className="w-full resize-none rounded-lg border border-line-strong bg-bg-raised py-3 pl-4 pr-14 text-sm leading-relaxed text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
          />
          <Submit />
        </div>

        <p className="mt-2 px-1 text-xs text-text-faint">
          {state.reply?.offline
            ? 'Respondendo com o motor local — configure ANTHROPIC_API_KEY para respostas em linguagem natural.'
            : 'Os números vêm direto dos seus registros. Enter envia, Shift+Enter quebra linha.'}
        </p>
      </div>
    </form>
  )
}
