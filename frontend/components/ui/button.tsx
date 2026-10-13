import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const variants = cva('inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400', {
  variants: { variant: { default: 'bg-cyan-600 text-white hover:bg-cyan-500', secondary: 'bg-slate-800 text-slate-200 hover:bg-slate-700', ghost: 'text-slate-400 hover:bg-slate-800 hover:text-white' }, size: { default: 'px-3 py-2', icon: 'h-9 w-9' } },
  defaultVariants: { variant: 'secondary', size: 'default' },
})
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants>>(({className, variant, size, ...props}, ref) => <button ref={ref} className={twMerge(clsx(variants({variant, size}), className))} {...props}/>)
Button.displayName = 'Button'
