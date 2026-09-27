'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
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
import { DOSE_UNITS, round, sprayQuantity, stockCost } from '@/lib/calc'
import { closeOrderFromRecord } from './order-link'

const UNITS = ['kg', 't', 'caixa', 'unidade', 'L', 'g', 'mL', 'saco', 'dose'] as const
const positive = decimal.refine((v): v is number => v !== null && v > 0, 'Informe uma quantidade')
const zeroOrMore = decimal.transform((v) => v ?? 0)

type WriteCtx = Exclude<Awaited<ReturnType<typeof requireWriteContext>>, { error: string }>

/** Revalida as telas cujos numeros dependem deste lancamento. */
function refresh(...paths: string[]) {
  revalidatePath('/')
  for (const p of paths) revalidatePath(p)
}

/** id do registro em edicao; ausente = novo lancamento. */
function editId(formData: FormData): string | null {
  const id = String(formData.get('id') ?? '')
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null
}

/**
 * Grava novo ou atualiza existente.
 *
 * Na edicao, safra e autor originais sao mantidos, e o filtro por farm_id
 * garante que so' se edita registro da propriedade ativa (o RLS tambem).
 */
async function upsert(
  w: WriteCtx,
  table: string,
  id: string | null,
  row: Record<string, unknown>,
): Promise<{ id?: string; error?: string }> {
  // Nome de tabela dinamico: cliente sem tipos. O formato das linhas ja'
  // foi validado pelo zod antes de chegar aqui.
  const db = w.supabase as unknown as SupabaseClient
  if (id) {
    const { data, error } = await db
      .from(table)
      .update(row)
      .eq('id', id)
      .eq('farm_id', w.ctx.farm.id)
      .select('id')
    if (error) return { error: dbError(error.message) }
    if (!data || data.length === 0) return { error: 'Registro não encontrado nesta propriedade.' }
    return { id }
  }
  const { data, error } = await db
    .from(table)
    .insert({
      farm_id: w.ctx.farm.id,
      season_id: w.ctx.season?.id ?? null,
      created_by: w.ctx.userId,
      ...row,
    })
    .select('id')
    .single()
  if (error || !data) return { error: dbError(error?.message ?? '') }
  return { id: data.id }
}

/** Avisa quando a baixa deixou o estoque negativo (compra nao lancada). */
async function stockWarning(w: WriteCtx, productId: string | null) {
  if (!productId) return ''
  const { data } = await w.supabase
    .from('products')
    .select('name, current_stock, unit')
    .eq('id', productId)
    .maybeSingle()
  if (data && Number(data.current_stock) < 0)
    return ` Atenção: o estoque de ${data.name} ficou negativo (${round(Number(data.current_stock), 2)} ${data.unit}) — lance a compra em Estoque.`
  return ''
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

export async function saveProduction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = productionSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const d = parsed.data
  // Caixa/unidade precisam do peso unitario, senao a producao em kg fica zero
  // e o custo/kg nunca fecha.
  if (!['kg', 't', 'g'].includes(d.unit) && !d.unit_weight_kg)
    return { error: `Informe quantos kg tem cada ${d.unit}.` }

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

  const id = editId(formData)
  const r = await upsert(w, 'production_records', id, { ...d, crop_id })
  if (r.error) return { error: r.error }

  if (!id) await closeOrderFromRecord(w, formData, 'colheita')
  refresh('/producao', '/talhoes')
  return { message: id ? 'Colheita atualizada.' : 'Colheita registrada.' }
}

// --------------------------------------------------------- pulverizacao

const spraySchema = z.object({
  plot_id: optionalUuid,
  product_id: z.uuid('Escolha o produto do estoque'),
  dose: decimal,
  dose_unit: z.enum(DOSE_UNITS).default('L/ha'),
  area: decimal,
  spray_volume: decimal,
  // Vazios = calcular. Preenchidos = o produtor ajustou na mao.
  total_quantity: decimal,
  cost: decimal,
  machine_id: optionalUuid,
  implement_id: optionalUuid,
  responsible: optionalText,
  status: z.enum(['programada', 'realizada', 'pendente', 'cancelada']).default('realizada'),
  scheduled_date: optionalDate,
  application_date: optionalDate,
  notes: optionalText,
})

