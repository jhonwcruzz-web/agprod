import Link from 'next/link'
import type { Route } from 'next'
import type { ComponentProps, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-accent text-on-accent border border-transparent hover:opacity-90 disabled:opacity-40',
  secondary:
    'bg-bg-raised text-text border border-line-strong hover:border-accent hover:text-accent-text disabled:opacity-40',
  ghost:
    'bg-transparent text-text-muted border border-transparent hover:bg-bg-sunken hover:text-text disabled:opacity-40',
  danger:
    'bg-transparent text-danger border border-line-strong hover:bg-danger-soft hover:border-danger disabled:opacity-40',
}

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-[15px] gap-2',
}

const BASE =
  'press inline-flex items-center justify-center rounded-md font-medium tracking-tight ' +
  'transition-colors duration-150 disabled:cursor-not-allowed disabled:pointer-events-none whitespace-nowrap'

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]} ${extra}`
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: Variant
  size?: Size
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', className = '', ...rest }: ButtonProps) {
  return <button className={buttonClass(variant, size, className)} {...rest} />
}

type ButtonLinkProps = {
  href: Route
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
}: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  )
}
