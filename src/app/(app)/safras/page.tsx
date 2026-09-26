import type { Metadata } from 'next'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { createSeason } from '@/lib/actions/farm'
import { date, kg, money } from '@/lib/format'
import { PageHeader, EmptyState, Badge, Section } from '@/components/ui/Layout'
import { ButtonLink } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { FormGrid, FormPanel } from '@/components/forms/FormPanel'

export const metadata: Metadata = { title: 'Safras' }

/** Formulario de safra: pequeno o bastante para viver nesta pagina. */
function SeasonForm() {
  const year = new Date().getFullYear()
  return (
    <FormPanel
      action={createSeason}
      title="Nova safra"
      description="A safra separa produção, custos e receitas de cada ciclo."
      closeHref="/safras"
      submitLabel="Criar safra"
    >
      <FormGrid>
        <Field label="Nome" htmlFor="name" hint="Ex.: 2026.1" required>
          <Input id="name" name="name" required placeholder={`${year}.1`} className="num" />
        </Field>
        <Field label="Início" htmlFor="start_date">
          <Input id="start_date" name="start_date" type="date" className="num" />
        </Field>
        <Field label="Fim" htmlFor="end_date">
          <Input id="end_date" name="end_date" type="date" className="num" />
        </Field>
      </FormGrid>
    </FormPanel>
  )
}

export default async function SafrasPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string }>
}) {
  const [ctx, sp] = await Promise.all([requireFarm(), searchParams])
  const supabase = await createClient()

  const { data: overview } = await supabase
    .from('v_farm_overview')
    .select('*')
    .eq('farm_id', ctx.farm.id)

  const byId = new Map((overview ?? []).map((o) => [o.season_id, o]))

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Safras"
        subtitle="Compare ciclos e veja a evolução da propriedade"
        actions={<ButtonLink href="/safras?novo=1">Nova safra</ButtonLink>}
      />

      {sp.novo === '1' && <SeasonForm />}

      {ctx.seasons.length === 0 ? (
        <EmptyState
          title="Nenhuma safra cadastrada"
          description="Sem safra, os lançamentos ficam soltos e não dá para comparar um ciclo com o outro."
          action={<ButtonLink href="/safras?novo=1">Criar safra</ButtonLink>}
        />
      ) : (
        <Section title="Comparação entre safras">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
              <colgroup>
                <col style={{ width: '12%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-line-strong text-left">
                  {['Safra', 'Período', 'Produção', 'Receita', 'Custo', 'Custo/kg', 'Resultado'].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={`pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-faint ${i > 1 ? 'text-right' : ''}`}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ctx.seasons.map((s) => {
                  const o = byId.get(s.id)
                  const result = Number(o?.result ?? 0)
                  return (
                    <tr key={s.id} className="transition-colors hover:bg-bg-sunken/60">
                      <td className="py-3">
                        <span className="num font-medium">{s.name}</span>
                        {s.id === ctx.season?.id && (
                          <span className="ml-2">
                            <Badge tone="accent">ativa</Badge>
                          </span>
                        )}
                      </td>
                      <td className="num py-3 text-text-muted">
                        {s.start_date || s.end_date
                          ? `${date(s.start_date)} — ${date(s.end_date)}`
                          : '—'}
                      </td>
                      <td className="num py-3 text-right">
                        {kg(Number(o?.production_kg ?? 0), { asTon: true })}
                      </td>
                      <td className="num py-3 text-right">
                        {money(Number(o?.revenue ?? 0), { compact: true })}
                      </td>
                      <td className="num py-3 text-right">
                        {money(Number(o?.production_cost ?? 0), { compact: true })}
                      </td>
                      <td className="num py-3 text-right">
                        {o?.cost_per_kg ? money(Number(o.cost_per_kg)) : '—'}
                      </td>
                      <td
                        className={`num py-3 text-right font-medium ${
                          result > 0 ? 'text-accent-text' : result < 0 ? 'text-danger' : ''
                        }`}
                      >
                        {money(result, { compact: true })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  )
}
