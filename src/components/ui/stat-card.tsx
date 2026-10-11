import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Nøkkeltallsboks: hvit flate, liten farget etikett med ikon, stort tall og en hjelpelinje.
 * Fargen sier hva slags tall det er (blå = utestående, rød = forfalt, grønn = betalt,
 * gull = venter, lilla = utkast), men etiketten sier det alltid med ord.
 */
export type StatTone = 'blue' | 'red' | 'gold' | 'green' | 'purple';

const TONE: Record<StatTone, string> = {
  blue: 'bg-info-soft text-info',
  red: 'bg-danger-soft text-danger',
  gold: 'bg-warning-soft text-warning',
  green: 'bg-success-soft text-success',
  purple: 'bg-primary-soft text-primary-strong',
};

export function StatCard({ tone, icon: Icon, label, value, hint, className }: { tone: StatTone; icon: LucideIcon; label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn('h-full rounded-lg border border-border bg-surface p-4 text-ink sm:p-5 shadow-[var(--shadow-1)] transition-colors hover:border-border-strong', className)}>
      <p className="flex items-center gap-2 text-xs font-semibold sm:text-sm">
        <span className={cn('grid size-7 shrink-0 place-items-center rounded-md', TONE[tone])}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        {label}
      </p>
      <p className="tabular mt-3 text-xl leading-tight font-semibold sm:text-[1.75rem]">{value}</p>
      {hint && <div className="mt-1 text-sm text-muted">{hint}</div>}
    </div>
  );
}
