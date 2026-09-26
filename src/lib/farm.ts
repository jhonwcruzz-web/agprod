import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, getUser } from '@/lib/supabase/server'
import type { Tables } from '@/lib/types/database'

export const FARM_COOKIE = 'fazenda_id'
export const SEASON_COOKIE = 'safra_id'

export type Farm = Tables<'farms'>
export type Season = Tables<'seasons'>

export type FarmContext = {
  userId: string
  farm: Farm
  farms: Pick<Farm, 'id' | 'name' | 'city' | 'state'>[]
  season: Season | null
  seasons: Season[]
  role: Tables<'farm_users'>['role']
}

/**
 * Resolve a propriedade e a safra ativas.
 *
 * Nao confia no cookie: o id vindo dele so' e' aceito se aparecer na lista
 * que o RLS devolveu para este usuario. Assim, trocar o cookie a mao nao
 * da' acesso a outra propriedade.
 */
export async function getFarmContext(): Promise<FarmContext | null> {
  const user = await getUser()
  if (!user) return null

  const supabase = await createClient()
  const jar = await cookies()

  const { data: memberships } = await supabase
    .from('farm_users')
    .select('role, farms(id, name, city, state)')
    .order('created_at', { ascending: true })

  const rows = (memberships ?? []).filter((m) => m.farms)
  if (rows.length === 0) return null

  const farms = rows.map((m) => m.farms as unknown as Farm)
  const wanted = jar.get(FARM_COOKIE)?.value
  const index = Math.max(0, farms.findIndex((f) => f.id === wanted))

  const { data: farm } = await supabase
    .from('farms')
    .select('*')
    .eq('id', farms[index].id)
    .single()

  if (!farm) return null

  const { data: seasons } = await supabase
    .from('seasons')
    .select('*')
    .eq('farm_id', farm.id)
    .order('name', { ascending: false })

  const list = seasons ?? []
  const wantedSeason = jar.get(SEASON_COOKIE)?.value
  const season =
    list.find((s) => s.id === wantedSeason) ?? list.find((s) => s.is_active) ?? list[0] ?? null

  return {
    userId: user.id,
    farm,
    farms: farms.map((f) => ({ id: f.id, name: f.name, city: f.city, state: f.state })),
    season,
    seasons: list,
    role: rows[index].role,
  }
}

/** Versao que exige contexto: redireciona para o onboarding se nao houver. */
export async function requireFarm(): Promise<FarmContext> {
  const ctx = await getFarmContext()
  if (!ctx) redirect('/primeiros-passos')
  return ctx
}

export function canEdit(role: FarmContext['role']) {
  return role === 'owner' || role === 'admin' || role === 'operator'
}

export function canManage(role: FarmContext['role']) {
  return role === 'owner' || role === 'admin'
}
