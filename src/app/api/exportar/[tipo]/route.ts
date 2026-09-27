import ExcelJS from 'exceljs'
import { NextResponse } from 'next/server'
import { getFarmContext } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { byDate, eqIf, readFilters, type Filters } from '@/lib/filters'
import { getPlotPerformance } from '@/lib/queries/plot-performance'
import { APP_NAME } from '@/lib/config'
import { LOG_TYPE_LABEL, MACHINE_STATUS_LABEL } from '@/lib/format'

/**
 * Exportacao para Excel. Mesma sessao, mesmo RLS, mesma safra e mesmos
 * filtros da tela — a planilha e' o que o produtor esta vendo.
 */

type Kind = 'money' | 'number' | 'date' | 'text' | 'int'
type Col = { header: string; key: string; kind?: Kind; width?: number }
type Sheet = { name: string; columns: Col[]; rows: Record<string, unknown>[] }

const MAX_ROWS = 20000
const FMT: Record<Kind, string | undefined> = {
  money: '"R$" #,##0.00',
  number: '#,##0.00',
  int: '#,##0',
  date: 'dd/mm/yyyy',
  text: undefined,
}

type Ctx = NonNullable<Awaited<ReturnType<typeof getFarmContext>>>
type Supa = Awaited<ReturnType<typeof createClient>>

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

async function categoryNames(db: Supa) {
  const { data } = await db.from('expense_categories').select('code, name')
  return new Map((data ?? []).map((c) => [c.code, c.name]))
}

