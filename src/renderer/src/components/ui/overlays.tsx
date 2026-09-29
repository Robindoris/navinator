import { forwardRef } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu'
import * as SliderPrimitive from '@radix-ui/react-slider'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

/* ----------------------------------------------------------------- tooltip */

export const TooltipProvider = TooltipPrimitive.Provider

export function Tooltip({
  label,
  side = 'bottom',
  children
}: {
  label: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: React.ReactNode
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 rounded-md border border-line bg-surface-3 px-2 py-1 text-[11px] font-medium text-fg shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

/* ------------------------------------------------------------------ dialog */

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogContent({
  title,
  description,
  children,
  className,
  footer
}: {
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
  footer?: React.ReactNode
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
          'rounded-app border border-line bg-surface p-5 shadow-[var(--nav-shadow-lg)]',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className
        )}
      >
        <div className="mb-4 space-y-1 pr-8">
          <DialogPrimitive.Title className="text-base font-semibold text-fg">{title}</DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="text-xs leading-relaxed text-muted">
              {description}
            </DialogPrimitive.Description>
          )}
        </div>
        {children}
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
        <DialogPrimitive.Close
          className="absolute right-3.5 top-3.5 rounded-md p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-fg"
          aria-label="Close"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

/* ------------------------------------------------------------ dropdown menu */

export const DropdownMenu = DropdownPrimitive.Root
export const DropdownMenuTrigger = DropdownPrimitive.Trigger

export function DropdownMenuContent({
  children,
  align = 'end',
  className
}: {
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
}) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={6}
        collisionPadding={8}
        className={cn(
          'z-50 min-w-48 overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-[var(--nav-shadow-lg)]',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className
        )}
      >
        {children}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  )
}

export function DropdownMenuItem({
  children,
  onSelect,
  danger,
  disabled,
  className,
  icon: Icon
}: {
  children: React.ReactNode
  onSelect?: () => void
  danger?: boolean
  disabled?: boolean
  className?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <DropdownPrimitive.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm outline-none select-none',
        'data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
        danger ? 'text-danger data-[highlighted]:bg-danger/10' : 'text-fg',
        className
      )}
    >
      {Icon && <Icon className="size-4 shrink-0 opacity-70" />}
      {children}
    </DropdownPrimitive.Item>
  )
}

export function DropdownMenuSeparator() {
  return <DropdownPrimitive.Separator className="my-1 h-px bg-line" />
}

export function DropdownMenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <DropdownPrimitive.Label className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
      {children}
    </DropdownPrimitive.Label>
  )
}

/* ------------------------------------------------------------------ slider */

export const Slider = forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(function Slider({ className, ...props }, ref) {
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn('relative flex w-full touch-none select-none items-center py-2', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-surface-3">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          'block size-3 rounded-full border-2 border-accent bg-fg shadow-sm outline-none',
          'transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-accent/40'
        )}
      />
    </SliderPrimitive.Root>
  )
})

/* ------------------------------------------------------------------ switch */

export const Switch = forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent',
        'transition-colors duration-150 data-[state=checked]:bg-accent data-[state=unchecked]:bg-surface-3',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5" />
    </SwitchPrimitive.Root>
  )
})

/* ------------------------------------------------------------- scroll area */

export const ScrollArea = forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(function ScrollArea({ className, children, ...props }, ref) {
  return (
    <ScrollAreaPrimitive.Root ref={ref} className={cn('overflow-hidden', className)} {...props}>
      <ScrollAreaPrimitive.Viewport className="size-full [&>div]:!block">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        orientation="vertical"
        className="flex w-2.5 touch-none select-none p-0.5 transition-opacity"
      >
        <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-surface-3 hover:bg-faint" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
})

/* --------------------------------------------------------- segmented tabs */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  className?: string
}) {
  return (
    <div className={cn('inline-flex gap-0.5 rounded-lg bg-surface-2 p-0.5', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            value === option.value
              ? 'bg-surface text-fg shadow-sm'
              : 'text-muted hover:text-fg'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
