import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

/* ------------------------------------------------------------------ button */

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap ' +
    'transition-[background-color,color,box-shadow,transform] duration-150 ' +
    'disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] select-none',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg hover:bg-accent-hover shadow-sm',
        secondary: 'bg-surface-2 text-fg hover:bg-surface-3 border border-line',
        ghost: 'text-muted hover:text-fg hover:bg-surface-2',
        subtle: 'bg-accent-soft text-accent hover:bg-accent hover:text-accent-fg',
        danger: 'bg-danger text-white hover:brightness-110 shadow-sm',
        outline: 'border border-line text-fg hover:bg-surface-2'
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 text-sm',
        lg: 'h-11 px-6 text-sm',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-xs': 'size-7 rounded-md'
      }
    },
    defaultVariants: { variant: 'secondary', size: 'md' }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

export type IconButtonProps = Omit<ButtonProps, 'size'> & {
  /** Required: icon-only controls need an accessible name. */
  label: string
  size?: 'icon-sm' | 'icon-xs' | 'icon'
  active?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, variant, size = 'icon', label, active, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        buttonVariants({ variant, size }),
        // Active toggles (shuffle, repeat) get a filled pill so their state is
        // readable at a glance without relying on colour alone.
        active && 'bg-accent-soft text-accent',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
})

/* ------------------------------------------------------------------- field */

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className
}: {
  label: string
  hint?: string
  error?: string
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-faint">{hint}</p>
      ) : null}
    </div>
  )
}

const controlBase =
  'w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-faint ' +
  'transition-[border-color,box-shadow] duration-150 ' +
  'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 ' +
  'disabled:opacity-50'

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlBase, 'h-10', className)} {...props} />
  }
)

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(controlBase, 'min-h-20 py-2.5', className)} {...props} />
  }
)

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(controlBase, 'h-10 cursor-pointer pr-8', className)} {...props}>
        {children}
      </select>
    )
  }
)

/* ------------------------------------------------------------------- misc */

export function Badge({
  children,
  className,
  tone = 'neutral'
}: {
  children: React.ReactNode
  className?: string
  tone?: 'neutral' | 'accent' | 'success' | 'danger'
}) {
  const tones = {
    neutral: 'bg-surface-3 text-muted',
    accent: 'bg-accent-soft text-accent',
    success: 'bg-success/15 text-success',
    danger: 'bg-danger/15 text-danger'
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-muted', className)} aria-hidden />
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-2', className)} aria-hidden />
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {Icon && (
        <div className="rounded-2xl bg-surface-2 p-3.5">
          <Icon className="size-6 text-faint" />
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-fg">{title}</h3>
        {description && <p className="max-w-sm text-xs text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h3 className="text-sm font-medium text-fg">Something went wrong</h3>
      <p className="max-w-md text-xs text-muted">{message}</p>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

/** Star rating control used on album and song detail screens. */
export function Rating({
  value,
  onChange,
  className
}: {
  value: number
  onChange?: (rating: number) => void
  className?: string
}) {
  const readOnly = !onChange
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(value === star ? 0 : star)}
          aria-label={readOnly ? `Rated ${value} out of 5` : `Rate ${star} out of 5`}
          className={cn(
            'text-sm transition-colors',
            readOnly ? 'cursor-default' : 'cursor-pointer hover:text-accent',
            star <= value ? 'text-accent' : 'text-faint'
          )}
        >
          ★
        </button>
      ))}
    </div>
  )
}
