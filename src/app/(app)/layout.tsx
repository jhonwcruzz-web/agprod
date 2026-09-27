import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { ACCENT_COOKIE, THEME_COOKIE, parseAccent, parseTheme } from '@/lib/theme'
import { getFarmContext } from '@/lib/farm'
import { getUser } from '@/lib/supabase/server'
import { ContextBar } from '@/components/shell/ContextBar'
import { Sidebar } from '@/components/shell/Sidebar'
import { BottomNav } from '@/components/shell/BottomNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/entrar')

  const ctx = await getFarmContext()
  // Sem propriedade cadastrada, o unico caminho e' o onboarding.
  if (!ctx) redirect('/primeiros-passos')

  const jar = await cookies()
  const userName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email?.split('@')[0] ?? 'Você'

  return (
    <div className="lg:grid lg:min-h-[100dvh] lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-[100dvh] flex-col border-r border-line bg-bg-raised lg:flex">
        <Link
          href="/"
          className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4"
        >
          <Logo />
        </Link>
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-col">
        <ContextBar
          farms={ctx.farms.map((f) => ({
            id: f.id,
            label: f.name,
            sub: [f.city, f.state].filter(Boolean).join('/') || undefined,
          }))}
          farmId={ctx.farm.id}
          seasons={ctx.seasons.map((s) => ({ id: s.id, label: s.name }))}
          seasonId={ctx.season?.id}
          userName={userName}
          theme={parseTheme(jar.get(THEME_COOKIE)?.value)}
          accent={parseAccent(jar.get(ACCENT_COOKIE)?.value)}
        />

        {/* pb generoso no mobile para a barra inferior nao cobrir conteudo.
            max-w largo (1800px): as tabelas de comparacao sao o conteudo
            mais importante do produto e nao podem sobrar espaco vazio do
            lado em monitores grandes. Paragrafos e formularios continuam
            legiveis porque tem seu proprio max-w menor (Nch, max-w-4xl). */}
        <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
          <div className="mx-auto w-full max-w-[1800px]">{children}</div>
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
