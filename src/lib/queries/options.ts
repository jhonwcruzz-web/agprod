import { createClient } from '@/lib/supabase/server'

/**
 * Opcoes dos formularios de lancamento.
 *
 * Variedades, destinos e categorias combinam o catalogo padrao com os
 * criados pela fazenda; o RLS ja' devolve apenas o que este usuario pode
 * ver, entao nao ha' filtro extra por farm_id nessas listas.
 */
export async function getFormOptions(farmId: string) {
  const supabase = await createClient()

  const [plots, varieties, products, buyers, destinations, productCats, expenseCats, machines] =
    await Promise.all([
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
        // custo medio e unidade: base dos calculos de quantidade e custo
        .select('id, name, unit, unit_cost, current_stock, active_ingredient, category_id, product_categories(name)')
        .eq('farm_id', farmId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('buyers')
        .select('id, name')
        .eq('farm_id', farmId)
        .eq('is_active', true)
        .order('name'),
      supabase.from('harvest_destinations').select('id, name, farm_id').order('sort_order').order('name'),
      supabase.from('product_categories').select('id, name, farm_id').order('sort_order').order('name'),
      supabase.from('expense_categories').select('code, name, farm_id').order('sort_order').order('name'),
      supabase
        .from('machines')
        .select('id, name, class, kind, meter_type, current_meter')
        .eq('farm_id', farmId)
        .neq('status', 'inativo')
        .order('name'),
    ])

  return {
    plots: plots.data ?? [],
    varieties: varieties.data ?? [],
    products: (products.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      unit_cost: Number(p.unit_cost),
      current_stock: Number(p.current_stock),
      active_ingredient: p.active_ingredient,
      category_id: p.category_id,
      category: (p.product_categories as { name: string } | null)?.name ?? '',
    })),
    buyers: buyers.data ?? [],
    destinations: destinations.data ?? [],
    productCategories: productCats.data ?? [],
    expenseCategories: expenseCats.data ?? [],
    tractors: (machines.data ?? []).filter((m) => m.class === 'maquina'),
    implements: (machines.data ?? []).filter((m) => m.class === 'implemento'),
  }
}

export type FormOptions = Awaited<ReturnType<typeof getFormOptions>>
export type ProductOption = FormOptions['products'][number]

/** Nome de exibicao de cada codigo de categoria de custo. */
export async function getExpenseCategoryNames(): Promise<Map<string, string>> {
  const supabase = await createClient()
  const { data } = await supabase.from('expense_categories').select('code, name')
  return new Map((data ?? []).map((c) => [c.code, c.name]))
}
