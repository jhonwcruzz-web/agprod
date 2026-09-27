'use client'
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher'
import type { Accent, Theme } from '@/lib/theme'

import Link from 'next/link'
import { useRef, useState, useTransition } from 'react'
import {
  CaretDownIcon,
  PlusIcon,
  SignOutIcon,
  UserIcon,
} from '@phosphor-icons/react/dist/ssr'
import { QUICK_ACTIONS } from './nav'
import { selectFarm, selectSeason } from '@/app/(app)/context-actions'
import { signOut } from '@/app/(auth)/actions'

type Option = { id: string; label: string; sub?: string }

function Dropdown({
  label,
  options,
  activeId,
  onSelect,
  footer,
}: {
  label: string
  options: Option[]
  activeId?: string
  onSelect: (id: string) => void
  footer?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = options.find((o) => o.id === activeId)

  return (
    <div
      ref={ref}
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false)
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label}
        className="press flex max-w-[45vw] items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-text transition-colors hover:bg-bg-sunken sm:max-w-none"
      >
        <span className="truncate font-medium">{active?.label ?? label}</span>
        <CaretDownIcon size={12} weight="bold" className="shrink-0 text-text-faint" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-56 overflow-hidden rounded-lg border border-line bg-bg-raised shadow-[0_8px_28px_-10px_rgba(0,0,0,0.3)]">
          <p className="border-b border-line px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
            {label}
          </p>
          <div className="max-h-64 overflow-y-auto py-1">
            {options.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  onSelect(o.id)
                  setOpen(false)
                }}
                className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-bg-sunken ${
                  o.id === activeId ? 'text-accent-text' : 'text-text'
                }`}
              >
                <span className="truncate">{o.label}</span>
                {o.sub && <span className="text-xs text-text-faint">{o.sub}</span>}
              </button>
            ))}
          </div>
          {footer && <div className="border-t border-line">{footer}</div>}
        </div>
      )}
    </div>
  )
}

/** Menu do botao "+ Registrar" no desktop (secao 42). */
function QuickRegister() {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative hidden lg:block"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false)
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="press inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-on-accent transition-opacity hover:opacity-90"
      >
        <PlusIcon size={16} weight="bold" />
        Registrar
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-lg border border-line bg-bg-raised py-1 shadow-[0_8px_28px_-10px_rgba(0,0,0,0.3)]">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon
            return (
              <Link
                key={a.key}
                href={a.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2 text-sm text-text transition-colors hover:bg-bg-sunken"
              >
                <Icon size={18} className="shrink-0 text-accent" />
                {a.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function UserMenu({ name, theme, accent }: { name: string; theme: Theme; accent: Accent }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false)
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Conta"
        aria-expanded={open}
        className="press flex size-9 items-center justify-center rounded-full border border-line-strong text-xs font-semibold uppercase text-text-muted transition-colors hover:border-accent hover:text-accent-text"
      >
        {name.slice(0, 2)}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border border-line bg-bg-raised py-1 shadow-[0_8px_28px_-10px_rgba(0,0,0,0.3)]">
          <p className="truncate border-b border-line px-3 py-2 text-sm font-medium">{name}</p>
          <div className="border-b border-line px-3 py-3">
            <p className="pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">Aparência</p>
            <ThemeSwitcher initialTheme={theme} initialAccent={accent} />
          </div>
          <Link
            href="/conta"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-text transition-colors hover:bg-bg-sunken"
          >
            <UserIcon size={16} /> Minha conta
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger-soft"
            >
              <SignOutIcon size={16} /> Sair
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export function ContextBar({
  farms,
  farmId,
  seasons,
  seasonId,
  userName,
  theme,
  accent,
}: {
  farms: Option[]
  farmId: string
  seasons: Option[]
  seasonId?: string
  userName: string
  theme: Theme
  accent: Accent
}) {
  const [, start] = useTransition()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-bg/90 px-4 backdrop-blur-md sm:px-6">
      <Dropdown
        label="Propriedade"
        options={farms}
        activeId={farmId}
        onSelect={(id) => start(() => void selectFarm(id))}
        footer={
          <Link
            href="/fazenda/nova"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-accent-text transition-colors hover:bg-bg-sunken"
          >
            <PlusIcon size={14} weight="bold" /> Nova propriedade
          </Link>
        }
      />

      <span aria-hidden className="text-line-strong">
        /
      </span>

      {seasons.length > 0 ? (
        <Dropdown
          label="Safra"
          options={seasons}
          activeId={seasonId}
          onSelect={(id) => start(() => void selectSeason(id))}
          footer={
            <Link
              href="/safras"
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-accent-text transition-colors hover:bg-bg-sunken"
            >
              <PlusIcon size={14} weight="bold" /> Gerenciar safras
            </Link>
          }
        />
      ) : (
        <Link
          href="/safras"
          className="rounded-md px-2 py-1.5 text-sm text-text-muted hover:bg-bg-sunken"
        >
          Criar safra
        </Link>
      )}

      <div className="ml-auto flex items-center gap-2">
        <QuickRegister />
        <UserMenu name={userName} theme={theme} accent={accent} />
      </div>
    </header>
  )
}
