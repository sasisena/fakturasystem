import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Nøkkeltallsboks med kategorifarge (designguiden versjon 2): blå for medlemmer, rød for
 * fakturaoppfølging, gull for klasser og varsler, grønn for fullført og lilla for arkiv, historikk
 * og økonomi. Lys tonal flate med farget toppmarkør, så teksten alltid har god kontrast.
 */
export type StatTone = 'blue' | 'red' | 'gold' | 'green' | 'purple';

const TONE: Record<StatTone, { box: string; bar: string; icon: string }> = {
  blue: { box: 'bg-primary-soft', bar: 'bg-primary', icon: 'bg-primary text-on-primary' },
  red: { box: 'bg-danger-soft', bar: 'bg-danger', icon: 'bg-danger text-white' },
  gold: { box: 'bg-warning-soft', bar: 'bg-accent', icon: 'bg-accent text-on-accent' },
  green: { box: 'bg-success-soft', bar: 'bg-success', icon: 'bg-success text-white' },
  purple: { box: 'bg-purple-soft', bar: 'bg-purple', icon: 'bg-purple text-white' },
};

export function StatCard({ tone, icon: Icon, label, value, hint, className }: { tone: StatTone; icon: LucideIcon; label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  const t = TONE[tone];
  return (
    <div className={cn('relative h-full overflow-hidden rounded-lg p-5 text-ink shadow-[var(--shadow-1)]', t.box, className)}>
      <span aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-1.5', t.bar)} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-semibold">{label}</p>
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', t.icon)}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <p className="tabular mt-1 text-[2.25rem] leading-tight font-semibold">{value}</p>
      {hint && <div className="mt-1 text-sm">{hint}</div>}
    </div>
  );
}
