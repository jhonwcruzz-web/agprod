'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AI_ITEM, GROUP_LABEL, NAV, type NavItem } from './nav'

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

function Item({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`press group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150 ${
        active
          ? 'bg-accent-soft font-medium text-accent-text'
          : 'text-text-muted hover:bg-bg-sunken hover:text-text'
      }`}
    >
      <Icon size={18} weight={active ? 'fill' : 'regular'} className="shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

/** Sidebar compacta: icone + nome, agrupada por finalidade (secao 34). */
export function Sidebar() {
  const pathname = usePathname()
  const groups = ['painel', 'campo', 'dinheiro'] as const
  const AiIcon = AI_ITEM.icon

  return (
    <nav
      aria-label="Navegação principal"
      className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-4"
    >
      {groups.map((g) => (
        <div key={g}>
          <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint">
            {GROUP_LABEL[g]}
          </p>
          <div className="flex flex-col gap-0.5">
            {NAV.filter((n) => n.group === g).map((item) => (
              <Item key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}
          </div>
        </div>
      ))}

      <div className="mt-auto border-t border-line pt-4">
        <Link
          href={AI_ITEM.href}
          className={`press flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150 ${
            isActive(pathname, AI_ITEM.href)
              ? 'bg-accent-soft font-medium text-accent-text'
              : 'text-text-muted hover:bg-bg-sunken hover:text-text'
          }`}
        >
          <AiIcon size={18} weight="fill" className="shrink-0 text-accent" />
          <span className="truncate">Perguntar à IA</span>
        </Link>
      </div>
    </nav>
  )
}
