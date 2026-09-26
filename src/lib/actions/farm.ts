'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient, getUser } from '@/lib/supabase/server'
import { FARM_COOKIE, SEASON_COOKIE, getFarmContext } from '@/lib/farm'
import {
  type ActionState,
  dbError,
  decimal,
  firstIssue,
  formToObject,
  optionalText,
  requireWriteContext,
} from './shared'

const farmSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da propriedade'),
  trade_name: optionalText,
  owner_name: optionalText,
  tax_id: optionalText,
  phone: optionalText,
  email: optionalText,
  address: optionalText,
  city: optionalText,
  state: optionalText,
  postal_code: optionalText,
  community: optionalText,
  latitude: decimal,
  longitude: decimal,
  total_area: decimal,
  area_unit: z.enum(['ha', 'm2', 'alqueire']).default('ha'),
  main_activity: optionalText,
})

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
}

/** Cria a propriedade. O trigger on_farm_created vincula o usuario como owner. */
export async function createFarm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getUser()
  if (!user) return { error: 'Sessão expirada. Entre novamente.' }

  const parsed = farmSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('farms')
    .insert({ ...parsed.data, total_area: parsed.data.total_area ?? 0, created_by: user.id })
    .select('id')
    .single()

  if (error || !data) return { error: dbError(error?.message ?? '') }

  // Safra inicial: sem ela nao ha' onde pendurar producao e custos.
  const year = new Date().getFullYear()
  await supabase
    .from('seasons')
    .insert({ farm_id: data.id, name: `${year}.1`, is_active: true })

  const jar = await cookies()
  jar.set(FARM_COOKIE, data.id, COOKIE_OPTS)
  jar.delete(SEASON_COOKIE)

  revalidatePath('/', 'layout')
  redirect('/talhoes/novo?primeiro=1')
}

export async function updateFarm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getFarmContext()
  if (!ctx) return { error: 'Nenhuma propriedade ativa.' }
  if (ctx.role !== 'owner' && ctx.role !== 'admin')
    return { error: 'Somente o proprietário ou administrador pode editar a propriedade.' }

  const parsed = farmSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase
    .from('farms')
    .update({ ...parsed.data, total_area: parsed.data.total_area ?? 0 })
    .eq('id', ctx.farm.id)

  if (error) return { error: dbError(error.message) }

  revalidatePath('/', 'layout')
  return { message: 'Dados da propriedade atualizados.' }
}

// ---------------------------------------------------------------- safras

const seasonSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome da safra'),
  start_date: optionalText,
  end_date: optionalText,
  notes: optionalText,
})

export async function createSeason(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = seasonSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const { error } = await w.supabase.from('seasons').insert({
    farm_id: w.ctx.farm.id,
    name: parsed.data.name,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    notes: parsed.data.notes,
  })

  if (error) return { error: dbError(error.message) }

  revalidatePath('/safras')
  revalidatePath('/', 'layout')
  return { message: 'Safra criada.' }
}

export async function toggleSeasonActive(seasonId: string, isActive: boolean) {
  const w = await requireWriteContext()
  if ('error' in w) return

  await w.supabase
    .from('seasons')
    .update({ is_active: isActive })
    .eq('id', seasonId)
    .eq('farm_id', w.ctx.farm.id)

  revalidatePath('/safras')
  revalidatePath('/', 'layout')
}
