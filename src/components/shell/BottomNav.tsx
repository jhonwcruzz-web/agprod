'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  BarnIcon,
  DotsThreeIcon,
  HouseIcon,
  PlusIcon,
  SparkleIcon,
  XIcon,
} from '@phosphor-icons/react/dist/ssr'
import { NAV, QUICK_ACTIONS } from './nav'

/**
 * Barra inferior do celular (secao 41): Início · Fazenda · Lançar · IA · Mais.
 * Nada de sidebar no mobile — o polegar alcança tudo.
 */
export function BottomNav() {
  const pathname = usePathname()
  const [sheet, setSheet] = useState<null | 'lancar' | 'mais'>(null)

  const tab = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))
  const close = () => setSheet(null)

  return (
    <>
      {sheet && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Fechar"
            onClick={close}
            className="absolute inset-0 bg-sand-950/40 backdrop-blur-[2px]"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-bg-raised pb-[calc(env(safe-area-inset-bottom)+5rem)] shadow-[0_-8px_32px_-12px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <p className="text-sm font-medium">
                {sheet === 'lancar' ? 'O que você quer registrar?' : 'Mais'}
              </p>
              <button
                onClick={close}
                aria-label="Fechar"
                className="press rounded-md p-1 text-text-muted hover:bg-bg-sunken"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="stagger grid grid-cols-2 gap-px bg-line">
              {(sheet === 'lancar' ? QUICK_ACTIONS : NAV).map((item, i) => {
                const Icon = item.icon
                const label = 'label' in item ? item.label : ''
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={close}
                    style={{ '--i': i } as React.CSSProperties}
                    className="press flex items-center gap-3 bg-bg-raised px-5 py-4 text-sm"
                  >
                    <Icon size={20} className="shrink-0 text-accent" />
                    <span className="truncate">{label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Navegação"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-bg-raised/95 backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pb-[env(safe-area-inset-bottom)]">
          <TabLink href="/" label="Início" icon={HouseIcon} active={tab('/')} />
          <TabLink href="/fazenda" label="Fazenda" icon={BarnIcon} active={tab('/fazenda')} />

          <button
            onClick={() => setSheet(sheet === 'lancar' ? null : 'lancar')}
            className="press flex flex-col items-center gap-1 py-2"
            aria-label="Registrar"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_2px_8px_-2px_var(--accent)]">
              <PlusIcon size={22} weight="bold" />
            </span>
            <span className="text-[10px] font-medium text-text-muted">Lançar</span>
          </button>

          <TabLink
            href="/assistente"
            label="IA"
            icon={SparkleIcon}
            active={tab('/assistente')}
          />

          <button
            onClick={() => setSheet(sheet === 'mais' ? null : 'mais')}
            className="press flex flex-col items-center gap-1 py-2.5 text-text-muted"
          >
            <DotsThreeIcon size={22} />
            <span className="text-[10px] font-medium">Mais</span>
          </button>
        </div>
      </nav>
    </>
  )
}

function TabLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: '/' | '/fazenda' | '/assistente'
  label: string
  icon: typeof HouseIcon
  active: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`press flex flex-col items-center gap-1 py-2.5 ${
        active ? 'text-accent-text' : 'text-text-muted'
      }`}
    >
      <Icon size={22} weight={active ? 'fill' : 'regular'} />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  )
}
