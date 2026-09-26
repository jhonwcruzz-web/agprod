import type { Metadata } from 'next'
import { SparkleIcon } from '@phosphor-icons/react/dist/ssr'
import { requireFarm } from '@/lib/farm'
import { Chat } from './Chat'

export const metadata: Metadata = { title: 'Perguntar sobre minha fazenda' }

export default async function AssistentePage() {
  const ctx = await requireFarm()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-accent-text">
          <SparkleIcon size={14} weight="fill" />
          Assistente
        </p>
        <h1 className="mt-3 max-w-[20ch] text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          Pergunte sobre sua fazenda
        </h1>
        <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-text-muted">
          As respostas usam os números de {ctx.farm.name}
          {ctx.season ? `, safra ${ctx.season.name}` : ''}. Você também pode descrever o que
          aconteceu — &ldquo;hoje colhi 900 kg de Vitória no P-03&rdquo; — que eu monto o
          lançamento para você conferir.
        </p>
      </header>

      <Chat />
    </div>
  )
}
