import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { cookies } from 'next/headers'
import { ACCENT_COOKIE, THEME_COOKIE, parseAccent, parseTheme } from '@/lib/theme'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'AGPROD',
    template: '%s · AGPROD',
  },
  description:
    'Controle sua propriedade. Entenda seus números. Produza melhor. Gestão simples para o pequeno produtor de uva e manga.',
  applicationName: 'AGPROD',
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // O produtor usa no campo, sob sol forte: a cor da barra segue o tema.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f6' },
    { media: '(prefers-color-scheme: dark)', color: '#151310' },
  ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies()
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value)
  const accent = parseAccent(jar.get(ACCENT_COOKIE)?.value)
  return (
    <html
      lang="pt-BR"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      data-theme={theme === 'system' ? undefined : theme}
      data-accent={accent === 'vine' ? undefined : accent}
    >
      <body className="min-h-[100dvh] antialiased">{children}</body>
    </html>
  )
}
