'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { usePathname, useSearchParams } from 'next/navigation'

export type TabItem = { key: string; label: string; count?: number }

/**
 * Navegacao por abas via query string (?aba=).
 *
 * Abas em vez de telas separadas e' o padrao do produto (secoes 7 e 34):
 * reduz a quantidade de paginas e mantem o contexto do talhao/modulo.
 * Como e' um Link, cada aba tem URL propria, funciona com voltar e pode
 * ser compartilhada.
 */
export function Tabs({ items, param = 'aba' }: { items: TabItem[]; param?: string }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const active = params.get(param) ?? items[0]?.key

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <nav
        aria-label="Seções"
        className="flex min-w-max items-center gap-1 border-b border-line"
      >
        {items.map((t) => {
          const next = new URLSearchParams(params.toString())
          next.set(param, t.key)
          const isActive = t.key === active

          return (
            <Link
              key={t.key}
              href={`${pathname}?${next.toString()}` as Route}
              scroll={false}
              aria-current={isActive ? 'page' : undefined}
              className={`relative -mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors duration-150 ${
                isActive
                  ? 'border-accent font-medium text-text'
                  : 'border-transparent text-text-muted hover:text-text'
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="num ml-1.5 text-xs text-text-faint">{t.count}</span>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
