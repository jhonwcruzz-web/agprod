import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/types/database'

export type PlotPerformance = Tables<'v_plot_performance'>

/**
 * Desempenho dos talhoes na safra escolhida no seletor do topo.
 *
 * Unico ponto de leitura para painel, talhoes, custos e assistente — assim
 * todas as telas mostram o mesmo numero. Sem safra cadastrada, devolve o
 * acumulado geral do talhao.
 */
export async function getPlotPerformance(
  farmId: string,
  seasonId: string | null | undefined,
  plotId?: string,
): Promise<PlotPerformance[]> {
  const supabase = await createClient()

  if (seasonId) {
    let q = supabase
      .from('v_plot_season_performance')
      .select('*')
      .eq('farm_id', farmId)
      .eq('season_id', seasonId)
      .order('code')
    if (plotId) q = q.eq('plot_id', plotId)
    const { data } = await q
    // Mesmas colunas da view acumulada; season_id so' sobra.
    return (data ?? []).map(({ season_id: _s, ...row }) => row)
  }

  let q = supabase.from('v_plot_performance').select('*').eq('farm_id', farmId).order('code')
  if (plotId) q = q.eq('plot_id', plotId)
  const { data } = await q
  return data ?? []
}