const REPORTS: Record<string, { title: string; build: (db: Supa, ctx: Ctx, f: Filters) => Promise<Sheet[]> }> = {
  colheitas: {
    title: 'Colheitas',
    async build(db, ctx, f) {
      let q = db
        .from('production_records')
        .select('harvest_date, quantity, unit, quantity_kg, destination, team, notes, plots(code), varieties(name)')
        .eq('farm_id', ctx.farm.id)
      if (ctx.season) q = q.eq('season_id', ctx.season.id)
      q = eqIf(byDate(q, 'harvest_date', f), 'plot_id', f.talhao)
      const { data } = await q.order('harvest_date', { ascending: false }).limit(MAX_ROWS)
      return [{
        name: 'Colheitas',
        columns: [
          { header: 'Data', key: 'd', kind: 'date' },
          { header: 'Talhão', key: 't' },
          { header: 'Variedade', key: 'v', width: 20 },
          { header: 'Quantidade', key: 'q', kind: 'number' },
          { header: 'Unidade', key: 'u' },
          { header: 'Total (kg)', key: 'kg', kind: 'number' },
          { header: 'Destino', key: 'dest', width: 20 },
          { header: 'Equipe', key: 'eq', width: 18 },
          { header: 'Observações', key: 'obs', width: 30 },
        ],
        rows: (data ?? []).map((r) => ({
          d: r.harvest_date, t: one(r.plots)?.code, v: one(r.varieties)?.name, q: r.quantity, u: r.unit,
          kg: r.quantity_kg, dest: r.destination, eq: r.team, obs: r.notes,
        })),
      }]
    },
  },

  pulverizacoes: {
    title: 'Pulverizações',
    async build(db, ctx, f) {
      let q = db
        .from('applications')
        .select('status, application_date, scheduled_date, product_name, active_ingredient, dose, dose_unit, area, spray_volume, total_quantity, cost, responsible, notes, plots(code), machine:machines!applications_machine_id_fkey(name), implement:machines!applications_implement_id_fkey(name), products(unit)')
        .eq('farm_id', ctx.farm.id)
      if (ctx.season) q = q.eq('season_id', ctx.season.id)
      q = eqIf(eqIf(eqIf(byDate(q, 'application_date', f), 'plot_id', f.talhao), 'machine_id', f.maquina), 'product_id', f.produto)
      const { data } = await q.order('application_date', { ascending: false }).limit(MAX_ROWS)
      return [{
        name: 'Pulverizações',
        columns: [
          { header: 'Data', key: 'd', kind: 'date' },
          { header: 'Situação', key: 's' },
          { header: 'Talhão', key: 't' },
          { header: 'Produto', key: 'p', width: 26 },
          { header: 'Ingrediente ativo', key: 'ia', width: 24 },
          { header: 'Dose', key: 'dose', kind: 'number' },
          { header: 'Unid. dose', key: 'du' },
          { header: 'Área (ha)', key: 'a', kind: 'number' },
          { header: 'Calda (L/ha)', key: 'cal', kind: 'number' },
          { header: 'Qtd. gasta', key: 'qt', kind: 'number' },
          { header: 'Unid.', key: 'un' },
          { header: 'Custo', key: 'c', kind: 'money' },
          { header: 'Trator', key: 'm', width: 20 },
          { header: 'Implemento', key: 'i', width: 20 },
          { header: 'Responsável', key: 'r', width: 18 },
        ],
        rows: (data ?? []).map((r) => ({
          d: r.application_date ?? r.scheduled_date, s: r.status, t: one(r.plots)?.code, p: r.product_name,
          ia: r.active_ingredient, dose: r.dose, du: r.dose_unit, a: r.area, cal: r.spray_volume,
          qt: r.total_quantity, un: one(r.products)?.unit, c: r.cost, m: one(r.machine)?.name,
          i: one(r.implement)?.name, r: r.responsible,
        })),
      }]
    },
  },

  adubacoes: {
    title: 'Adubações',
    async build(db, ctx, f) {
      let q = db
        .from('fertilizations')
        .select('fertilization_date, product_name, fert_type, quantity, unit, dose_per_ha, area, cost, application_method, responsible, plots(code), machine:machines!fertilizations_machine_id_fkey(name), implement:machines!fertilizations_implement_id_fkey(name)')
        .eq('farm_id', ctx.farm.id)
      if (ctx.season) q = q.eq('season_id', ctx.season.id)
      q = eqIf(eqIf(eqIf(byDate(q, 'fertilization_date', f), 'plot_id', f.talhao), 'machine_id', f.maquina), 'product_id', f.produto)
      const { data } = await q.order('fertilization_date', { ascending: false }).limit(MAX_ROWS)
      return [{
        name: 'Adubações',
        columns: [
          { header: 'Data', key: 'd', kind: 'date' },
          { header: 'Talhão', key: 't' },
          { header: 'Produto', key: 'p', width: 26 },
          { header: 'Tipo', key: 'ty' },
          { header: 'Quantidade', key: 'q', kind: 'number' },
          { header: 'Unid.', key: 'u' },
          { header: 'Dose/ha', key: 'dh', kind: 'number' },
          { header: 'Área (ha)', key: 'a', kind: 'number' },
          { header: 'Custo', key: 'c', kind: 'money' },
          { header: 'Forma', key: 'f', width: 18 },
          { header: 'Trator', key: 'm', width: 20 },
          { header: 'Implemento', key: 'i', width: 20 },
        ],
        rows: (data ?? []).map((r) => ({
          d: r.fertilization_date, t: one(r.plots)?.code, p: r.product_name, ty: r.fert_type, q: r.quantity,
          u: r.unit, dh: r.dose_per_ha, a: r.area, c: r.cost, f: r.application_method,
          m: one(r.machine)?.name, i: one(r.implement)?.name,
        })),
      }]
    },
  },

  custos: {
    title: 'Custos',
    async build(db, ctx, f) {
      const names = await categoryNames(db)
      let q = db
        .from('expenses')
        .select('expense_date, category, description, amount, status, paid_amount, due_date, supplier, is_production_cost, source_table, plots(code)')
        .eq('farm_id', ctx.farm.id)
      if (ctx.season) q = q.eq('season_id', ctx.season.id)
      q = eqIf(eqIf(byDate(q, 'expense_date', f), 'plot_id', f.talhao), 'category', f.categoria)
      const { data } = await q.order('expense_date', { ascending: false }).limit(MAX_ROWS)
      const SRC: Record<string, string> = { applications: 'Pulverização', fertilizations: 'Adubação', machine_logs: 'Máquina', irrigation_records: 'Irrigação' }
      return [{
        name: 'Custos',
        columns: [
          { header: 'Data', key: 'd', kind: 'date' },
          { header: 'Categoria', key: 'cat', width: 18 },
          { header: 'Descrição', key: 'desc', width: 36 },
          { header: 'Talhão', key: 't' },
          { header: 'Valor', key: 'v', kind: 'money' },
          { header: 'Situação', key: 's' },
          { header: 'Pago', key: 'pg', kind: 'money' },
          { header: 'Vencimento', key: 'venc', kind: 'date' },
          { header: 'Fornecedor', key: 'f', width: 20 },
          { header: 'Custo de produção?', key: 'cp' },
          { header: 'Origem', key: 'o' },
        ],
        rows: (data ?? []).map((r) => ({
          d: r.expense_date, cat: names.get(r.category) ?? r.category, desc: r.description, t: one(r.plots)?.code,
          v: r.amount, s: r.status, pg: r.paid_amount, venc: r.due_date, f: r.supplier,
          cp: r.is_production_cost ? 'Sim' : 'Não (compra p/ estoque)',
          o: r.source_table ? SRC[r.source_table] ?? r.source_table : 'Lançamento manual',
        })),
      }]
    },
  },

  vendas: {
    title: 'Vendas',
    async build(db, ctx, f) {
      let q = db
        .from('sales')
        .select('sale_date, quantity, unit, quantity_kg, price_per_kg, total_amount, received_amount, status, payment_method, due_date, notes, buyers(name), plots(code), varieties(name)')
        .eq('farm_id', ctx.farm.id)
      if (ctx.season) q = q.eq('season_id', ctx.season.id)
      q = eqIf(eqIf(byDate(q, 'sale_date', f), 'plot_id', f.talhao), 'buyer_id', f.comprador)
      const { data } = await q.order('sale_date', { ascending: false }).limit(MAX_ROWS)
      return [{
        name: 'Vendas',
        columns: [
          { header: 'Data', key: 'd', kind: 'date' },
          { header: 'Comprador', key: 'b', width: 24 },
          { header: 'Talhão', key: 't' },
          { header: 'Variedade', key: 'v', width: 18 },
          { header: 'Quantidade', key: 'q', kind: 'number' },
          { header: 'Unid.', key: 'u' },
          { header: 'Total (kg)', key: 'kg', kind: 'number' },
          { header: 'Preço/kg', key: 'p', kind: 'money' },
          { header: 'Valor total', key: 'tot', kind: 'money' },
          { header: 'Recebido', key: 'rec', kind: 'money' },
          { header: 'A receber', key: 'ar', kind: 'money' },
          { header: 'Situação', key: 's' },
          { header: 'Pagamento', key: 'pm' },
          { header: 'Vencimento', key: 'venc', kind: 'date' },
        ],
        rows: (data ?? []).map((r) => ({
          d: r.sale_date, b: one(r.buyers)?.name, t: one(r.plots)?.code, v: one(r.varieties)?.name, q: r.quantity,
          u: r.unit, kg: r.quantity_kg, p: r.price_per_kg, tot: r.total_amount, rec: r.received_amount,
          ar: Number(r.total_amount) - Number(r.received_amount), s: r.status, pm: r.payment_method, venc: r.due_date,
        })),
      }]
    },
  },

  estoque: {
    title: 'Estoque',
    async build(db, ctx, f) {
      let q = db.from('v_stock_status').select('*').eq('farm_id', ctx.farm.id)
      q = eqIf(q, 'category_id', f.categoria)
      const { data: stock } = await q.order('name')
      let m = db
        .from('inventory_movements')
        .select('movement_date, movement_type, quantity, unit_cost, total_cost, notes, source_table, products(name, unit)')
        .eq('farm_id', ctx.farm.id)
      m = eqIf(byDate(m, 'movement_date', f), 'product_id', f.produto)
      const { data: moves } = await m.order('movement_date', { ascending: false }).limit(MAX_ROWS)
      const SRC: Record<string, string> = { applications: 'Pulverização', fertilizations: 'Adubação', machine_logs: 'Máquina' }
      return [
        {
          name: 'Saldo',
          columns: [
            { header: 'Produto', key: 'n', width: 28 },
            { header: 'Categoria', key: 'c', width: 18 },
            { header: 'Unid.', key: 'u' },
            { header: 'Saldo', key: 's', kind: 'number' },
            { header: 'Mínimo', key: 'm', kind: 'number' },
            { header: 'Custo médio', key: 'cm', kind: 'money' },
            { header: 'Valor em estoque', key: 'v', kind: 'money' },
            { header: 'Situação', key: 'st' },
          ],
          rows: (stock ?? []).map((r) => ({
            n: r.name, c: r.category, u: r.unit, s: r.current_stock, m: r.min_stock, cm: r.unit_cost,
            v: r.stock_value, st: r.stock_level,
          })),
        },
        {
          name: 'Movimentos',
          columns: [
            { header: 'Data', key: 'd', kind: 'date' },
            { header: 'Produto', key: 'p', width: 28 },
            { header: 'Tipo', key: 't' },
            { header: 'Quantidade', key: 'q', kind: 'number' },
            { header: 'Unid.', key: 'u' },
            { header: 'Custo unit.', key: 'cu', kind: 'money' },
            { header: 'Valor', key: 'v', kind: 'money' },
            { header: 'Origem', key: 'o' },
            { header: 'Observação', key: 'n', width: 26 },
          ],
          rows: (moves ?? []).map((r) => ({
            d: r.movement_date, p: one(r.products)?.name, t: r.movement_type, q: r.quantity, u: one(r.products)?.unit,
            cu: r.unit_cost, v: r.total_cost, o: r.source_table ? SRC[r.source_table] ?? r.source_table : 'Manual', n: r.notes,
          })),
        },
      ]
    },
  },

  maquinas: {
    title: 'Máquinas',
    async build(db, ctx, f) {
      const { data: status } = await db.from('v_machine_status').select('*').eq('farm_id', ctx.farm.id).order('name')
      let l = db
        .from('machine_logs')
        .select('log_date, log_type, description, meter_reading, liters, product_quantity, cost, supplier, responsible, machines(name), products(name, unit)')
        .eq('farm_id', ctx.farm.id)
      l = eqIf(byDate(l, 'log_date', f), 'machine_id', f.maquina)
      const { data: logs } = await l.order('log_date', { ascending: false }).limit(MAX_ROWS)
      return [
        {
          name: 'Máquinas',
          columns: [
            { header: 'Nome', key: 'n', width: 26 },
            { header: 'Classe', key: 'cl' },
            { header: 'Tipo', key: 't', width: 16 },
            { header: 'Marca/modelo', key: 'mm', width: 24 },
            { header: 'Ano', key: 'a', kind: 'int' },
            { header: 'Uso atual', key: 'u', kind: 'number' },
            { header: 'Situação', key: 's' },
            { header: 'Próxima manutenção', key: 'pd', kind: 'date' },
            { header: 'Próx. (uso)', key: 'pm', kind: 'number' },
            { header: 'Custo manutenção', key: 'cm', kind: 'money' },
            { header: 'Custo combustível', key: 'cc', kind: 'money' },
            { header: 'Litros', key: 'l', kind: 'number' },
          ],
          rows: (status ?? []).map((r) => ({
            n: r.name, cl: r.class, t: r.kind, mm: [r.brand, r.model].filter(Boolean).join(' '), a: r.year,
            u: r.current_meter, s: MACHINE_STATUS_LABEL[r.status ?? ''] ?? r.status, pd: r.next_due_date,
            pm: r.next_due_meter, cm: r.maintenance_cost, cc: r.fuel_cost, l: r.fuel_liters,
          })),
        },
        {
          name: 'Registros',
          columns: [
            { header: 'Data', key: 'd', kind: 'date' },
            { header: 'Máquina', key: 'm', width: 24 },
            { header: 'Tipo', key: 't', width: 20 },
            { header: 'Descrição', key: 'desc', width: 32 },
            { header: 'Leitura', key: 'r', kind: 'number' },
            { header: 'Litros', key: 'l', kind: 'number' },
            { header: 'Produto do estoque', key: 'p', width: 22 },
            { header: 'Qtd.', key: 'q', kind: 'number' },
            { header: 'Valor', key: 'c', kind: 'money' },
            { header: 'Fornecedor', key: 'f', width: 20 },
          ],
          rows: (logs ?? []).map((r) => ({
            d: r.log_date, m: one(r.machines)?.name, t: LOG_TYPE_LABEL[r.log_type] ?? r.log_type, desc: r.description,
            r: r.meter_reading, l: r.liters, p: one(r.products)?.name, q: r.product_quantity, c: r.cost, f: r.supplier,
          })),
        },
      ]
    },
  },

  talhoes: {
    title: 'Talhões',
    async build(_db, ctx) {
      const rows = await getPlotPerformance(ctx.farm.id, ctx.season?.id)
      return [{
        name: 'Talhões',
        columns: [
          { header: 'Talhão', key: 'c' },
          { header: 'Cultura', key: 'cr', width: 14 },
          { header: 'Variedade', key: 'v', width: 18 },
          { header: 'Área (ha)', key: 'a', kind: 'number' },
          { header: 'Produção (kg)', key: 'p', kind: 'number' },
          { header: 'kg/ha', key: 'kh', kind: 'number' },
          { header: 'Custo', key: 'cu', kind: 'money' },
          { header: 'Custo/kg', key: 'ck', kind: 'money' },
          { header: 'Receita', key: 'r', kind: 'money' },
          { header: 'Resultado', key: 're', kind: 'money' },
        ],
        rows: rows.map((r) => ({
          c: r.code, cr: r.crop_name, v: r.variety_name, a: r.area, p: r.production_kg, kh: r.kg_per_ha,
          cu: r.total_cost, ck: r.cost_per_kg, r: r.revenue, re: r.result,
        })),
      }]
    },
  },

  financeiro: {
    title: 'Financeiro',
    async build(db, ctx, f) {
      const names = await categoryNames(db)
      let r = db.from('revenues').select('revenue_date, description, amount, received_amount, status, due_date').eq('farm_id', ctx.farm.id)
      r = byDate(r, 'revenue_date', f)
      let e = db.from('expenses').select('expense_date, category, description, amount, paid_amount, status, due_date, supplier').eq('farm_id', ctx.farm.id)
      e = eqIf(byDate(e, 'expense_date', f), 'category', f.categoria)
      const [{ data: revs }, { data: exps }] = await Promise.all([
        r.order('revenue_date', { ascending: false }).limit(MAX_ROWS),
        e.order('expense_date', { ascending: false }).limit(MAX_ROWS),
      ])
      return [
        {
          name: 'Receitas',
          columns: [
            { header: 'Data', key: 'd', kind: 'date' },
            { header: 'Descrição', key: 'desc', width: 34 },
            { header: 'Valor', key: 'v', kind: 'money' },
            { header: 'Recebido', key: 'rec', kind: 'money' },
            { header: 'A receber', key: 'ar', kind: 'money' },
            { header: 'Situação', key: 's' },
            { header: 'Vencimento', key: 'venc', kind: 'date' },
          ],
          rows: (revs ?? []).map((x) => ({
            d: x.revenue_date, desc: x.description, v: x.amount, rec: x.received_amount,
            ar: Number(x.amount) - Number(x.received_amount), s: x.status, venc: x.due_date,
          })),
        },
        {
          name: 'Despesas',
          columns: [
            { header: 'Data', key: 'd', kind: 'date' },
            { header: 'Categoria', key: 'cat', width: 18 },
            { header: 'Descrição', key: 'desc', width: 34 },
            { header: 'Valor', key: 'v', kind: 'money' },
            { header: 'Pago', key: 'pg', kind: 'money' },
            { header: 'A pagar', key: 'ap', kind: 'money' },
            { header: 'Situação', key: 's' },
            { header: 'Vencimento', key: 'venc', kind: 'date' },
            { header: 'Fornecedor', key: 'f', width: 20 },
          ],
          rows: (exps ?? []).map((x) => ({
            d: x.expense_date, cat: names.get(x.category) ?? x.category, desc: x.description, v: x.amount,
            pg: x.paid_amount, ap: Number(x.amount) - Number(x.paid_amount), s: x.status, venc: x.due_date, f: x.supplier,
          })),
        },
      ]
    },
  },
}

