'use server'

import { revalidatePath } from 'next/cache'
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

const UNITS = ['kg', 't', 'caixa', 'unidade', 'L', 'g', 'mL', 'saco', 'dose'] as const
const positive = decimal.refine((v): v is number => v !== null && v > 0, 'Informe uma quantidade')
const zeroOrMore = decimal.transform((v) => v ?? 0)

/** Revalida as telas cujos numeros dependem deste lancamento. */
function refresh(...paths: string[]) {
  revalidatePath('/')
  for (const p of paths) revalidatePath(p)
}

// ------------------------------------------------------------- producao

const productionSchema = z.object({
  plot_id: optionalUuid,
  harvest_date: z.string().min(10, 'Informe a data'),
  quantity: positive,
  unit: z.enum(UNITS).default('kg'),
  unit_weight_kg: decimal,
  variety_id: optionalUuid,
  production_type: optionalText,
  team: optionalText,
  destination: optionalText,
  notes: optionalText,
})

export async function createProduction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = productionSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const d = parsed.data
  // Caixa/unidade precisam do peso unitario, senao a producao em kg fica zero
  // e o custo/kg nunca fecha.
  if (!['kg', 't', 'g'].includes(d.unit) && !d.unit_weight_kg) {
    return { error: `Informe quantos kg tem cada ${d.unit}.` }
  }

  // A cultura vem do talhao: o produtor nao deve digitar de novo.
  let crop_id: string | null = null
  if (d.plot_id) {
    const { data: plot } = await w.supabase
      .from('plots')
      .select('crop_id, variety_id')
      .eq('id', d.plot_id)
      .maybeSingle()
    crop_id = plot?.crop_id ?? null
    if (!d.variety_id) d.variety_id = plot?.variety_id ?? null
  }

  const { error } = await w.supabase.from('production_records').insert({
    farm_id: w.ctx.farm.id,
    season_id: w.ctx.season?.id ?? null,
    crop_id,
    created_by: w.ctx.userId,
    ...d,
  })

  if (error) return { error: dbError(error.message) }

  refresh('/producao', '/talhoes')
  return { message: 'Colheita registrada.' }
}

// ----------------------------------------------------------- aplicacoes

const applicationSchema = z.object({
  plot_id: optionalUuid,
  product_id: optionalUuid,
  product_name: z.string().trim().min(1, 'Informe o produto'),
  active_ingredient: optionalText,
  dose: decimal,
  dose_unit: optionalText,
  area: decimal,
  total_quantity: decimal,
  spray_volume: decimal,
  equipment: optionalText,
  responsible: optionalText,
  cost: zeroOrMore,
  status: z.enum(['programada', 'realizada', 'pendente', 'cancelada']).default('realizada'),
  scheduled_date: optionalDate,
  application_date: optionalDate,
  notes: optionalText,
})

export async function createApplication(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = applicationSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const d = parsed.data
  if (d.status === 'realizada' && !d.application_date)
    return { error: 'Informe a data da aplicação.' }
  if (d.status === 'programada' && !d.scheduled_date)
    return { error: 'Informe a data prevista.' }

  // Sem area informada, usa a do talhao — e com ela calcula a quantidade
  // total para dar baixa no estoque.
  let area = d.area
  let crop_id: string | null = null
  if (d.plot_id) {
    const { data: plot } = await w.supabase
      .from('plots')
      .select('area, crop_id')
      .eq('id', d.plot_id)
      .maybeSingle()
    if (area === null) area = plot?.area ?? null
    crop_id = plot?.crop_id ?? null
  }

  const total =
    d.total_quantity ?? (d.dose !== null && area !== null ? Number(d.dose) * Number(area) : null)

  const { error } = await w.supabase.from('applications').insert({
    farm_id: w.ctx.farm.id,
    season_id: w.ctx.season?.id ?? null,
    crop_id,
    created_by: w.ctx.userId,
    ...d,
    area,
    total_quantity: total,
  })

  if (error) return { error: dbError(error.message) }

  refresh('/aplicacoes', '/estoque', '/custos', '/talhoes')
  return {
    message:
      d.status === 'programada' ? 'Aplicação programada.' : 'Aplicação registrada e estoque baixado.',
  }
}

