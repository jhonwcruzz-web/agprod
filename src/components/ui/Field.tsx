import type { ComponentProps, ReactNode } from 'react'

/* Padrao de formulario (regra 6 do guia de design):
   label acima do campo, texto de ajuda opcional, erro abaixo, gap-2. */

const CONTROL =
  'w-full rounded-md border border-line-strong bg-bg-raised px-3 text-sm text-text ' +
  'placeholder:text-text-faint transition-colors duration-150 ' +
  'hover:border-sand-400 focus:border-accent focus:outline-none ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'aria-[invalid=true]:border-danger'

type WrapProps = {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}

export function Field({ label, htmlFor, hint, error, required, children, className = '' }: WrapProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-text-muted">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-text-faint">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export function Input({ className = '', ...rest }: ComponentProps<'input'>) {
  return <input className={`${CONTROL} h-10 ${className}`} {...rest} />
}

export function Textarea({ className = '', ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={`${CONTROL} min-h-20 py-2 leading-relaxed ${className}`} {...rest} />
}

export function Select({ className = '', children, ...rest }: ComponentProps<'select'>) {
  return (
    <select className={`${CONTROL} h-10 appearance-none pr-8 ${className}`} {...rest}>
      {children}
    </select>
  )
}

/** Campo numerico com unidade grudada na borda direita. */
export function InputWithUnit({
  unit,
  className = '',
  ...rest
}: ComponentProps<'input'> & { unit: string }) {
  return (
    <div className="relative">
      <input className={`${CONTROL} num h-10 pr-14 ${className}`} {...rest} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-faint">
        {unit}
      </span>
    </div>
  )
}
