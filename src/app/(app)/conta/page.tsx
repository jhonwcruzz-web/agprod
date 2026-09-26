import type { Metadata } from 'next'
import { getUser } from '@/lib/supabase/server'
import { requireFarm } from '@/lib/farm'
import { signOut } from '@/app/(auth)/actions'
import { date } from '@/lib/format'
import { PageHeader, DataGrid, DataPair, Section } from '@/components/ui/Layout'
import { Button } from '@/components/ui/Button'

export const metadata: Metadata = { title: 'Minha conta' }

const ROLE_LABEL: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Somente leitura',
}

export default async function ContaPage() {
  const [user, ctx] = await Promise.all([getUser(), requireFarm()])

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <PageHeader title="Minha conta" />

      <Section title="Dados">
        <DataGrid>
          <DataPair
            label="Nome"
            value={(user?.user_metadata?.full_name as string) ?? '—'}
          />
          <DataPair label="E-mail" value={user?.email ?? '—'} />
          <DataPair
            label="Telefone"
            value={(user?.user_metadata?.phone as string) ?? '—'}
            mono
          />
          <DataPair label="Conta criada em" value={date(user?.created_at)} mono />
        </DataGrid>
      </Section>

      <Section title="Acesso">
        <DataGrid>
          <DataPair label="Propriedade ativa" value={ctx.farm.name} />
          <DataPair label="Seu papel" value={ROLE_LABEL[ctx.role]} />
          <DataPair label="Propriedades" value={String(ctx.farms.length)} mono />
          <DataPair label="Safra ativa" value={ctx.season?.name ?? '—'} mono />
        </DataGrid>
      </Section>

      <Section title="Sessão">
        <form action={signOut}>
          <Button type="submit" variant="danger">
            Sair da conta
          </Button>
        </form>
      </Section>
    </div>
  )
}
