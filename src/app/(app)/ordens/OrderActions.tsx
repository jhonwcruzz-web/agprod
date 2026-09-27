'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useState, useTransition } from 'react'
import {
  ArrowCounterClockwiseIcon,
  CheckIcon,
  FilePdfIcon,
  ProhibitIcon,
  WhatsappLogoIcon,
} from '@phosphor-icons/react/dist/ssr'
import { completeSprayOrder, setOrderStatus } from '@/lib/actions/orders'
import { today } from '@/lib/format'
import { whatsappPhone, type OrderKind, type OrderStatus } from '@/lib/orders'

const btn =
  'press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-line-strong px-2.5 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-accent-text disabled:opacity-50'

/**
 * Acoes de uma OS. "Enviar" manda o PDF pelo WhatsApp:
 *  - celular: abre o menu de compartilhar do aparelho com o PDF anexado
 *    (escolhe-se o WhatsApp e o contato);
 *  - computador: baixa o PDF e abre o WhatsApp Web na conversa do
 *    executor com a mensagem pronta — e' so' anexar o arquivo baixado.
 */
export function OrderActions({
  id,
  kind,
  status,
  phone,
  fileName,
  message,
  completeHref,
}: {
  id: string
  kind: OrderKind
  status: OrderStatus
  phone: string | null
  fileName: string
  message: string
  completeHref?: Route
}) {
  const [pending, start] = useTransition()
  const [sending, setSending] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const pdfHref = `/api/os/${id}/pdf`

  async function send() {
    setSending(true)
    setNote(null)
    try {
      const res = await fetch(`${pdfHref}?baixar=1`)
      if (!res.ok) throw new Error('Não consegui gerar o PDF.')
      const file = new File([await res.blob()], fileName, { type: 'application/pdf' })

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: fileName, text: message })
          return
        } catch (e) {
          if ((e as Error).name === 'AbortError') return // o produtor desistiu
        }
      }

      // Computador: baixa e abre a conversa.
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      const wa = whatsappPhone(phone)
      window.open(
        `https://wa.me/${wa ?? ''}?text=${encodeURIComponent(message)}`,
        '_blank',
        'noopener',
      )
      setNote('PDF baixado — anexe o arquivo na conversa do WhatsApp.')
    } catch (e) {
      setNote((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  function run(fn: () => Promise<{ error?: string }>) {
    start(async () => {
      const r = await fn()
      if (r.error) setNote(r.error)
    })
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex flex-wrap gap-1.5 sm:justify-end">
        <a href={pdfHref} target="_blank" rel="noopener" className={btn}>
          <FilePdfIcon size={15} /> PDF
        </a>
        <button type="button" onClick={send} disabled={sending} className={btn}>
          <WhatsappLogoIcon size={15} /> {sending ? 'Gerando…' : 'Enviar'}
        </button>

        {status === 'aberta' &&
          (kind === 'pulverizacao' ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm('Marcar a pulverização como feita hoje? O estoque é baixado e o custo lançado.'))
                  run(() => completeSprayOrder(id, today()))
              }}
              className={btn}
            >
              <CheckIcon size={15} weight="bold" /> Concluir
            </button>
          ) : (
            completeHref && (
              <Link href={completeHref} className={btn}>
                <CheckIcon size={15} weight="bold" /> {kind === 'colheita' ? 'Registrar colheita' : 'Registrar manutenção'}
              </Link>
            )
          ))}

        {status === 'aberta' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm('Cancelar esta ordem de serviço?')) run(() => setOrderStatus(id, 'cancelada'))
            }}
            className={btn}
            title="Cancelar"
          >
            <ProhibitIcon size={15} />
            <span className="sr-only">Cancelar</span>
          </button>
        )}
        {status === 'cancelada' && (
          <button type="button" disabled={pending} onClick={() => run(() => setOrderStatus(id, 'aberta'))} className={btn}>
            <ArrowCounterClockwiseIcon size={15} /> Reabrir
          </button>
        )}
      </div>
      {note && <p className="max-w-[40ch] text-xs text-text-muted sm:text-right">{note}</p>}
    </div>
  )
}