/** Marca uma aplicacao programada como realizada (baixa estoque e custo). */
export async function completeApplication(id: string, applicationDate: string) {
  const w = await requireWriteContext()
  if ('error' in w) return

  await w.supabase
    .from('applications')
    .update({ status: 'realizada', application_date: applicationDate })
    .eq('id', id)
    .eq('farm_id', w.ctx.farm.id)

  refresh('/aplicacoes', '/estoque', '/custos')
}

// ------------------------------------------------------------- adubacao

const fertilizationSchema = z.object({
  plot_id: optionalUuid,
  product_id: optionalUuid,
  product_name: z.string().trim().min(1, 'Informe o produto'),
  fert_type: optionalText,
  quantity: positive,
  unit: z.enum(UNITS).default('kg'),
  dose_per_ha: decimal,
  area: decimal,
  cost: zeroOrMore,
  application_method: optionalText,
  responsible: optionalText,
  fertilization_date: z.string().min(10, 'Informe a data'),
  notes: optionalText,
})

export async function createFertilization(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = fertilizationSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const d = parsed.data
  let area = d.area
  if (area === null && d.plot_id) {
    const { data: plot } = await w.supabase
      .from('plots')
      .select('area')
      .eq('id', d.plot_id)
      .maybeSingle()
    area = plot?.area ?? null
  }

  const { error } = await w.supabase.from('fertilizations').insert({
    farm_id: w.ctx.farm.id,
    season_id: w.ctx.season?.id ?? null,
    created_by: w.ctx.userId,
    ...d,
    area,
    dose_per_ha: d.dose_per_ha ?? (area ? Number(d.quantity) / Number(area) : null),
  })

  if (error) return { error: dbError(error.message) }

  refresh('/adubacao', '/estoque', '/custos', '/talhoes')
  return { message: 'Adubação registrada e estoque baixado.' }
}

// ------------------------------------------------------------ irrigacao

const irrigationSchema = z.object({
  plot_id: optionalUuid,
  irrigation_date: z.string().min(10, 'Informe a data'),
  duration_minutes: decimal,
  volume_m3: decimal,
  method: optionalText,
  cost: zeroOrMore,
  responsible: optionalText,
  notes: optionalText,
})

export async function createIrrigation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = irrigationSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const { error } = await w.supabase.from('irrigation_records').insert({
    farm_id: w.ctx.farm.id,
    season_id: w.ctx.season?.id ?? null,
    created_by: w.ctx.userId,
    ...parsed.data,
    duration_minutes: parsed.data.duration_minutes
      ? Math.round(parsed.data.duration_minutes)
      : null,
  })

  if (error) return { error: dbError(error.message) }

  refresh('/irrigacao', '/talhoes', '/custos')
  return { message: 'Irrigação registrada.' }
}

// --------------------------------------------------------------- custos

const expenseSchema = z.object({
  plot_id: optionalUuid,
  category: z.enum([
    'mao_de_obra','adubacao','fitossanidade','irrigacao','combustivel','energia',
    'manutencao','maquinas','embalagens','frete','servicos','outros',
  ]),
  description: z.string().trim().min(1, 'Descreva a despesa'),
  amount: positive,
  expense_date: z.string().min(10, 'Informe a data'),
  due_date: optionalDate,
  status: z.enum(['pendente', 'parcial', 'pago']).default('pago'),
  supplier: optionalText,
  notes: optionalText,
})

export async function createExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = expenseSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const d = parsed.data
  const { error } = await w.supabase.from('expenses').insert({
    farm_id: w.ctx.farm.id,
    season_id: w.ctx.season?.id ?? null,
    created_by: w.ctx.userId,
    ...d,
    paid_amount: d.status === 'pago' ? d.amount : 0,
    paid_date: d.status === 'pago' ? d.expense_date : null,
  })

  if (error) return { error: dbError(error.message) }

  refresh('/custos', '/financeiro', '/talhoes')
  return { message: 'Despesa registrada.' }
}