export async function saveSpray(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = spraySchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const d = parsed.data
  if (d.status === 'realizada' && !d.application_date)
    return { error: 'Informe a data da pulverização.' }
  if (d.status === 'programada' && !d.scheduled_date) return { error: 'Informe a data prevista.' }

  const { data: product } = await w.supabase
    .from('products')
    .select('name, unit, unit_cost, active_ingredient')
    .eq('id', d.product_id)
    .eq('farm_id', w.ctx.farm.id)
    .maybeSingle()
  if (!product) return { error: 'Produto não encontrado no estoque desta propriedade.' }

  // Sem area informada, usa a do talhao inteiro.
  let area = d.area
  let crop_id: string | null = null
  if (d.plot_id) {
    const { data: plot } = await w.supabase
      .from('plots')
      .select('area, crop_id')
      .eq('id', d.plot_id)
      .maybeSingle()
    if (area === null) area = plot?.area !== undefined ? Number(plot?.area) : null
    crop_id = plot?.crop_id ?? null
  }

  // Quantidade e custo: calculados, a menos que o produtor tenha ajustado.
  let total = d.total_quantity
  if (total === null) {
    const q = sprayQuantity({
      dose: d.dose,
      doseUnit: d.dose_unit,
      areaHa: area,
      sprayLha: d.spray_volume,
      productUnit: product.unit,
    })
    // Programada pode ficar sem dose: a quantidade so' e' exigida ao realizar.
    if (q.ok) total = q.quantity
    else if (d.status === 'realizada') return { error: `Não consegui calcular a quantidade gasta: ${q.reason}` }
  }
  const cost = d.cost ?? stockCost(total, Number(product.unit_cost)) ?? 0

  const id = editId(formData)
  const r = await upsert(w, 'applications', id, {
    ...d,
    crop_id,
    area,
    total_quantity: total,
    cost,
    product_name: product.name,
    active_ingredient: product.active_ingredient,
  })
  if (r.error) return { error: r.error }

  refresh('/pulverizacao', '/estoque', '/custos', '/talhoes')
  const done = d.status === 'realizada'
  const base = id
    ? 'Pulverização atualizada.'
    : done
      ? `Pulverização registrada: ${round(total ?? 0, 3)} ${product.unit} baixados do estoque.`
      : 'Pulverização programada.'
  return { message: base + (done ? await stockWarning(w, d.product_id) : '') }
}

/** Marca uma pulverizacao programada como realizada (baixa estoque e custo). */
export async function completeApplication(
  id: string,
  applicationDate: string,
): Promise<{ error?: string }> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error ?? 'Sem permissão para gravar.' }

  const { data: app } = await w.supabase
    .from('applications')
    .select('cost, total_quantity, product_id, dose, dose_unit, area, spray_volume')
    .eq('id', id)
    .eq('farm_id', w.ctx.farm.id)
    .maybeSingle()
  if (!app) return { error: 'Pulverização não encontrada.' }

  const { data: p } = app.product_id
    ? await w.supabase.from('products').select('unit, unit_cost').eq('id', app.product_id).maybeSingle()
    : { data: null }

  // Programada sem quantidade: calcula agora pela dose; sem dose, precisa editar.
  let total = app.total_quantity === null ? null : Number(app.total_quantity)
  if (total === null && p) {
    const q = sprayQuantity({
      dose: app.dose === null ? null : Number(app.dose),
      doseUnit: app.dose_unit ?? '',
      areaHa: app.area === null ? null : Number(app.area),
      sprayLha: app.spray_volume === null ? null : Number(app.spray_volume),
      productUnit: p.unit,
    })
    if (!q.ok) return { error: 'Informe a dose antes de marcar como feita.' }
    total = q.quantity
  }

  // Sem custo definido, usa o custo medio do estoque no dia da execucao.
  let cost = Number(app.cost)
  if (!cost && total) cost = stockCost(total, Number(p?.unit_cost ?? 0)) ?? 0

  const { error } = await w.supabase
    .from('applications')
    .update({ status: 'realizada', application_date: applicationDate, cost, total_quantity: total })
    .eq('id', id)
    .eq('farm_id', w.ctx.farm.id)
  if (error) return { error: dbError(error.message) }

  refresh('/pulverizacao', '/estoque', '/custos')
  return {}
}

// ------------------------------------------------------------- adubacao

