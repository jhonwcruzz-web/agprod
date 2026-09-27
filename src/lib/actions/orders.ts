'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  type ActionState,
  dbError,
  decimal,
  firstIssue,
  formToObject,
  optionalText,
  optionalUuid,
  requireWriteContext,
} from './shared'
import { DOSE_UNITS, parseBr, round, sprayQuantity, stockCost } from '@/lib/calc'
import { ORDER_KIND_LABEL, orderNumber } from '@/lib/orders'

const UUID = /^[0-9a-f-]{36}$/i

function refresh() {
  revalidatePath('/')
  for (const p of ['/ordens', '/pulverizacao', '/estoque', '/custos', '/producao', '/maquinas']) revalidatePath(p)
}

const orderSchema = z.object({
  kind: z.enum(['pulverizacao', 'colheita', 'manutencao'], 'Tipo de ordem inválido'),
  scheduled_date: z.iso.date('Informe a data prevista'),
  plot_id: optionalUuid,
  machine_id: optionalUuid,
  implement_id: optionalUuid,
  assignee: optionalText,
  assignee_phone: optionalText,
  instructions: optionalText,
  area: decimal,
  spray_volume: decimal,
  tank_capacity: decimal,
  variety_id: optionalUuid,
  expected_quantity: decimal,
  expected_unit: z.enum(['kg', 't', 'caixa']).optional().transform((v) => v ?? null),
  destination: optionalText,
  team_size: decimal,
  log_type: z.enum(['preventiva', 'corretiva', 'revisao']).optional().transform((v) => v ?? null),
  checklist: optionalText,
})

type SprayLine = { product_id: string; dose: number; dose_unit: string }

/** Linhas da calda: product_id[], dose[], dose_unit[] na mesma ordem. */
function readSprayLines(formData: FormData): SprayLine[] | { error: string } {
  const ids = formData.getAll('line_product_id').map(String)
  const doses = formData.getAll('line_dose').map(String)
  const units = formData.getAll('line_dose_unit').map(String)
  const lines: SprayLine[] = []
  for (let i = 0; i < ids.length; i++) {
    if (!ids[i] && !doses[i]) continue // linha vazia
    if (!UUID.test(ids[i])) return { error: `Escolha o produto da linha ${i + 1}.` }
    const dose = parseBr(doses[i] ?? '')
    if (dose === null || dose <= 0) return { error: `Informe a dose da linha ${i + 1}.` }
    const unit = units[i] ?? ''
    if (!(DOSE_UNITS as readonly string[]).includes(unit)) return { error: `Unidade de dose inválida na linha ${i + 1}.` }
    lines.push({ product_id: ids[i], dose, dose_unit: unit })
  }
  if (lines.length === 0) return { error: 'Inclua pelo menos um produto na calda.' }
  if (new Set(lines.map((l) => l.product_id)).size !== lines.length)
    return { error: 'O mesmo produto aparece duas vezes na calda.' }
  return lines
}

