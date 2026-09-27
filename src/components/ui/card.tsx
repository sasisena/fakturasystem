import { AlertCircle, CheckCircle2, Clock, Info, type LucideIcon } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-border/70 bg-surface p-5 shadow-[var(--shadow-1)] md:p-6', className)} {...props} />;
}

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const CHIP: Record<Tone, { cls: string; icon: LucideIcon | null }> = {
  info: { cls: 'bg-info-soft text-primary-strong', icon: Info },
  success: { cls: 'bg-success-soft text-success', icon: CheckCircle2 },
  warning: { cls: 'bg-warning-soft text-warning', icon: Clock },
  danger: { cls: 'bg-danger-soft text-danger', icon: AlertCircle },
  neutral: { cls: 'bg-surface-3 text-ink', icon: null },
};

/**
 * Statuschip (tonal flate, tekst og ikon). Status vises aldri bare med farge:
 * grønn = fullført, gull = oppmerksomhet, rød = problem, blå/grå = nøytral.
 */
export function Badge({ tone = 'info', className, children, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  const t = CHIP[tone];
  const Icon = t.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap', t.cls, className)} {...props}>
      {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}

export const StatusChip = Badge;

export function Alert({ tone = 'info', className, ...props }: HTMLAttributes<HTMLDivElement> & { tone?: 'info' | 'success' | 'warning' | 'danger' }) {
  const tones = {
    info: 'border-info bg-info-soft',
    success: 'border-success bg-success-soft',
    warning: 'border-warning bg-warning-soft',
    danger: 'border-danger bg-danger-soft',
  };
  return <div className={cn('rounded-md border-l-4 p-4 text-base text-ink', tones[tone], className)} {...props} />;
}