const fertilizationSchema = z.object({
  plot_id: optionalUuid,
  product_id: z.uuid('Escolha o produto do estoque'),
  fert_type: optionalText,
  quantity: decimal,
  dose_per_ha: decimal,
  area: decimal,
  cost: decimal,
  machine_id: optionalUuid,
  implement_id: optionalUuid,
  application_method: optionalText,
  responsible: optionalText,
  fertilization_date: z.string().min(10, 'Informe a data'),
  notes: optionalText,
})

export async function saveFertilization(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = fertilizationSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const d = parsed.data
  const { data: product } = await w.supabase
    .from('products')
    .select('name, unit, unit_cost')
    .eq('id', d.product_id)
    .eq('farm_id', w.ctx.farm.id)
    .maybeSingle()
  if (!product) return { error: 'Produto não encontrado no estoque desta propriedade.' }

  let area = d.area
  if (area === null && d.plot_id) {
    const { data: plot } = await w.supabase
      .from('plots')
      .select('area')
      .eq('id', d.plot_id)
      .maybeSingle()
    area = plot?.area !== undefined ? Number(plot?.area) : null
  }

  // Informou a dose por hectare? A quantidade total sai da conta; e o
  // contrario tambem vale.
  let quantity = d.quantity
  let dose = d.dose_per_ha
  if (quantity === null && dose !== null && area) quantity = round(dose * area, 3)
  if (quantity === null || quantity <= 0)
    return { error: 'Informe a quantidade total ou a dose por hectare.' }
  if (dose === null && area) dose = round(quantity / area, 4)

  const cost = d.cost ?? stockCost(quantity, Number(product.unit_cost)) ?? 0

  const id = editId(formData)
  const r = await upsert(w, 'fertilizations', id, {
    ...d,
    area,
    quantity,
    dose_per_ha: dose,
    cost,
    // Mesma unidade do estoque: e' nela que a baixa acontece.
    unit: product.unit,
    product_name: product.name,
  })
  if (r.error) return { error: r.error }

  refresh('/adubacao', '/estoque', '/custos', '/talhoes')
  return {
    message:
      (id
        ? 'Adubação atualizada.'
        : `Adubação registrada: ${round(quantity, 3)} ${product.unit} baixados do estoque.`) +
      (await stockWarning(w, d.product_id)),
  }
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

export async function saveIrrigation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = irrigationSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const id = editId(formData)
  const r = await upsert(w, 'irrigation_records', id, {
    ...parsed.data,
    duration_minutes: parsed.data.duration_minutes ? Math.round(parsed.data.duration_minutes) : null,
  })
  if (r.error) return { error: r.error }

  refresh('/irrigacao', '/talhoes', '/custos')
  return { message: id ? 'Irrigação atualizada.' : 'Irrigação registrada.' }
}

// --------------------------------------------------------------- custos

const expenseSchema = z.object({
  plot_id: optionalUuid,
  category: z.string().min(2, 'Escolha a categoria'),
  description: z.string().trim().min(1, 'Descreva a despesa'),
  amount: positive,
  expense_date: z.string().min(10, 'Informe a data'),
  due_date: optionalDate,
  status: z.enum(['pendente', 'parcial', 'pago']).default('pago'),
  supplier: optionalText,
  notes: optionalText,
})

export async function saveExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = expenseSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const d = parsed.data
  // Categoria precisa existir (padrao ou criada por esta fazenda — o RLS
  // so' devolve essas duas).
  const { data: cat } = await w.supabase
    .from('expense_categories')
    .select('code')
    .eq('code', d.category)
    .limit(1)
    .maybeSingle()
  if (!cat) return { error: 'Categoria inválida — escolha uma da lista.' }

  const id = editId(formData)
  if (id) {
    // Custo gerado por pulverizacao, adubacao ou maquina se edita na origem.
    const { data: cur } = await w.supabase
      .from('expenses')
      .select('source_table')
      .eq('id', id)
      .eq('farm_id', w.ctx.farm.id)
      .maybeSingle()
    if (cur?.source_table) return { error: 'Este custo é gerado automaticamente — edite o lançamento de origem.' }
  }

  const r = await upsert(w, 'expenses', id, {
    ...d,
    paid_amount: d.status === 'pago' ? d.amount : 0,
    paid_date: d.status === 'pago' ? d.expense_date : null,
    due_date: d.status === 'pago' ? null : d.due_date,
  })
  if (r.error) return { error: r.error }

  refresh('/custos', '/financeiro', '/talhoes')
  return { message: id ? 'Despesa atualizada.' : 'Despesa registrada.' }
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
    .update({ status: 'pago', paid_amount: row.amount, paid_date: new Date().toISOString().slice(0, 10) })
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

