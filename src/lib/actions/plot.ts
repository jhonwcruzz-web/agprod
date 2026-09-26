'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { z } from 'zod'
import {
  type ActionState,
  dbError,
  decimal,
  firstIssue,
  formToObject,
  optionalDate,
  optionalText,
  optionalUuid,
  requireWriteContext,
} from './shared'

const plotSchema = z.object({
  code: z.string().trim().min(1, 'Informe o código do talhão'),
  name: optionalText,
  area: decimal,
  area_unit: z.enum(['ha', 'm2', 'alqueire']).default('ha'),
  crop_id: optionalUuid,
  variety_id: optionalUuid,
  rootstock_id: optionalUuid,
  planting_date: optionalDate,
  plant_count: decimal,
  row_spacing: decimal,
  plant_spacing: decimal,
  irrigation_system: optionalText,
  training_system: optionalText,
  status: z.enum(['producao', 'formacao', 'repouso', 'inativo']).default('producao'),
  notes: optionalText,
})

export async function createPlot(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = plotSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const d = parsed.data
  const { data, error } = await w.supabase
    .from('plots')
    .insert({
      farm_id: w.ctx.farm.id,
      ...d,
      area: d.area ?? 0,
      plant_count: d.plant_count ? Math.round(d.plant_count) : null,
    })
    .select('id')
    .single()

  if (error || !data) {
    if (error?.message.includes('duplicate key'))
      return { error: `Já existe um talhão com o código ${d.code}.` }
    return { error: dbError(error?.message ?? '') }
  }

  // Ciclo de cultivo da safra corrente: e' o que amarra talhao e safra.
  if (w.ctx.season) {
    await w.supabase.from('crop_cycles').insert({
      farm_id: w.ctx.farm.id,
      plot_id: data.id,
      season_id: w.ctx.season.id,
      crop_id: d.crop_id,
      variety_id: d.variety_id,
      start_date: d.planting_date,
    })
  }

  revalidatePath('/talhoes')
  revalidatePath('/')

  const continuar = formData.get('continuar') === 'on'
  redirect((continuar ? '/talhoes/novo?primeiro=1' : `/talhoes/${data.id}`) as Route)
}

export async function updatePlot(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Talhão não identificado.' }

  const parsed = plotSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const d = parsed.data
  const { error } = await w.supabase
    .from('plots')
    .update({
      ...d,
      area: d.area ?? 0,
      plant_count: d.plant_count ? Math.round(d.plant_count) : null,
    })
    .eq('id', id)
    .eq('farm_id', w.ctx.farm.id)

  if (error) return { error: dbError(error.message) }

  revalidatePath(`/talhoes/${id}`)
  revalidatePath('/talhoes')
  return { message: 'Talhão atualizado.' }
}

/** Variedade propria da fazenda, quando nao esta' no catalogo global. */
export async function createVariety(cropId: string, name: string) {
  const w = await requireWriteContext()
  if ('error' in w) return null

  const { data } = await w.supabase
    .from('varieties')
    .insert({ crop_id: cropId, farm_id: w.ctx.farm.id, name: name.trim() })
    .select('id')
    .single()

  revalidatePath('/talhoes')
  return data?.id ?? null
}