/** Data 'YYYY-MM-DD' vira Date ao meio-dia UTC: nao muda de dia no Excel. */
function cellValue(v: unknown, kind: Kind | undefined) {
  if (v === null || v === undefined || v === '') return null
  if (kind === 'date') return typeof v === 'string' ? new Date(`${v.slice(0, 10)}T12:00:00Z`) : v
  if (kind === 'money' || kind === 'number' || kind === 'int') return Number(v)
  return v
}

export async function GET(request: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params
  const report = REPORTS[tipo]
  if (!report) return NextResponse.json({ error: 'Relatório desconhecido' }, { status: 404 })

  const ctx = await getFarmContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = await createClient()
  const filters = readFilters(new URL(request.url).searchParams)
  const sheets = await report.build(db, ctx, filters)

  const wb = new ExcelJS.Workbook()
  wb.creator = APP_NAME
  wb.created = new Date()

  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name, { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = s.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width ?? Math.max(12, c.header.length + 4),
      style: FMT[c.kind ?? 'text'] ? { numFmt: FMT[c.kind ?? 'text'] } : {},
    }))
    for (const r of s.rows) {
      ws.addRow(Object.fromEntries(s.columns.map((c) => [c.key, cellValue(r[c.key], c.kind)])))
    }
    const header = ws.getRow(1)
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3A6042' } }
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.columns.length } }

    // Linha de total para as colunas de valor.
    const moneyCols = s.columns.filter((c) => c.kind === 'money')
    if (s.rows.length > 0 && moneyCols.length > 0) {
      const total = ws.addRow({})
      total.getCell(1).value = 'Total'
      total.font = { bold: true }
      for (const c of moneyCols) {
        const col = ws.getColumn(c.key)
        const letter = col.letter
        total.getCell(c.key).value = { formula: `SUBTOTAL(9,${letter}2:${letter}${s.rows.length + 1})` }
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const safra = ctx.season ? `-safra-${ctx.season.name}` : ''
  const stamp = new Date().toISOString().slice(0, 10)
  const file = `${APP_NAME.toLowerCase()}-${tipo}${safra}-${stamp}.xlsx`

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${file}"`,
      'Cache-Control': 'no-store',
    },
  })
}
