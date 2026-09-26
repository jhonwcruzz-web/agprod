'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
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

const zeroOrMore = decimal.transform((v) => v ?? 0)

const machineSchema = z.object({
  class: z.enum(['maquina', 'implemento']),
  kind: optionalText,
  name: z.string().trim().min(1, 'Dê um nome para identificar'),
  brand: optionalText,
  model: optionalText,
  year: decimal,
  identifier: optionalText,
  power_hp: decimal,
  meter_type: z.enum(['horas', 'km', 'nenhum']).default('horas'),
  current_meter: zeroOrMore,
  acquisition_date: optionalDate,
  acquisition_value: decimal,
  coupled_to: optionalUuid,
  status: z.enum(['operacional', 'manutencao', 'inativo']).default('operacional'),
  notes: optionalText,
})

function toRow(d: z.infer<typeof machineSchema>) {
  return {
    ...d,
    year: d.year ? Math.round(d.year) : null,
    // Implemento nao tem motor: potencia e horimetro nao se aplicam.
    power_hp: d.class === 'implemento' ? null : d.power_hp,
    meter_type: d.class === 'implemento' ? ('nenhum' as const) : d.meter_type,
    current_meter: d.class === 'implemento' ? 0 : d.current_meter,
    coupled_to: d.class === 'implemento' ? d.coupled_to : null,
  }
}

export async function createMachine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = machineSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const { data, error } = await w.supabase
    .from('machines')
    .insert({ farm_id: w.ctx.farm.id, ...toRow(parsed.data) })
    .select('id')
    .single()

  if (error || !data) {
    if (error?.message.includes('Acoplamento invalido'))
      return { error: 'Escolha uma máquina desta propriedade para o acoplamento.' }
    return { error: dbError(error?.message ?? '') }
  }

  revalidatePath('/maquinas')
  redirect(`/maquinas/${data.id}` as Route)
}

export async function updateMachine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Máquina não identificada.' }

  const parsed = machineSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  if (parsed.data.coupled_to === id) return { error: 'Um implemento não pode acoplar em si mesmo.' }

  const { error } = await w.supabase
    .from('machines')
    .update(toRow(parsed.data))
    .eq('id', id)
    .eq('farm_id', w.ctx.farm.id)

  if (error) {
    if (error.message.includes('Acoplamento invalido'))
      return { error: 'Escolha uma máquina desta propriedade para o acoplamento.' }
    return { error: dbError(error.message) }
  }

  revalidatePath(`/maquinas/${id}`)
  revalidatePath('/maquinas')
  return { message: 'Cadastro atualizado.' }
}

// ------------------------------------------------------------------ diario

const logSchema = z.object({
  machine_id: z.uuid('Escolha a máquina'),
  log_type: z.enum(['preventiva', 'corretiva', 'revisao', 'abastecimento']),
  log_date: z.string().min(10, 'Informe a data'),
  description: optionalText,
  meter_reading: decimal,
  liters: decimal,
  cost: zeroOrMore,
  next_due_date: optionalDate,
  next_due_meter: decimal,
  plot_id: optionalUuid,
  supplier: optionalText,
  responsible: optionalText,
  notes: optionalText,
})

export async function createMachineLog(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const w = await requireWriteContext()
  if ('error' in w) return { error: w.error }

  const parsed = logSchema.safeParse(formToObject(formData))
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const d = parsed.data
  if (d.log_type === 'abastecimento' && !d.liters)
    return { error: 'Informe quantos litros foram abastecidos.' }
  if (d.log_type !== 'abastecimento' && !d.description)
    return { error: 'Descreva o que foi feito.' }

  // Ao informar a proxima pelo horimetro, ela precisa estar a' frente.
  if (d.next_due_meter !== null && d.meter_reading !== null && d.next_due_meter <= d.meter_reading)
    return { error: 'A próxima manutenção precisa ser depois da leitura atual.' }

  const { error } = await w.supabase.from('machine_logs').insert({
    farm_id: w.ctx.farm.id,
    season_id: w.ctx.season?.id ?? null,
    created_by: w.ctx.userId,
    ...d,
    liters: d.log_type === 'abastecimento' ? d.liters : null,
  })

  if (error) {
    if (error.message.includes('nao pertence'))
      return { error: 'Máquina não encontrada nesta propriedade.' }
    return { error: dbError(error.message) }
  }

  revalidatePath('/maquinas')
  revalidatePath(`/maquinas/${d.machine_id}`)
  revalidatePath('/custos')
  revalidatePath('/')
  return {
    message:
      d.log_type === 'abastecimento'
        ? 'Abastecimento registrado e lançado em combustível.'
        : 'Registro salvo e lançado nos custos.',
  }
}

export async function setMachineStatus(id: string, status: 'operacional' | 'manutencao' | 'inativo') {
  const w = await requireWriteContext()
  if ('error' in w) return

  await w.supabase
    .from('machines')
    .update({ status })
    .eq('id', id)
    .eq('farm_id', w.ctx.farm.id)

  revalidatePath('/maquinas')
  revalidatePath(`/maquinas/${id}`)
}
