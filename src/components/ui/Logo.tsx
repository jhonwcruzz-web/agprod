import { APP_NAME } from '@/lib/config'

/**
 * Marca AGPROD: tres linhas de plantio subindo, como um grafico de
 * crescimento — o talhao e o numero no mesmo desenho.
 */
export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-md bg-vine-700 ${className}`}>
      <svg viewBox="0 0 24 24" aria-hidden className="size-[62%]" fill="none">
        <path d="M5 19V14" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M12 19V9" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M19 19V5" stroke="#c0d5c2" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </span>
  )
}

export function Logo({ tone = 'default', size = 'md' }: { tone?: 'default' | 'light'; size?: 'md' | 'lg' }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className={size === 'lg' ? 'size-9' : 'size-7'} />
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
