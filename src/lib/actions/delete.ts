'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { dbError, requireWriteContext } from './shared'

/**
 * Excluir qualquer lancamento ou cadastro — uma acao so', com uma lista
 * fechada do que pode ser excluido e as regras de cada tipo.
 *
 * O que os triggers ja' desfazem sozinhos ao excluir:
 *  - pulverizacao/adubacao/maquina: a baixa de estoque e o custo gerado;
 *  - venda: a receita no financeiro;
 *  - compra/saida de estoque: o saldo do produto.
 *
 * O que e' bloqueado, porque deixaria numeros incoerentes:
 *  - custo ou movimento gerado automaticamente (exclui-se a origem);
 *  - safra com lancamentos (eles sumiriam das telas por safra);
 *  - categoria em uso.
 */
export type DeletableKind =
  | 'colheita'
  | 'pulverizacao'
  | 'adubacao'
  | 'irrigacao'
  | 'despesa'
  | 'venda'
  | 'comprador'
  | 'produto'
  | 'movimento'
  | 'maquina'
  | 'registro_maquina'
  | 'talhao'
  | 'safra'
  | 'categoria_custo'
  | 'categoria_estoque'
  | 'destino'
  | 'ordem'

const TABLE: Record<DeletableKind, string> = {
  colheita: 'production_records',
  pulverizacao: 'applications',
  adubacao: 'fertilizations',
  irrigacao: 'irrigation_records',
  despesa: 'expenses',
  venda: 'sales',
  comprador: 'buyers',
  produto: 'products',
  movimento: 'inventory_movements',
  maquina: 'machines',
  registro_maquina: 'machine_logs',
  talhao: 'plots',
  safra: 'seasons',
  categoria_custo: 'expense_categories',
  categoria_estoque: 'product_categories',
  destino: 'harvest_destinations',
  ordem: 'service_orders',
}

const PATHS: Record<DeletableKind, string[]> = {
  colheita: ['/producao', '/talhoes'],
  pulverizacao: ['/pulverizacao', '/estoque', '/custos', '/talhoes'],
  adubacao: ['/adubacao', '/estoque', '/custos', '/talhoes'],
  irrigacao: ['/irrigacao', '/talhoes', '/custos'],
  despesa: ['/custos', '/financeiro', '/talhoes'],
  venda: ['/comercializacao', '/financeiro', '/talhoes'],
  comprador: ['/comercializacao'],
  produto: ['/estoque'],
  movimento: ['/estoque', '/financeiro'],
  maquina: ['/maquinas', '/custos'],
  registro_maquina: ['/maquinas', '/custos', '/estoque'],
  talhao: ['/talhoes', '/producao'],
  safra: ['/safras'],
  categoria_custo: ['/custos'],
  categoria_estoque: ['/estoque'],
  destino: ['/producao'],
  ordem: ['/ordens', '/pulverizacao'],
}

export type DeleteResult = { ok: true; message: string } | { ok: false; error: string }

/** Cliente sem tipos de tabela: a tabela vem da lista fechada TABLE. */
type Db = SupabaseClient

async function countWhere(db: Db, table: string, column: string, value: string): Promise<number> {
  const { count } = await db.from(table).select('id', { count: 'exact', head: true }).eq(column, value)
  return count ?? 0
}

