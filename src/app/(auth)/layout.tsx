import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { ACCENT_COOKIE, THEME_COOKIE, parseAccent, parseTheme } from '@/lib/theme'
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher'
import { APP_TAGLINE } from '@/lib/config'
import { Logo } from '@/components/ui/Logo'
import { FieldScene } from '@/components/ui/FieldScene'

/**
 * Tela de entrada em split (o guia de design proibe hero centralizado):
 * formulario a' esquerda, a' direita uma amostra do que o produtor ve
 * depois de entrar — o numero que importa, nao uma ilustracao generica.
 *
 * Uma cor so', a do tema: branco no claro, preto no escuro. Os dois
 * lados usam o mesmo fundo, separados por uma linha fina.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const jar = await cookies()
  return (
    <div className="grid min-h-[100dvh] bg-bg lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <main className="flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between gap-4">
          <Logo mono />
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

      <aside className="relative hidden overflow-hidden border-l border-line bg-bg text-text lg:block">
        {/* O campo ao fundo: horizonte, sol e o parreiral em latada. */}
        <FieldScene className="pointer-events-none absolute inset-0 size-full text-text opacity-[0.14]" />

        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <Logo mono />

          <div>
            <p className="max-w-[18ch] text-4xl font-semibold leading-[1.05] tracking-tighter text-text xl:text-5xl">
              Quanto custou cada quilo?
            </p>
            <p className="mt-5 max-w-[44ch] text-sm leading-relaxed text-text-muted">
              Pulverização, adubação, máquina e mão de obra entram no custo sozinhos, com baixa
              no estoque. Você vê o resultado por talhão e por safra.
            </p>

            {/* Amostra do painel (valores de exemplo). */}
            <div className="mt-10 max-w-[440px] rounded-xl border border-line bg-bg-raised/80 p-5 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Talhão T-03 · safra</span>
                <span className="text-[10px] text-text-faint">exemplo</span>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-4">
                {[
                  ['Produção', '38,4 t'],
                  ['Custo/kg', 'R$ 1,92'],
                  ['Resultado', '+R$ 61 mil'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] text-text-faint">{k}</dt>
                    <dd className="num mt-1 text-lg font-semibold tracking-tight text-text">{v}</dd>
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
                    <span className="w-24 shrink-0 text-text-muted">{k}</span>
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                      <span className="block h-full rounded-full bg-text/70" style={{ width: `${w}%` }} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-6 border-t border-line pt-6">
            {[
              ['Custo por kg', 'calculado sozinho'],
              ['Estoque', 'baixa automática'],
              ['Relatórios', 'exporta para Excel'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] uppercase tracking-[0.1em] text-text-faint">{k}</dt>
                <dd className="mt-1 text-sm text-text">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
    </div>
  )
}
