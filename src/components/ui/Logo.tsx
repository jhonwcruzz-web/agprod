import { APP_NAME } from '@/lib/config'

/**
 * Marca AGPROD: tres linhas de plantio subindo, como um grafico de
 * crescimento — o talhao e o numero no mesmo desenho.
 */
export function LogoMark({ className = 'size-7', mono = false }: { className?: string; mono?: boolean }) {
  // mono: acompanha o tema (preto no claro, branco no escuro), sem o verde.
  const fg = mono ? 'var(--bg)' : 'white'
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-md ${mono ? 'bg-text' : 'bg-vine-700'} ${className}`}>
      <svg viewBox="0 0 24 24" aria-hidden className="size-[62%]" fill="none">
        <path d="M5 19V14" stroke={fg} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M12 19V9" stroke={fg} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M19 19V5" stroke={mono ? fg : '#c0d5c2'} strokeOpacity={mono ? 0.6 : 1} strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </span>
  )
}

export function Logo({
  tone = 'default',
  size = 'md',
  mono = false,
}: {
  tone?: 'default' | 'light'
  size?: 'md' | 'lg'
  mono?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className={size === 'lg' ? 'size-9' : 'size-7'} mono={mono} />
      <span
        className={`font-semibold tracking-[0.06em] ${size === 'lg' ? 'text-lg' : 'text-sm'} ${
          tone === 'light' ? 'text-white' : 'text-text'
        }`}
      >
        {APP_NAME}
      </span>
    </span>
  )
}