export async function saveServiceOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = orderSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const d = parsed.data
  const rawId = String(formData.get('id') ?? '')
  const id = UUID.test(rawId) ? rawId : null

  if (id) {
    const { data: cur } = await w.supabase
      .from('service_orders')
      .select('status, kind')
      .eq('id', id)
      .eq('farm_id', w.ctx.farm.id)
      .maybeSingle()
    if (!cur) return { error: 'Ordem não encontrada nesta propriedade.' }
    if (cur.status !== 'aberta') return { error: 'Só é possível editar ordens abertas.' }
    if (cur.kind !== d.kind) return { error: 'O tipo da ordem não pode ser trocado.' }
  }

  const teamSize = d.team_size === null ? null : Math.round(d.team_size)
  const base = {
    kind: d.kind,
    scheduled_date: d.scheduled_date,
    assignee: d.assignee,
    assignee_phone: d.assignee_phone,
    instructions: d.instructions,
    plot_id: null as string | null,
    machine_id: null as string | null,
    implement_id: null as string | null,
    area: null as number | null,
    spray_volume: null as number | null,
    tank_capacity: null as number | null,
    variety_id: null as string | null,
    expected_quantity: null as number | null,
    expected_unit: null as 'kg' | 't' | 'caixa' | null,
    destination: null as string | null,
    team_size: null as number | null,
    log_type: null as 'preventiva' | 'corretiva' | 'revisao' | null,
    checklist: null as string | null,
  }

  // --- validacao e calculo por tipo, antes de gravar qualquer coisa
  let appRows: Record<string, unknown>[] = []
  if (d.kind === 'pulverizacao') {
    if (!d.plot_id) return { error: 'Escolha o talhão.' }
    const lines = readSprayLines(formData)
    if ('error' in lines) return lines

    const [{ data: plot }, { data: products }] = await Promise.all([
      w.supabase.from('plots').select('area, crop_id').eq('id', d.plot_id).eq('farm_id', w.ctx.farm.id).maybeSingle(),
      w.supabase
        .from('products')
        .select('id, name, unit, active_ingredient')
        .eq('farm_id', w.ctx.farm.id)
        .in('id', lines.map((l) => l.product_id)),
    ])
    if (!plot) return { error: 'Talhão não encontrado.' }
    const area = d.area ?? Number(plot.area)

    for (const [i, l] of lines.entries()) {
      const p = (products ?? []).find((x) => x.id === l.product_id)
      if (!p) return { error: `Produto da linha ${i + 1} não encontrado no estoque.` }
      const q = sprayQuantity({ dose: l.dose, doseUnit: l.dose_unit, areaHa: area, sprayLha: d.spray_volume, productUnit: p.unit })
      if (!q.ok) return { error: `${p.name}: ${q.reason}` }
      appRows.push({
        plot_id: d.plot_id,
        crop_id: plot.crop_id,
        product_id: p.id,
        product_name: p.name,
        active_ingredient: p.active_ingredient,
        dose: l.dose,
        dose_unit: l.dose_unit,
        area,
        spray_volume: d.spray_volume,
        total_quantity: round(q.quantity, 3),
        machine_id: d.machine_id,
        implement_id: d.implement_id,
        responsible: d.assignee,
        status: 'programada',
        scheduled_date: d.scheduled_date,
        cost: 0,
      })
    }
    Object.assign(base, {
      plot_id: d.plot_id,
      machine_id: d.machine_id,
      implement_id: d.implement_id,
      area,
      spray_volume: d.spray_volume,
      tank_capacity: d.tank_capacity,
    })
  } else if (d.kind === 'colheita') {
    if (!d.plot_id) return { error: 'Escolha o talhão.' }
    Object.assign(base, {
      plot_id: d.plot_id,
      variety_id: d.variety_id,
      expected_quantity: d.expected_quantity,
      expected_unit: d.expected_quantity ? (d.expected_unit ?? 'kg') : null,
      destination: d.destination,
      team_size: teamSize,
    })
  } else {
    if (!d.machine_id) return { error: 'Escolha a máquina.' }
    Object.assign(base, {
      machine_id: d.machine_id,
      plot_id: d.plot_id,
      log_type: d.log_type ?? 'preventiva',
      checklist: d.checklist,
    })
  }

  // --- grava a OS
  let orderId = id
  let number: number | null = null
  if (id) {
    const { error } = await w.supabase.from('service_orders').update(base).eq('id', id).eq('farm_id', w.ctx.farm.id)
    if (error) return { error: dbError(error.message) }
  } else {
    const { data, error } = await w.supabase
      .from('service_orders')
      .insert({
        ...base,
        farm_id: w.ctx.farm.id,
        season_id: w.ctx.season?.id ?? null,
        created_by: w.ctx.userId,
        number: 0, // o gatilho numera
      })
      .select('id, number')
      .single()
    if (error || !data) return { error: dbError(error?.message ?? '') }
    orderId = data.id
    number = data.number
  }

  // --- calda: as pulverizacoes programadas da OS sao refeitas a cada edicao
  if (d.kind === 'pulverizacao' && orderId) {
    await w.supabase
      .from('applications')
      .delete()
      .eq('service_order_id', orderId)
      .eq('farm_id', w.ctx.farm.id)
      .neq('status', 'realizada')
    appRows = appRows.map((r) => ({
      ...r,
      farm_id: w.ctx.farm.id,
      season_id: w.ctx.season?.id ?? null,
      created_by: w.ctx.userId,
      service_order_id: orderId,
    }))
    const { error } = await w.supabase.from('applications').insert(appRows as never)
    if (error) {
      // OS nova sem calda nao serve para nada: desfaz.
      if (!id) await w.supabase.from('service_orders').delete().eq('id', orderId).eq('farm_id', w.ctx.farm.id)
      return { error: dbError(error.message) }
    }
  }

  refresh()
  return {
    message: id
      ? 'Ordem atualizada.'
      : `OS ${orderNumber(number ?? 0)} de ${ORDER_KIND_LABEL[d.kind].toLowerCase()} criada — gere o PDF na lista abaixo.`,
  }
}

