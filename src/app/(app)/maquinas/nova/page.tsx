import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/ssr'
import { requireFarm } from '@/lib/farm'
import { createClient } from '@/lib/supabase/server'
import { createMachine } from '@/lib/actions/machines'
import { MachineForm } from '@/components/forms/MachineForms'

export const metadata: Metadata = { title: 'Nova máquina' }

export default async function NovaMaquinaPage({
  searchParams,
}: {
  searchParams: Promise<{ classe?: string }>
}) {
  const [ctx, { classe }] = await Promise.all([requireFarm(), searchParams])
  const supabase = await createClient()

  const { data: tractors } = await supabase
    .from('machines')
    .select('id, name')
    .eq('farm_id', ctx.farm.id)
    .eq('class', 'maquina')
    .neq('status', 'inativo')
    .order('name')

  const isImplement = classe === 'implemento'

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Link
        href="/maquinas"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeftIcon size={15} /> Máquinas e implementos
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
        {isImplement ? 'Novo implemento' : 'Nova máquina'}
      </h1>
      <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-text-muted">
        Só o nome é obrigatório. Com o cadastro feito, cada manutenção e abastecimento entra
        sozinho nos custos da propriedade.
      </p>

      <div className="mt-10">
        <MachineForm
          action={createMachine}
          tractors={tractors ?? []}
          defaultClass={isImplement ? 'implemento' : 'maquina'}
          submitLabel={isImplement ? 'Cadastrar implemento' : 'Cadastrar máquina'}
        />
      </div>
    </div>
  )
}
