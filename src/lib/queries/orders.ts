import { createClient } from '@/lib/supabase/server'
import type { OrderKind, OrderStatus } from '@/lib/orders'

type Named = { name: string } | null
type MachineRef = {
  name: string
  kind: string | null
  brand: string | null
  model: string | null
  identifier: string | null
  meter_type: string
  current_meter: number
} | null

/** Uma OS com tudo que o PDF precisa. RLS: so' da fazenda do usuario. */
export async function getServiceOrderDetail(id: string, farmId: string) {
  const supabase = await createClient()
  const [{ data: os }, { data: farm }] = await Promise.all([
    supabase
      .from('service_orders')
      .select(
        `*,
         plots(code, name, area, plant_count, crops(name), varieties(name)),
         varieties(name),
         seasons(name),
         machine:machines!service_orders_machine_id_fkey(name, kind, brand, model, identifier, meter_type, current_meter),
         implement:machines!service_orders_implement_id_fkey(name, kind, brand, model, identifier, meter_type, current_meter)`,
      )
      .eq('id', id)
      .eq('farm_id', farmId)
      .maybeSingle(),
    supabase
      .from('farms')
      .select('name, owner_name, phone, address, city, state, community')
      .eq('id', farmId)
      .maybeSingle(),
  ])
  if (!os || !farm) return null

  const { data: apps } = os.kind === 'pulverizacao'
    ? await supabase
        .from('applications')
        .select('id, product_name, active_ingredient, dose, dose_unit, total_quantity, status, products(unit)')
        .eq('service_order_id', id)
        .eq('farm_id', farmId)
        .order('created_at')
    : { data: [] }

  const { data: items } = os.kind === 'adubacao'
    ? await supabase
        .from('service_order_items')
        .select('id, dose, dose_unit, quantity, products(name, unit, active_ingredient)')
        .eq('service_order_id', id)
        .eq('farm_id', farmId)
        .order('sort')
    : { data: [] }

  const plot = os.plots as {
    code: string
    name: string | null
    area: number
    plant_count: number | null
    crops: Named
    varieties: Named
  } | null

  return {
    ...os,
    kind: os.kind as OrderKind,
    status: os.status as OrderStatus,
    plot,
    variety: (os.varieties as Named)?.name ?? plot?.varieties?.name ?? null,
    season: (os.seasons as Named)?.name ?? null,
    machine: os.machine as MachineRef,
    implement: os.implement as MachineRef,
    farm,
    products: os.kind === 'adubacao'
      ? (items ?? []).map((it) => {
          const p = it.products as { name: string; unit: string; active_ingredient: string | null } | null
          return {
            id: it.id,
            name: p?.name ?? '—',
            activeIngredient: p?.active_ingredient ?? null,
            dose: Number(it.dose),
            doseUnit: it.dose_unit as string | null,
            total: Number(it.quantity),
            unit: p?.unit ?? '',
            done: os.status === 'concluida',
          }
        })
      : (apps ?? []).map((a) => ({
      id: a.id,
      name: a.product_name,
      activeIngredient: a.active_ingredient,
      dose: a.dose === null ? null : Number(a.dose),
      doseUnit: a.dose_unit,
      total: a.total_quantity === null ? null : Number(a.total_quantity),
      unit: (a.products as { unit: string } | null)?.unit ?? '',
      done: a.status === 'realizada',
    })),
  }
}

export type ServiceOrderDetail = NonNullable<Awaited<ReturnType<typeof getServiceOrderDetail>>>
