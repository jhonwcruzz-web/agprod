import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/ssr'
import { createFarm } from '@/lib/actions/farm'
import { FarmForm } from '@/components/forms/FarmForm'

export const metadata: Metadata = { title: 'Nova propriedade' }

export default function NovaFazendaPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link
        href="/fazenda"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeftIcon size={15} /> Fazenda
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Nova propriedade</h1>
      <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-text-muted">
        Cada propriedade tem talhões, safras, estoque e financeiro próprios. Você alterna entre
        elas pelo seletor no topo da tela.
      </p>

      <div className="mt-10">
        <FarmForm action={createFarm} submitLabel="Criar propriedade" />
      </div>
    </div>
  )
}
