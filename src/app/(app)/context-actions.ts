'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { FARM_COOKIE, SEASON_COOKIE } from '@/lib/farm'

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
}

/** Troca a propriedade ativa. O id so' e' aceito se o RLS confirmar acesso. */
export async function selectFarm(farmId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('farms').select('id').eq('id', farmId).maybeSingle()
  if (!data) return

  const jar = await cookies()
  jar.set(FARM_COOKIE, data.id, COOKIE_OPTS)
  // Safra pertence a' propriedade anterior: limpar evita mistura de dados.
  jar.delete(SEASON_COOKIE)
  revalidatePath('/', 'layout')
}

export async function selectSeason(seasonId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('seasons').select('id').eq('id', seasonId).maybeSingle()
  if (!data) return

  const jar = await cookies()
  jar.set(SEASON_COOKIE, data.id, COOKIE_OPTS)
  revalidatePath('/', 'layout')
}
