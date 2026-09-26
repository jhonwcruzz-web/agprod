import type { ReactNode } from 'react'

/* Blocos de pagina. Agrupamento por regua e espaco negativo em vez de
   caixas empilhadas — a interface deve parecer editorial, nao um ERP. */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight text-text sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Section({
  title,
  description,
  actions,
  children,
  className = '',
}: {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`border-t border-line pt-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">
                {title}
              </h2>
            )}
            {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * Faixa horizontal de indicadores (secao 22 do escopo).
 * Separada por linha vertical, sem caixas — os numeros respiram.
 */
export function MetricStrip({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-line sm:grid-cols-3 lg:grid-cols-5">
      {children}
    </div>
  )
}

export function Metric({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'neutral' | 'positive' | 'negative' | 'warn'
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-accent-text'
      : tone === 'negative'
        ? 'text-danger'
        : tone === 'warn'
          ? 'text-warn'
          : 'text-text'

  return (
    <div className="bg-bg-raised px-4 py-4 sm:px-5 sm:py-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-text-faint">{label}</p>
      <p className={`num mt-2 text-xl font-semibold tracking-tight sm:text-2xl ${toneClass}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  )
}

/** Par rotulo/valor para fichas (dados do talhao, da propriedade). */
export function DataPair({
  label,
  value,
  mono = false,
}: {
  label: string
  value: ReactNode
  mono?: boolean
}) {
  return (
    <div className="py-3">
      <dt className="text-[11px] font-medium uppercase tracking-[0.1em] text-text-faint">
        {label}
      </dt>
      <dd className={`mt-1 text-sm text-text ${mono ? 'num' : ''}`}>{value}</dd>
    </div>
  )
}

export function DataGrid({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 divide-y divide-line sm:grid-cols-3 lg:grid-cols-4 [&>*]:border-line">
      {children}
    </dl>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong px-6 py-10">
      <p className="text-sm font-medium text-text">{title}</p>
      {description && <p className="max-w-[55ch] text-sm text-text-muted">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded-md ${className}`} />
}

/** Semaforo usado em talhoes, estoque e alertas. */
export function StatusDot({
  level,
  className = '',
}: {
  level: 'normal' | 'atencao' | 'critico'
  className?: string
}) {
  const color =
    level === 'critico' ? 'bg-danger' : level === 'atencao' ? 'bg-warn' : 'bg-accent'
  return (
    <span
      aria-hidden
      className={`inline-block size-2 shrink-0 rounded-full ${color} ${className}`}
    />
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'warn' | 'danger'
}) {
  const map = {
    neutral: 'bg-bg-sunken text-text-muted',
    accent: 'bg-accent-soft text-accent-text',
    warn: 'bg-warn-soft text-warn',
    danger: 'bg-danger-soft text-danger',
  }
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ${map[tone]}`}
    >
      {children}
    </span>
  )
}
