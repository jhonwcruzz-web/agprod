'use server'

import { revalidatePath } from 'next/cache'
import { type ActionState, dbError, requireWriteContext } from './shared'

/** Acima disso quase certamente digitaram kg/ha no campo de t/ha. */
const MAX_T_HA = 200

function parseTHa(raw: FormDataEntryValue | null): number | null | 'invalido' {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (s === '') return null
  const n = Number(s.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : 'invalido'
}

/**
 * Salva a previsao (t/ha) de todos os talhoes da safra ativa de uma vez.
 *
 * Campo em branco apaga a previsao do talhao. O volume previsto nao e'
 * gravado: e' sempre t/ha x area, calculado na view v_forecast.
 */
export async function saveForecast(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }
  if (!w.ctx.season) return { error: 'Crie uma safra antes de informar a previsão.' }

  const seasonId = w.ctx.season.id
  const farmId = w.ctx.farm.id

  // So' aceita talhoes desta fazenda: o id vem do formulario, entao e'
  // conferido contra o que o RLS devolve.
  const { data: plots } = await w.supabase
    .from('plots')
    .select('id, code, crop_id, variety_id')
    .eq('farm_id', farmId)
    .neq('status', 'inativo')

  const wanted = new Map<string, number | null>()
  for (const p of plots ?? []) {
    const key = `t_ha__${p.id}`
    if (!formData.has(key)) continue
    const v = parseTHa(formData.get(key))
    if (v === 'invalido') return { error: `Previsão inválida no talhão ${p.code}.` }
    if (v !== null && v > MAX_T_HA)
      return {
        error: `${p.code}: ${v} t/ha parece alto demais — confira se não foi digitado em kg/ha.`,
      }
    wanted.set(p.id, v)
  }

  const { data: cycles } = await w.supabase
    .from('crop_cycles')
    .select('id, plot_id')
    .eq('farm_id', farmId)
    .eq('season_id', seasonId)

  const cycleByPlot = new Map((cycles ?? []).map((c) => [c.plot_id, c.id]))
  const plotById = new Map((plots ?? []).map((p) => [p.id, p]))

  const toInsert = []
  for (const [plotId, tHa] of wanted) {
    const cycleId = cycleByPlot.get(plotId)
    if (cycleId) {
      const { error } = await w.supabase
        .from('crop_cycles')
        .update({ expected_t_ha: tHa })
        .eq('id', cycleId)
        .eq('farm_id', farmId)
      if (error) return { error: dbError(error.message) }
    } else if (tHa !== null) {
      // Talhao ainda sem ciclo nesta safra: cria ja' com a previsao.
      const p = plotById.get(plotId)!
      toInsert.push({
        farm_id: farmId,
        plot_id: plotId,
        season_id: seasonId,
        crop_id: p.crop_id,
        variety_id: p.variety_id,
        expected_t_ha: tHa,
      })
    }
  }

  if (toInsert.length > 0) {
    const { error } = await w.supabase.from('crop_cycles').insert(toInsert)
    if (error) return { error: dbError(error.message) }
  }

  revalidatePath('/producao')
  revalidatePath('/')
  return { message: `Previsão da safra ${w.ctx.season.name} salva.` }
}
