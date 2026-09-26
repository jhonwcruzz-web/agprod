import type { ReactNode } from 'react'

/**
 * Tela de entrada em split 50/50 (o guia de design proibe hero centralizado):
 * formulario a' esquerda, marca e proposta de valor a' direita.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <main className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[380px]">{children}</div>
      </main>

      <aside className="relative hidden overflow-hidden bg-vine-800 lg:block">
        {/* Latada vista de baixo: linhas de condução em perspectiva. */}
        <svg
          aria-hidden
          className="absolute inset-0 size-full opacity-[0.16]"
          preserveAspectRatio="none"
          viewBox="0 0 400 600"
        >
          {Array.from({ length: 11 }).map((_, i) => (
            <line
              key={`v${i}`}
              x1={200 + (i - 5) * 18}
              y1="0"
              x2={200 + (i - 5) * 120}
              y2="600"
              stroke="white"
              strokeWidth="1"
            />
          ))}
          {Array.from({ length: 9 }).map((_, i) => (
            <line
              key={`h${i}`}
              x1="0"
              y1={60 + i * i * 7}
              x2="400"
              y2={60 + i * i * 7}
              stroke="white"
              strokeWidth="0.75"
            />
          ))}
        </svg>

        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-vine-200">
            Academia da Uva PRO
          </p>

          <div className="max-w-[24ch]">
            <p className="text-4xl font-semibold leading-[1.05] tracking-tighter text-white xl:text-5xl">
              Controle sua propriedade.
              <span className="block text-vine-300">Entenda seus números.</span>
            </p>
            <p className="mt-6 max-w-[42ch] text-sm leading-relaxed text-vine-100/80">
              Quanto você produziu, quanto gastou, quanto vendeu e quanto sobrou — por
              talhão, por safra, em um só lugar.
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-6 border-t border-white/15 pt-6">
            {[
              ['Custo por kg', 'calculado sozinho'],
              ['Estoque', 'baixa automática'],
              ['Lançamento', 'por texto'],
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