export async function payExpense(id: string) {
  const w = await requireWriteContext()
  if ('error' in w) return

  const { data: row } = await w.supabase
    .from('expenses')
    .select('amount')
    .eq('id', id)
    .eq('farm_id', w.ctx.farm.id)
    .maybeSingle()
  if (!row) return

  await w.supabase
    .from('expenses')
    .update({
      status: 'pago',
      paid_amount: row.amount,
      paid_date: new Date().toISOString().slice(0, 10),
    })
    .eq('id', id)
    .eq('farm_id', w.ctx.farm.id)

  refresh('/custos', '/financeiro')
}

// ------------------------------------------------------- comercializacao

const buyerSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do comprador'),
  tax_id: optionalText,
  phone: optionalText,
  email: optionalText,
  location: optionalText,
  notes: optionalText,
})

export async function createBuyer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = buyerSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const { error } = await w.supabase
    .from('buyers')
    .insert({ farm_id: w.ctx.farm.id, ...parsed.data })

  if (error) return { error: dbError(error.message) }

  refresh('/comercializacao')
  return { message: 'Comprador cadastrado.' }
}

const saleSchema = z.object({
  buyer_id: optionalUuid,
  plot_id: optionalUuid,
  variety_id: optionalUuid,
  sale_date: z.string().min(10, 'Informe a data'),
  quantity: positive,
  unit: z.enum(UNITS).default('kg'),
  unit_weight_kg: decimal,
  price_per_kg: zeroOrMore,
  total_amount: zeroOrMore,
  payment_method: optionalText,
  due_date: optionalDate,
  received_amount: zeroOrMore,
  received_date: optionalDate,
  received_full: optionalText,
  notes: optionalText,
})

export async function createSale(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = saleSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const d = parsed.data
  if (!['kg', 't', 'g'].includes(d.unit) && !d.unit_weight_kg)
    return { error: `Informe quantos kg tem cada ${d.unit}.` }
  if (!d.price_per_kg && !d.total_amount)
    return { error: 'Informe o preço por kg ou o valor total.' }

  let crop_id: string | null = null
  if (d.plot_id) {
    const { data: plot } = await w.supabase
      .from('plots')
      .select('crop_id, variety_id')
      .eq('id', d.plot_id)
      .maybeSingle()
    crop_id = plot?.crop_id ?? null
    if (!d.variety_id) d.variety_id = plot?.variety_id ?? null
  }

  const { received_full, ...sale } = d

  // "Recebi tudo": o valor recebido tem de ser exatamente o total da venda,
  // calculado aqui com a mesma regra do trigger normalize_sale.
  let received = sale.received_amount
  if (received_full === 'on') {
    const kgTotal =
      sale.unit === 'kg'
        ? Number(sale.quantity)
        : sale.unit === 't'
          ? Number(sale.quantity) * 1000
          : sale.unit === 'g'
            ? Number(sale.quantity) / 1000
            : Number(sale.quantity) * Number(sale.unit_weight_kg ?? 0)

    received = sale.total_amount || Math.round(kgTotal * Number(sale.price_per_kg) * 100) / 100
  }

  // O trigger normalize_sale calcula quantity_kg, total e status.
  const { error } = await w.supabase.from('sales').insert({
    farm_id: w.ctx.farm.id,
    season_id: w.ctx.season?.id ?? null,
    crop_id,
    created_by: w.ctx.userId,
    ...sale,
    received_amount: received,
  })

  if (error) return { error: dbError(error.message) }

  refresh('/comercializacao', '/financeiro', '/talhoes')
  return { message: 'Venda registrada.' }
}

export async function receiveSale(id: string) {
  const w = await requireWriteContext()
  if ('error' in w) return

  const { data: row } = await w.supabase
    .from('sales')
    .select('total_amount')
    .eq('id', id)
    .eq('farm_id', w.ctx.farm.id)
    .maybeSingle()
  if (!row) return

  await w.supabase
    .from('sales')
    .update({
      received_amount: row.total_amount,
      received_date: new Date().toISOString().slice(0, 10),
    })
    .eq('id', id)
    .eq('farm_id', w.ctx.farm.id)

  refresh('/comercializacao', '/financeiro')
}

// -------------------------------------------------------------- estoque

const productSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do produto'),
  category: z.enum([
    'fertilizante','defensivo','corretivo','material','embalagem','combustivel','outro',
  ]),
  unit: z.enum(UNITS).default('kg'),
  active_ingredient: optionalText,
  min_stock: zeroOrMore,
  unit_cost: zeroOrMore,
  location: optionalText,
  notes: optionalText,
})

