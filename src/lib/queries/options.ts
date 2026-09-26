import { createClient } from '@/lib/supabase/server'

/**
 * Opcoes dos formularios de lancamento.
 *
 * As variedades e os destinos combinam o catalogo global com os proprios
 * da fazenda; o RLS ja' devolve apenas o que este usuario pode ver, entao
 * nao ha' filtro extra por farm_id nessas duas listas.
 */
export async function getFormOptions(farmId: string) {
  const supabase = await createClient()

  const [plots, varieties, products, buyers, destinations] = await Promise.all([
    supabase
      .from('plots')
      // variedade e cultura vao junto: o formulario preenche a variedade
      // sozinho ao escolher o talhao.
      .select('id, code, name, area, crop_id, variety_id')
      .eq('farm_id', farmId)
      .neq('status', 'inativo')
      .order('code'),
    supabase.from('varieties').select('id, name, crop_id').order('name'),
    supabase
      .from('products')
      .select('id, name, unit, current_stock, active_ingredient, category')
      .eq('farm_id', farmId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('buyers')
      .select('id, name')
      .eq('farm_id', farmId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('harvest_destinations')
      .select('id, name, farm_id')
      .order('sort_order')
      .order('name'),
  ])

  return {
    plots: plots.data ?? [],
    varieties: varieties.data ?? [],
    products: products.data ?? [],
    buyers: buyers.data ?? [],
    destinations: destinations.data ?? [],
  }
}
