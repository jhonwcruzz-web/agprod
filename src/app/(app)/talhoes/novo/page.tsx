import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/ssr'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { createPlot } from '@/lib/actions/plot'
import { PlotForm } from '@/components/forms/PlotForm'

export const metadata: Metadata = { title: 'Novo talhão' }

export default async function NovoTalhaoPage({
  searchParams,
}: {
  searchParams: Promise<{ primeiro?: string }>
}) {
  const [ctx, { primeiro }] = await Promise.all([requireFarm(), searchParams])
  const supabase = await createClient()

  const [crops, varieties, rootstocks, count] = await Promise.all([
    supabase.from('crops').select('id, slug, name').order('sort_order'),
    supabase.from('varieties').select('id, crop_id, name').order('name'),
    supabase.from('rootstocks').select('id, crop_id, name').order('name'),
    supabase
      .from('plots')
      .select('id', { count: 'exact', head: true })
      .eq('farm_id', ctx.farm.id),
  ])

  const isOnboarding = primeiro === '1'
  const existing = count.count ?? 0

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link
        href="/talhoes"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeftIcon size={15} /> Talhões
      </Link>

      {isOnboarding && (
        <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.2em] text-accent-text">
          {existing === 0 ? 'Segundo passo' : `${existing} talhão${existing > 1 ? 'es' : ''} cadastrado${existing > 1 ? 's' : ''}`}
        </p>
      )}

      <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
        {isOnboarding && existing === 0 ? 'Cadastre seu primeiro talhão' : 'Novo talhão'}
      </h1>

      <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-text-muted">
        O talhão é o centro do sistema. É nele que produção, custo e resultado se
        encontram — e é por isso que o custo por quilo consegue fechar.
      </p>

      <div className="mt-10">
        <PlotForm
          action={createPlot}
          crops={crops.data ?? []}
          varieties={varieties.data ?? []}
          rootstocks={rootstocks.data ?? []}
          submitLabel={isOnboarding ? 'Salvar e continuar' : 'Salvar talhão'}
          allowContinue
        />
      </div>

      {isOnboarding && existing > 0 && (
        <p className="mt-8 border-t border-line pt-6 text-sm text-text-muted">
          Já cadastrou o que precisava?{' '}
          <Link href="/" className="font-medium text-accent-text hover:underline">
            Ir para o painel
          </Link>
        </p>
      )}
    </div>
  )
}
