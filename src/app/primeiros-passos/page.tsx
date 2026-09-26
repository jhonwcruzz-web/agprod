import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getFarmContext } from '@/lib/farm'
import { getUser } from '@/lib/supabase/server'
import { createFarm } from '@/lib/actions/farm'
import { FarmForm } from '@/components/forms/FarmForm'

export const metadata: Metadata = { title: 'Cadastrar propriedade' }

export default async function PrimeirosPassosPage() {
  const user = await getUser()
  if (!user) redirect('/entrar')

  // Ja' tem propriedade? O onboarding nao deve reaparecer.
  const ctx = await getFarmContext()
  if (ctx) redirect('/')

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:py-16">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-accent-text">
        Primeiro passo
      </p>

      <h1 className="mt-3 max-w-[18ch] text-3xl font-semibold leading-[1.1] tracking-tighter sm:text-4xl">
        Vamos cadastrar sua propriedade
      </h1>

      <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-text-muted">
        Só o nome é obrigatório — o resto você completa depois. Em seguida cadastramos o
        primeiro talhão e você já pode começar a registrar colheita, aplicação e venda.
      </p>

      <ol className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-text-faint">
        {['Propriedade', 'Talhão', 'Começar a usar'].map((step, i) => (
          <li key={step} className="flex items-center gap-2">
            <span
              className={`flex size-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                i === 0 ? 'bg-accent text-on-accent' : 'bg-bg-sunken text-text-faint'
              }`}
            >
              {i + 1}
            </span>
            <span className={i === 0 ? 'font-medium text-text' : ''}>{step}</span>
            {i < 2 && <span aria-hidden className="ml-1 text-line-strong">—</span>}
          </li>
        ))}
      </ol>

      <div className="mt-10">
        <FarmForm action={createFarm} submitLabel="Continuar para os talhões" />
      </div>
    </div>
  )
}
