'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'

/**
 * Cliente do browser. Usa apenas a chave publica (anon) — o isolamento
 * entre propriedades e' garantido pelo RLS no banco, nao pelo frontend.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
