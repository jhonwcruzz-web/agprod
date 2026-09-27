import Link from 'next/link'
import type { Route } from 'next'
import { RowActions } from '@/components/ui/RowActions'
import type { Metadata } from 'next'
import { requireFarm } from '@/lib/farm'
import { getPlotPerformance } from '@/lib/queries/plot-performance'
import { getAttentionItems, plotLevel } from '@/lib/queries/attention'
import { area, kg, money, num } from '@/lib/format'
import { PageHeader, EmptyState, StatusDot, Section } from '@/components/ui/Layout'
import { ButtonLink, buttonClass } from '@/components/ui/Button'

export const metadata: Metadata = { title: 'Talhões' }

export default async function TalhoesPage() {
  const ctx = await requireFarm()

  const [rows, attention] = await Promise.all([
    getPlotPerformance(ctx.farm.id, ctx.season?.id),
    getAttentionItems(ctx.farm.id, ctx.season?.id),
  ])

  const totals = rows.reduce(
    (a, r) => ({
      area: a.area + Number(r.area ?? 0),
      production: a.production + Number(r.production_kg ?? 0),
      cost: a.cost + Number(r.total_cost ?? 0),
      revenue: a.revenue + Number(r.revenue ?? 0),
    }),
    { area: 0, production: 0, cost: 0, revenue: 0 },
  )

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Talhões"
        subtitle={
          rows.length > 0
            ? `${rows.length} ${rows.length === 1 ? 'talhão' : 'talhões'} · ${area(totals.area)}${
                ctx.season ? ` · Safra ${ctx.season.name}` : ' · todas as safras'
              }`
            : undefined
        }
        actions={
          <>
            {rows.length > 0 && (
              <a href="/api/exportar/talhoes" className={buttonClass('secondary')}>
                Exportar Excel
              </a>
            )}
            <ButtonLink href="/talhoes/novo">Novo talhão</ButtonLink>
          </>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Nenhum talhão cadastrado"
          description="Comece cadastrando as áreas da propriedade. Cada talhão tem sua própria central, com produção, pulverizações, custos e histórico."
          action={<ButtonLink href="/talhoes/novo">Cadastrar talhão</ButtonLink>}
        />
      ) : (
        <>
          {/* Comparacao entre talhoes (secao 26). Linhas clicaveis, sem caixas. */}
          <Section title="Compare meus talhões">
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
                {/* Larguras fixas por colgroup: preenche a largura toda sem
                    depender do navegador redistribuir espaco pelo conteudo. */}
                <colgroup>
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '19%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '8%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-line-strong text-left">
                    {['Talhão', 'Cultura', 'Área', 'Produção', 'kg/ha', 'Custo', 'Custo/kg', 'Receita', 'Resultado', ''].map(
                      (h, i) => (
                        <th
                          key={i}
                          className={`pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-faint ${
                            i > 1 ? 'text-right' : ''
                          }`}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => {
                    const result = Number(r.result ?? 0)
                    const level = plotLevel(attention.items, r.code ?? '', r.plot_id ?? '')
                    return (
                      <tr key={r.plot_id} className="group transition-colors hover:bg-bg-sunken/60">
                        <td className="py-3">
                          <Link
                            href={`/talhoes/${r.plot_id}` as Route}
                            className="flex items-center gap-2 font-medium"
                          >
                            <StatusDot level={level} />
                            <span className="num">{r.code}</span>
                          </Link>
                        </td>
                        <td className="py-3 text-text-muted">
                          {[r.crop_name, r.variety_name].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="num py-3 text-right">{area(Number(r.area ?? 0))}</td>
                        <td className="num py-3 text-right">{kg(Number(r.production_kg ?? 0))}</td>
                        <td className="num py-3 text-right text-text-muted">
                          {r.kg_per_ha ? num(Number(r.kg_per_ha)) : '—'}
                        </td>
                        <td className="num py-3 text-right">
                          {money(Number(r.total_cost ?? 0), { compact: true })}
                        </td>
                        <td className="num py-3 text-right">
                          {r.cost_per_kg ? money(Number(r.cost_per_kg)) : '—'}
                        </td>
                        <td className="num py-3 text-right">
                          {money(Number(r.revenue ?? 0), { compact: true })}
                        </td>
                        <td
                          className={`num py-3 text-right font-medium ${
                            result > 0 ? 'text-accent-text' : result < 0 ? 'text-danger' : ''
                          }`}
                        >
                          {money(result, { compact: true })}
                        </td>
                        <td className="py-2 text-right">
                          <RowActions
                            id={r.plot_id!}
                            kind="talhao"
                            editHref={`/talhoes/${r.plot_id}?editar=1` as Route}
                            confirm="Excluir o talhão? Só é possível se ele não tiver lançamentos."
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line-strong text-text-muted">
                    <td className="py-3 text-[11px] font-semibold uppercase tracking-[0.1em]">
                      Total
                    </td>
                    <td />
                    <td className="num py-3 text-right">{area(totals.area)}</td>
                    <td className="num py-3 text-right">{kg(totals.production)}</td>
                    <td className="num py-3 text-right">
                      {totals.area > 0 ? num(totals.production / totals.area) : '—'}
                    </td>
                    <td className="num py-3 text-right">{money(totals.cost, { compact: true })}</td>
                    <td className="num py-3 text-right">
                      {totals.production > 0 ? money(totals.cost / totals.production) : '—'}
                    </td>
                    <td className="num py-3 text-right">
                      {money(totals.revenue, { compact: true })}
                    </td>
                    <td className="num py-3 text-right font-medium">
                      {money(totals.revenue - totals.cost, { compact: true })}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
