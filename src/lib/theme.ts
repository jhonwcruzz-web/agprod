/**
 * Preferencias de aparencia. Ficam num cookie (nao no localStorage) para
 * o servidor ja' renderizar o <html> com o tema certo — sem a tela
 * "piscar" clara antes de ficar escura. O CSP do proxy tambem bloquearia
 * um script inline para ler o localStorage antes da pintura.
 */
export const THEME_COOKIE = 'agprod-theme'
export const ACCENT_COOKIE = 'agprod-accent'

export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

export const ACCENTS = [
  { key: 'vine', label: 'Vinhedo', swatch: '#3a6042' },
  { key: 'grape', label: 'Uva', swatch: '#6c3f57' },
  { key: 'mango', label: 'Manga', swatch: '#c47128' },
  { key: 'sky', label: 'Céu', swatch: '#335f69' },
] as const
export type Accent = (typeof ACCENTS)[number]['key']

export function parseTheme(v: string | undefined): Theme {
  return (THEMES as readonly string[]).includes(v ?? '') ? (v as Theme) : 'system'
}

export function parseAccent(v: string | undefined): Accent {
  return ACCENTS.some((a) => a.key === v) ? (v as Accent) : 'vine'
}
