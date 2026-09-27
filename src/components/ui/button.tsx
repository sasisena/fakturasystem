import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Knapper etter Material Design 3 (docs/DESIGNGUIDE.md), minst 48 px høye (små: 40 px):
 * primary/contrast = Filled (én hovedhandling per område), tonal, secondary = Outlined,
 * ghost = Text, danger = Destructive.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60 min-h-12 px-6 text-[length:var(--text-control)]',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary shadow-[var(--shadow-1)] hover:brightness-110',
        contrast: 'bg-contrast text-on-contrast shadow-[var(--shadow-1)] hover:brightness-110',
        tonal: 'bg-primary-soft text-primary-strong hover:brightness-95',
        secondary: 'border border-border-strong bg-transparent text-primary-strong hover:bg-surface-2',
        danger: 'bg-danger text-white hover:brightness-110',
        ghost: 'text-primary hover:bg-primary-soft',
      },
      size: { md: '', sm: 'min-h-10 px-4' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} type={asChild ? undefined : (type ?? 'button')} {...props} />;
}

export { buttonVariants };
