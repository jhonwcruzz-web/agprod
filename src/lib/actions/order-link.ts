// Uso interno das Server Actions (nao e' uma action: nao tem 'use server').
import { revalidatePath } from 'next/cache'
import type { requireWriteContext } from './shared'

type WriteCtx = Exclude<Awaited<ReturnType<typeof requireWriteContext>>, { error: string }>

const UUID = /^[0-9a-f-]{36}$/i

/**
 * Chamado depois de registrar a colheita ou a manutencao vinda de uma OS:
 * marca a OS como concluida. So' fecha OS aberta, da fazenda e do tipo certo.
 */
export async function closeOrderFromRecord(w: WriteCtx, formData: FormData, kind: 'colheita' | 'manutencao') {
  const osId = String(formData.get('service_order_id') ?? '')
  if (!UUID.test(osId)) return
  await w.supabase
    .from('service_orders')
    .update({ status: 'concluida', completed_at: new Date().toISOString() })
    .eq('id', osId)
    .eq('farm_id', w.ctx.farm.id)
    .eq('kind', kind)
    .eq('status', 'aberta')
  revalidatePath('/ordens')
}
