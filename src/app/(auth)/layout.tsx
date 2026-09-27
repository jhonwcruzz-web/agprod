import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { ACCENT_COOKIE, THEME_COOKIE, parseAccent, parseTheme } from '@/lib/theme'
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher'
import { APP_TAGLINE } from '@/lib/config'
import { Logo } from '@/components/ui/Logo'
import { FieldScene } from '@/components/ui/FieldScene'

/**
 * Tela de entrada limpa: logo e tema no topo, formulario centralizado.
 * Uma cor so', a do tema (branco no claro, preto no escuro). O unico
 * detalhe e' o parreiral em traco, bem apagado, no pe' da pagina.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const jar = await cookies()
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-bg">
      {/* Largura limitada: esticado na tela toda, o traco fica grosso demais.
          A mascara faz o desenho sumir para cima e para os lados. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
        <FieldScene
          showSky={false}
          className="h-44 w-full max-w-[420px] text-text opacity-[0.12] [mask-image:radial-gradient(ellipse_at_bottom,black_35%,transparent_75%)]"
        />
      </div>

      <header className="relative flex items-center justify-between gap-4 px-6 py-6 sm:px-10">
        <Logo mono />
        <div className="w-56">
          <ThemeSwitcher
            initialTheme={parseTheme(jar.get(THEME_COOKIE)?.value)}
            initialAccent={parseAccent(jar.get(ACCENT_COOKIE)?.value)}
            showAccent={false}
          />
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-6 pb-24 pt-6 sm:pb-32">
        <div className="w-full max-w-[380px]">{children}</div>
      </main>

      <p className="relative pb-6 text-center text-xs text-text-faint">{APP_TAGLINE} · uva, manga e fruticultura</p>
    </div>
  )
}