export async function deleteRecord(kind: DeletableKind, id: string): Promise<DeleteResult> {
  if (!(kind in TABLE) || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: 'Registro inválido.' }

  const w = await requireWriteContext()
  if ('error' in w) return { ok: false, error: w.error ?? 'Sem permissão.' }
  if (w.ctx.role !== 'owner' && w.ctx.role !== 'admin')
    return { ok: false, error: 'Só o proprietário ou um administrador pode excluir.' }

  const db = w.supabase as unknown as Db
  const table = TABLE[kind]
  const farmId = w.ctx.farm.id

  // Categorias e destinos: so' os criados pela fazenda (os padrao sao de
  // todos e nao se apagam).
  const isCatalog = kind === 'categoria_custo' || kind === 'categoria_estoque' || kind === 'destino'
  const { data: row } = isCatalog
    ? await db.from(table).select('*').eq('id', id).maybeSingle()
    : await db.from(table).select('*').eq('id', id).eq('farm_id', farmId).maybeSingle()
  if (!row) return { ok: false, error: 'Registro não encontrado nesta propriedade.' }
  if (isCatalog && row.farm_id !== farmId)
    return { ok: false, error: 'As opções padrão do sistema não podem ser excluídas.' }

  // --- regras por tipo
  if ((kind === 'despesa' || kind === 'movimento') && row.source_table)
    return {
      ok: false,
      error: 'Este lançamento foi gerado automaticamente — exclua a pulverização, adubação ou registro de máquina que o gerou.',
    }

  if (kind === 'safra') {
    for (const t of ['production_records', 'expenses', 'sales', 'applications', 'fertilizations', 'machine_logs']) {
      if ((await countWhere(db, t, 'season_id', id)) > 0)
        return { ok: false, error: 'Esta safra tem lançamentos. Exclua ou mude os lançamentos antes de excluir a safra.' }
    }
  }

  if (kind === 'categoria_custo') {
    const used = await countWhere(db, 'expenses', 'category', String(row.code))
    if (used > 0) return { ok: false, error: `Categoria em uso em ${used} lançamento(s) — não pode ser excluída.` }
  }

  if (kind === 'categoria_estoque') {
    const used = await countWhere(db, 'products', 'category_id', id)
    if (used > 0) return { ok: false, error: `Categoria em uso em ${used} produto(s) — não pode ser excluída.` }
  }

  // Produto com historico nao some: vira inativo, para nao apagar as baixas
  // e o custo ja' lancados.
  if (kind === 'produto' && (await countWhere(db, 'inventory_movements', 'product_id', id)) > 0) {
    const { error } = await db.from('products').update({ is_active: false }).eq('id', id).eq('farm_id', farmId)
    if (error) return { ok: false, error: dbError(error.message) }
    for (const p of PATHS[kind]) revalidatePath(p)
    return { ok: true, message: 'Produto tem histórico de movimentos — foi arquivado em vez de excluído.' }
  }

  // Talhao com lancamentos: apagar levaria junto o historico de custo e
  // producao. O caminho e' marcar o talhao como inativo no cadastro.
  if (kind === 'talhao') {
    for (const t of ['production_records', 'applications', 'fertilizations', 'expenses', 'sales', 'machine_logs']) {
      if ((await countWhere(db, t, 'plot_id', id)) > 0)
        return {
          ok: false,
          error: 'Este talhão tem lançamentos. Para tirá-lo de uso, edite o cadastro e mude a situação.',
        }
    }
  }

  // Maquina com historico vira inativa (o custo ja' lancado continua valendo).
  if (kind === 'maquina') {
    let used = await countWhere(db, 'machine_logs', 'machine_id', id)
    for (const t of ['applications', 'fertilizations']) {
      used += await countWhere(db, t, 'machine_id', id)
      used += await countWhere(db, t, 'implement_id', id)
    }
    if (used > 0) {
      const { error } = await db.from('machines').update({ status: 'inativo' }).eq('id', id).eq('farm_id', farmId)
      if (error) return { ok: false, error: dbError(error.message) }
      for (const p of PATHS[kind]) revalidatePath(p)
      return { ok: true, message: 'Máquina tem histórico — foi marcada como inativa em vez de excluída.' }
    }
  }

  // OS: as pulverizacoes da calda que ainda nao foram feitas saem junto
  // (as ja' realizadas ficam — sao historico de estoque e custo).
  if (kind === 'ordem') {
    const { error } = await db
      .from('applications')
      .delete()
      .eq('service_order_id', id)
      .eq('farm_id', farmId)
      .neq('status', 'realizada')
    if (error) return { ok: false, error: dbError(error.message) }
  }

  // --- exclusao
  const { data, error } = await db.from(table).delete().eq('id', id).eq('farm_id', farmId).select('id')
  if (error) return { ok: false, error: dbError(error.message) }
  if (!data || data.length === 0) return { ok: false, error: 'Não foi possível excluir (sem permissão).' }

  revalidatePath('/')
  for (const p of PATHS[kind]) revalidatePath(p)
  return { ok: true, message: 'Excluído.' }
}