/**
 * Conclui a OS de pulverizacao: todas as pulverizacoes da calda viram
 * realizadas (baixa de estoque e custo pelo custo medio do dia).
 * Colheita e manutencao concluem ao registrar o servico feito.
 */
export async function completeSprayOrder(id: string, date: string): Promise<{ error?: string }> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }
  if (!UUID.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Dados inválidos.' }

  const { data: os } = await w.supabase
    .from('service_orders')
    .select('kind, status')
    .eq('id', id)
    .eq('farm_id', w.ctx.farm.id)
    .maybeSingle()
  if (!os || os.kind !== 'pulverizacao') return { error: 'Ordem de pulverização não encontrada.' }
  if (os.status !== 'aberta') return { error: 'Esta ordem já foi encerrada.' }

  const { data: apps } = await w.supabase
    .from('applications')
    .select('id, total_quantity, product_id, products(unit_cost)')
    .eq('service_order_id', id)
    .eq('farm_id', w.ctx.farm.id)
    .neq('status', 'realizada')

  for (const a of apps ?? []) {
    const unitCost = Number((a.products as { unit_cost: number } | null)?.unit_cost ?? 0)
    const cost = stockCost(a.total_quantity === null ? null : Number(a.total_quantity), unitCost) ?? 0
    const { error } = await w.supabase
      .from('applications')
      .update({ status: 'realizada', application_date: date, cost })
      .eq('id', a.id)
      .eq('farm_id', w.ctx.farm.id)
    if (error) return { error: dbError(error.message) }
  }

  const { error } = await w.supabase
    .from('service_orders')
    .update({ status: 'concluida', completed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('farm_id', w.ctx.farm.id)
  if (error) return { error: dbError(error.message) }

  refresh()
  return {}
}

/** Cancela (ou reabre) a OS. Cancelar tira da agenda as pulverizacoes programadas dela. */
export async function setOrderStatus(id: string, status: 'aberta' | 'cancelada'): Promise<{ error?: string }> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }
  if (!UUID.test(id)) return { error: 'Dados inválidos.' }

  const { data: os } = await w.supabase
    .from('service_orders')
    .select('status')
    .eq('id', id)
    .eq('farm_id', w.ctx.farm.id)
    .maybeSingle()
  if (!os) return { error: 'Ordem não encontrada.' }
  if (os.status === 'concluida') return { error: 'Ordem concluída não muda de situação.' }

  if (status === 'cancelada') {
    await w.supabase
      .from('applications')
      .update({ status: 'cancelada' })
      .eq('service_order_id', id)
      .eq('farm_id', w.ctx.farm.id)
      .eq('status', 'programada')
  } else {
    await w.supabase
      .from('applications')
      .update({ status: 'programada' })
      .eq('service_order_id', id)
      .eq('farm_id', w.ctx.farm.id)
      .eq('status', 'cancelada')
  }
  const { error } = await w.supabase
    .from('service_orders')
    .update({ status, completed_at: null })
    .eq('id', id)
    .eq('farm_id', w.ctx.farm.id)
  if (error) return { error: dbError(error.message) }

  refresh()
  return {}
}
