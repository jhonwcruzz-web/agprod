import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { ACCENT_COOKIE, THEME_COOKIE, parseAccent, parseTheme } from '@/lib/theme'
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher'
import { APP_TAGLINE } from '@/lib/config'
import { Logo } from '@/components/ui/Logo'

/**
 * Tela de entrada em split (o guia de design proibe hero centralizado):
 * formulario a' esquerda, a' direita uma amostra do que o produtor ve
 * depois de entrar — o numero que importa, nao uma ilustracao generica.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const jar = await cookies()
  return (
    <div className="grid min-h-[100dvh] bg-bg lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <main className="flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <div className="w-56">
            <ThemeSwitcher
              initialTheme={parseTheme(jar.get(THEME_COOKIE)?.value)}
              initialAccent={parseAccent(jar.get(ACCENT_COOKIE)?.value)}
              showAccent={false}
            />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px]">{children}</div>
        </div>
        <p className="text-xs text-text-faint">{APP_TAGLINE} · uva, manga e fruticultura</p>
      </main>

      <aside className="relative hidden overflow-hidden bg-vine-900 lg:block">
        {/* Linhas de plantio em perspectiva, bem discretas ao fundo. */}
        <svg
          aria-hidden
          className="absolute inset-0 size-full opacity-[0.1]"
          preserveAspectRatio="none"
          viewBox="0 0 400 600"
        >
          {Array.from({ length: 13 }).map((_, i) => (
            <line
              key={i}
              x1={200 + (i - 6) * 14}
              y1="0"
              x2={200 + (i - 6) * 110}
              y2="600"
              stroke="white"
              strokeWidth="1"
            />
          ))}
        </svg>

        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <Logo tone="light" />

          <div>
            <p className="max-w-[18ch] text-4xl font-semibold leading-[1.05] tracking-tighter text-white xl:text-5xl">
              Quanto custou cada quilo?
            </p>
            <p className="mt-5 max-w-[44ch] text-sm leading-relaxed text-vine-100/80">
              Pulverização, adubação, máquina e mão de obra entram no custo sozinhos, com baixa
              no estoque. Você vê o resultado por talhão e por safra.
            </p>

            {/* Amostra do painel (valores de exemplo). */}
            <div className="mt-10 max-w-[440px] rounded-xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] uppercase tracking-[0.14em] text-vine-300">Talhão T-03 · safra</span>
                <span className="text-[10px] text-white/40">exemplo</span>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-4">
                {[
                  ['Produção', '38,4 t'],
                  ['Custo/kg', 'R$ 1,92'],
                  ['Resultado', '+R$ 61 mil'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] text-white/55">{k}</dt>
                    <dd className="num mt-1 text-lg font-semibold tracking-tight text-white">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 space-y-2">
                {[
                  ['Pulverização', 64],
                  ['Adubação', 41],
                  ['Mão de obra', 78],
                  ['Máquinas', 27],
                ].map(([k, w]) => (
                  <div key={k} className="flex items-center gap-3 text-xs">
                    <span className="w-24 shrink-0 text-white/60">{k}</span>
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-vine-300" style={{ width: `${w}%` }} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-6 border-t border-white/15 pt-6">
            {[
              ['Custo por kg', 'calculado sozinho'],
              ['Estoque', 'baixa automática'],
              ['Relatórios', 'exporta para Excel'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] uppercase tracking-[0.1em] text-vine-300">{k}</dt>
                <dd className="mt-1 text-sm text-white/85">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
    </div>
  )
}