export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = productSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const { error } = await w.supabase
    .from('products')
    .insert({ farm_id: w.ctx.farm.id, ...parsed.data })

  if (error) return { error: dbError(error.message) }

  refresh('/estoque')
  return { message: 'Produto cadastrado.' }
}

const movementSchema = z.object({
  product_id: z.uuid('Escolha o produto'),
  movement_type: z.enum(['entrada', 'saida', 'ajuste']),
  quantity: positive,
  unit_cost: zeroOrMore,
  total_cost: zeroOrMore,
  movement_date: z.string().min(10, 'Informe a data'),
  register_expense: optionalText,
  notes: optionalText,
})

export async function createMovement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = movementSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const d = parsed.data
  const total = d.total_cost || Number(d.quantity) * Number(d.unit_cost)

  const { error } = await w.supabase.from('inventory_movements').insert({
    farm_id: w.ctx.farm.id,
    product_id: d.product_id,
    movement_type: d.movement_type,
    quantity: d.quantity,
    unit_cost: d.unit_cost,
    total_cost: total,
    movement_date: d.movement_date,
    notes: d.notes,
    created_by: w.ctx.userId,
  })

  if (error) return { error: dbError(error.message) }

  // Compra e' saida de caixa, mas ainda nao e' custo de producao: o custo
  // so' e' reconhecido quando o insumo for aplicado no talhao.
  if (d.movement_type === 'entrada' && total > 0 && d.register_expense === 'on') {
    const { data: product } = await w.supabase
      .from('products')
      .select('name, category')
      .eq('id', d.product_id)
      .maybeSingle()

    const CATEGORY_MAP: Record<string, string> = {
      fertilizante: 'adubacao',
      defensivo: 'fitossanidade',
      combustivel: 'combustivel',
      embalagem: 'embalagens',
    }

    await w.supabase.from('expenses').insert({
      farm_id: w.ctx.farm.id,
      season_id: w.ctx.season?.id ?? null,
      category: (CATEGORY_MAP[product?.category ?? ''] ?? 'outros') as never,
      description: `Compra: ${product?.name ?? 'insumo'}`,
      amount: total,
      expense_date: d.movement_date,
      status: 'pago',
      paid_amount: total,
      is_production_cost: false,
      created_by: w.ctx.userId,
    })
  }

  // Atualiza o custo unitario de referencia na entrada.
  if (d.movement_type === 'entrada' && d.unit_cost > 0) {
    await w.supabase
      .from('products')
      .update({ unit_cost: d.unit_cost })
      .eq('id', d.product_id)
      .eq('farm_id', w.ctx.farm.id)
  }

  refresh('/estoque', '/financeiro', '/custos')
  return { message: 'Movimento registrado.' }
}

// ------------------------------------------------- destinos da colheita

/**
 * Cria uma opcao de destino propria da fazenda (botao "+" do formulario).
 * Se ja' existir uma com o mesmo nome — padrao ou da fazenda — devolve a
 * existente em vez de duplicar.
 */
export async function createHarvestDestination(
  rawName: string,
): Promise<{ id: string; name: string } | { error: string }> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error ?? 'Sem permissão para gravar.' }

  const name = rawName.trim().replace(/\s+/g, ' ')
  if (name.length < 2) return { error: 'Digite o nome do destino.' }
  if (name.length > 60) return { error: 'Nome muito longo (máximo 60 letras).' }

  // O RLS devolve as opcoes padrao e as desta fazenda.
  const { data: existing } = await w.supabase
    .from('harvest_destinations')
    .select('id, name')
    // ilike sem curingas: % e _ no nome digitado sao literais.
    .ilike('name', name.replace(/[\\%_]/g, '\\$&'))
    .limit(1)
    .maybeSingle()
  if (existing) return existing

  const { data, error } = await w.supabase
    .from('harvest_destinations')
    .insert({ farm_id: w.ctx.farm.id, name })
    .select('id, name')
    .single()

  if (error || !data) return { error: dbError(error?.message ?? '') }

  revalidatePath('/producao')
  return data
}
