'use client'

import { useState } from 'react'
import { DesktopIcon, MoonIcon, SunIcon } from '@phosphor-icons/react/dist/ssr'
import { ACCENT_COOKIE, ACCENTS, THEME_COOKIE, type Accent, type Theme } from '@/lib/theme'

const THEME_OPTIONS = [
  { key: 'light', label: 'Claro', Icon: SunIcon },
  { key: 'dark', label: 'Escuro', Icon: MoonIcon },
  { key: 'system', label: 'Automático', Icon: DesktopIcon },
] as const

function save(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`
}

/**
 * Tema (claro/escuro/automatico) e cor de destaque. Aplica na hora, no
 * <html>, e grava em cookie para o servidor renderizar igual na proxima vez.
 */
export function ThemeSwitcher({
  initialTheme,
  initialAccent,
  showAccent = true,
}: {
  initialTheme: Theme
  initialAccent: Accent
  showAccent?: boolean
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [accent, setAccent] = useState<Accent>(initialAccent)

  function pickTheme(t: Theme) {
    setTheme(t)
    save(THEME_COOKIE, t)
    const root = document.documentElement
    if (t === 'system') delete root.dataset.theme
    else root.dataset.theme = t
  }

  function pickAccent(a: Accent) {
    setAccent(a)
    save(ACCENT_COOKIE, a)
    const root = document.documentElement
    if (a === 'vine') delete root.dataset.accent
    else root.dataset.accent = a
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-1 rounded-md bg-bg-sunken p-1">
        {THEME_OPTIONS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={theme === key}
            onClick={() => pickTheme(key)}
            className={`press flex flex-col items-center gap-1 rounded px-1 py-1.5 text-[11px] transition-colors ${
              theme === key ? 'bg-bg-raised font-medium text-text shadow-sm' : 'text-text-muted hover:text-text'
            }`}
          >
            <Icon size={15} weight={theme === key ? 'fill' : 'regular'} />
            {label}
          </button>
        ))}
      </div>

      {showAccent && (
        <div role="radiogroup" aria-label="Cor de destaque" className="flex items-center justify-between gap-1">
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              type="button"
              role="radio"
              aria-checked={accent === a.key}
              title={a.label}
              onClick={() => pickAccent(a.key)}
              className={`press flex flex-1 flex-col items-center gap-1 rounded py-1 text-[11px] transition-colors ${
                accent === a.key ? 'font-medium text-text' : 'text-text-muted hover:text-text'
              }`}
            >
              <span
                className={`size-5 rounded-full ring-offset-2 ring-offset-bg-raised ${
                  accent === a.key ? 'ring-2 ring-text' : ''
                }`}
                style={{ background: a.swatch }}
              />
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
