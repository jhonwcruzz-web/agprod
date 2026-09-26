import Link from 'next/link'
import type { Route } from 'next'
import { XIcon } from '@phosphor-icons/react/dist/ssr'
import { createClient } from '@/lib/supabase/server'
import { requireFarm } from '@/lib/farm'
import { updatePlot } from '@/lib/actions/plot'
import { PlotForm } from '@/components/forms/PlotForm'

/** Edicao do talhao aberta na propria pagina via ?editar=1. */
export async function PlotEditPanel({ plotId }: { plotId: string }) {
  const ctx = await requireFarm()
  const supabase = await createClient()

  const [plot, crops, varieties, rootstocks] = await Promise.all([
    supabase.from('plots').select('*').eq('id', plotId).eq('farm_id', ctx.farm.id).maybeSingle(),
    supabase.from('crops').select('id, slug, name').order('sort_order'),
    supabase.from('varieties').select('id, crop_id, name').order('name'),
    supabase.from('rootstocks').select('id, crop_id, name').order('name'),
  ])

  if (!plot.data) return null

  return (
    <div className="rounded-lg border border-line-strong bg-bg-raised p-5 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Editar talhão</h2>
        <Link
          href={`/talhoes/${plotId}` as Route}
          aria-label="Fechar edição"
          className="press rounded-md p-1 text-text-muted hover:bg-bg-sunken"
        >
          <XIcon size={18} />
        </Link>
      </div>

      <PlotForm
        action={updatePlot}
        crops={crops.data ?? []}
        varieties={varieties.data ?? []}
        rootstocks={rootstocks.data ?? []}
        plot={plot.data}
        submitLabel="Salvar alterações"
      />
    </div>
  )
}
