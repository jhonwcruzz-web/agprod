import type { Metadata } from 'next'
import { requireFarm, canManage } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { updateFarm } from '@/lib/actions/farm'
import { area, date, taxId } from '@/lib/format'
import { PageHeader, DataGrid, DataPair, Section, Badge } from '@/components/ui/Layout'
import { ButtonLink } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { FarmForm } from '@/components/forms/FarmForm'

export const metadata: Metadata = { title: 'Fazenda' }

const TABS = [
  { key: 'dados', label: 'Dados' },
  { key: 'equipe', label: 'Equipe' },
  { key: 'editar', label: 'Editar' },
]

const ROLE_LABEL: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Somente leitura',
}

export default async function FazendaPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>
}) {
  const [ctx, sp] = await Promise.all([requireFarm(), searchParams])
  const supabase = await createClient()
  const tab = sp.aba ?? 'dados'
  const f = ctx.farm

  const { data: team } = await supabase
    .from('farm_users')
    .select('user_id, role, created_at, profiles(full_name, phone)')
    .eq('farm_id', f.id)

  const local = [f.community, f.city && `${f.city}/${f.state ?? ''}`].filter(Boolean).join(' — ')

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={f.name}
        subtitle={local || undefined}
        actions={<ButtonLink href="/fazenda/nova" variant="secondary">Nova propriedade</ButtonLink>}
      />

      <Tabs items={TABS} />

      {tab === 'dados' && (
        <>
          <Section title="Identificação">
            <DataGrid>
              <DataPair label="Nome" value={f.name} />
              <DataPair label="Nome fantasia" value={f.trade_name ?? '—'} />
              <DataPair label="Proprietário" value={f.owner_name ?? '—'} />
              <DataPair label="CPF / CNPJ" value={taxId(f.tax_id)} mono />
              <DataPair label="Atividade" value={f.main_activity ?? '—'} />
              <DataPair label="Cadastrada em" value={date(f.created_at)} mono />
            </DataGrid>
          </Section>

          <Section title="Contato">
            <DataGrid>
              <DataPair label="Telefone" value={f.phone ?? '—'} mono />
              <DataPair label="E-mail" value={f.email ?? '—'} />
            </DataGrid>
          </Section>

          <Section title="Localização e área">
            <DataGrid>
              <DataPair label="Endereço" value={f.address ?? '—'} />
              <DataPair label="Comunidade" value={f.community ?? '—'} />
              <DataPair label="Cidade" value={f.city ?? '—'} />
              <DataPair label="Estado" value={f.state ?? '—'} />
              <DataPair label="CEP" value={f.postal_code ?? '—'} mono />
              <DataPair label="Área total" value={area(Number(f.total_area), f.area_unit)} mono />
              <DataPair
                label="Coordenadas"
                value={
                  f.latitude && f.longitude
                    ? `${Number(f.latitude).toFixed(5)}, ${Number(f.longitude).toFixed(5)}`
                    : '—'
                }
                mono
              />
            </DataGrid>
          </Section>
        </>
      )}

      {tab === 'equipe' && (
        <Section
          title="Quem tem acesso"
          description="Cada pessoa só enxerga os dados das propriedades em que foi incluída."
        >
          <ul className="divide-y divide-line">
            {(team ?? []).map((m) => {
              const p = m.profiles as { full_name: string | null; phone: string | null } | null
              return (
                <li key={m.user_id} className="flex items-center gap-4 py-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {p?.full_name ?? 'Usuário'}
                      {m.user_id === ctx.userId && (
                        <span className="ml-2 text-xs text-text-faint">você</span>
                      )}
                    </span>
                    {p?.phone && (
                      <span className="num block text-xs text-text-faint">{p.phone}</span>
                    )}
                  </span>
                  <Badge tone={m.role === 'owner' ? 'accent' : 'neutral'}>
                    {ROLE_LABEL[m.role]}
                  </Badge>
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      {tab === 'editar' &&
        (canManage(ctx.role) ? (
          <FarmForm action={updateFarm} farm={f} submitLabel="Salvar alterações" />
        ) : (
          <Section>
            <p className="text-sm text-text-muted">
              Somente o proprietário ou um administrador pode editar os dados da propriedade.
            </p>
          </Section>
        ))}
    </div>
  )
}