export async function saveBuyer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = buyerSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const id = editId(formData)
  const { error } = id
    ? await w.supabase.from('buyers').update(parsed.data).eq('id', id).eq('farm_id', w.ctx.farm.id)
    : await w.supabase.from('buyers').insert({ farm_id: w.ctx.farm.id, ...parsed.data })
  if (error) return { error: dbError(error.message) }

  refresh('/comercializacao')
  return { message: id ? 'Comprador atualizado.' : 'Comprador cadastrado.' }
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

export async function saveSale(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = saleSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const d = parsed.data
  if (!['kg', 't', 'g'].includes(d.unit) && !d.unit_weight_kg)
    return { error: `Informe quantos kg tem cada ${d.unit}.` }
  if (!d.price_per_kg && !d.total_amount) return { error: 'Informe o preço por kg ou o valor total.' }

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

  // Total calculado aqui (mesma regra do trigger normalize_sale): na edicao
  // o trigger so' recalcula quando o total vem zerado.
  const kgTotal =
    sale.unit === 'kg'
      ? sale.quantity
      : sale.unit === 't'
        ? sale.quantity * 1000
        : sale.unit === 'g'
          ? sale.quantity / 1000
          : sale.quantity * Number(sale.unit_weight_kg ?? 0)
  const total = sale.total_amount || round(kgTotal * sale.price_per_kg, 2)

  // "Recebi tudo": o recebido e' exatamente o total.
  const received = received_full === 'on' ? total : sale.received_amount

  const id = editId(formData)
  const r = await upsert(w, 'sales', id, {
    ...sale,
    crop_id,
    total_amount: total,
    received_amount: received,
  })
  if (r.error) return { error: r.error }

  refresh('/comercializacao', '/financeiro', '/talhoes')
  return { message: id ? 'Venda atualizada.' : 'Venda registrada.' }
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
    .update({ received_amount: row.total_amount, received_date: new Date().toISOString().slice(0, 10) })
    .eq('id', id)
    .eq('farm_id', w.ctx.farm.id)

  refresh('/comercializacao', '/financeiro')
}

// -------------------------------------------------------------- estoque

const productSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do produto'),
  category_id: z.uuid('Escolha a categoria'),
  unit: z.enum(UNITS).default('kg'),
  active_ingredient: optionalText,
  min_stock: zeroOrMore,
  unit_cost: zeroOrMore,
  location: optionalText,
  notes: optionalText,
})

export async function saveProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = productSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const id = editId(formData)
  const { error } = id
    ? await w.supabase.from('products').update(parsed.data).eq('id', id).eq('farm_id', w.ctx.farm.id)
    : await w.supabase.from('products').insert({ farm_id: w.ctx.farm.id, ...parsed.data })
  if (error) {
    if (error.message.includes('duplicate key')) return { error: 'Já existe um produto com esse nome.' }
    return { error: dbError(error.message) }
  }

  refresh('/estoque')
  return { message: id ? 'Produto atualizado.' : 'Produto cadastrado.' }
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

export async function saveMovement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = movementSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const d = parsed.data
  // Valor total ou custo unitario: o que faltar sai da conta.
  const total = d.total_cost || round(d.quantity * d.unit_cost, 2)
  const unitCost = d.unit_cost || (d.quantity > 0 ? round(d.total_cost / d.quantity, 4) : 0)

  const id = editId(formData)
  if (id) {
    const { data: cur } = await w.supabase
      .from('inventory_movements')
      .select('source_table')
      .eq('id', id)
      .eq('farm_id', w.ctx.farm.id)
      .maybeSingle()
    if (cur?.source_table)
      return { error: 'Esta baixa foi gerada por um lançamento — edite o lançamento de origem.' }
  }

  const row = {
    product_id: d.product_id,
    movement_type: d.movement_type,
    quantity: d.quantity,
    unit_cost: unitCost,
    total_cost: total,
    movement_date: d.movement_date,
    notes: d.notes,
  }
  const { error } = id
    ? await w.supabase.from('inventory_movements').update(row).eq('id', id).eq('farm_id', w.ctx.farm.id)
    : await w.supabase
        .from('inventory_movements')
        .insert({ farm_id: w.ctx.farm.id, created_by: w.ctx.userId, ...row })
  if (error) return { error: dbError(error.message) }

  // Compra e' saida de caixa, mas ainda nao e' custo de producao: o custo
  // so' e' reconhecido quando o insumo for aplicado no talhao.
  if (!id && d.movement_type === 'entrada' && total > 0 && d.register_expense === 'on') {
    const { data: product } = await w.supabase
      .from('products')
      .select('name, product_categories(expense_category)')
      .eq('id', d.product_id)
      .maybeSingle()
    const cat = (product?.product_categories as { expense_category: string } | null)?.expense_category

    await w.supabase.from('expenses').insert({
      farm_id: w.ctx.farm.id,
      season_id: w.ctx.season?.id ?? null,
      category: cat ?? 'outros',
      description: `Compra: ${product?.name ?? 'insumo'}`,
      amount: total,
      expense_date: d.movement_date,
      status: 'pago',
      paid_amount: total,
      is_production_cost: false,
      created_by: w.ctx.userId,
    })
  }

  refresh('/estoque', '/financeiro', '/custos')
  return { message: id ? 'Movimento atualizado.' : 'Movimento registrado.' }
}

// ------------------------------------------------ listas criaveis ("+")

const cleanName = (raw: string) => raw.trim().replace(/\s+/g, ' ')
/** ilike sem curingas: % e _ no nome digitado sao literais. */
const literal = (s: string) => s.replace(/[\\%_]/g, '\\$&')

function checkName(name: string) {
  if (name.length < 2) return 'Digite o nome.'
  if (name.length > 60) return 'Nome muito longo (máximo 60 letras).'
  return null
}

/** Destino da colheita criado pelo produtor. Nome repetido reaproveita. */
export async function createHarvestDestination(
  rawName: string,
): Promise<{ id: string; name: string } | { error: string }> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error ?? 'Sem permissão para gravar.' }
  const name = cleanName(rawName)
  const bad = checkName(name)
  if (bad) return { error: bad }

  const { data: existing } = await w.supabase
    .from('harvest_destinations')
    .select('id, name')
    .ilike('name', literal(name))
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

/** Categoria de custo criada pelo produtor (botao "+" em Custos). */
export async function createExpenseCategory(
  rawName: string,
): Promise<{ code: string; name: string } | { error: string }> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error ?? 'Sem permissão para gravar.' }
  const name = cleanName(rawName)
  const bad = checkName(name)
  if (bad) return { error: bad }

  const { data: existing } = await w.supabase
    .from('expense_categories')
    .select('code, name')
    .ilike('name', literal(name))
    .limit(1)
    .maybeSingle()
  if (existing) return existing

  // Codigo estavel derivado do nome, com prefixo para nunca colidir com as
  // categorias padrao usadas pelos lancamentos automaticos.
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
  const code = `c_${slug || 'categoria'}_${Date.now().toString(36).slice(-4)}`

  const { data, error } = await w.supabase
    .from('expense_categories')
    .insert({ farm_id: w.ctx.farm.id, code, name })
    .select('code, name')
    .single()
  if (error || !data) return { error: dbError(error?.message ?? '') }

  revalidatePath('/custos')
  return data
}

/** Categoria de estoque criada pelo produtor (botao "+" em Estoque). */
export async function createProductCategory(
  rawName: string,
): Promise<{ id: string; name: string } | { error: string }> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error ?? 'Sem permissão para gravar.' }
  const name = cleanName(rawName)
  const bad = checkName(name)
  if (bad) return { error: bad }

  const { data: existing } = await w.supabase
    .from('product_categories')
    .select('id, name')
    .ilike('name', literal(name))
    .limit(1)
    .maybeSingle()
  if (existing) return existing

  const { data, error } = await w.supabase
    .from('product_categories')
    .insert({ farm_id: w.ctx.farm.id, name, expense_category: 'outros' })
    .select('id, name')
    .single()
  if (error || !data) return { error: dbError(error?.message ?? '') }

  revalidatePath('/estoque')
  return data
}
