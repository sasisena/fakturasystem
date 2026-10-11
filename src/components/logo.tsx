import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/cn';

/** Lyngkvist: en buet stilk med blader nederst og klokkeblomster som blir mindre mot toppen. */
export function LyngMark({ className = 'size-9' }: { className?: string }) {
  // Klokkene går fra mørk lyng nederst til lys lyng i toppen (faste farger, ingen gradient-id
  // som kan kollidere når logoen står flere steder på siden).
  const bells: [number, number, number, string][] = [
    [26.5, 24, 4.2, '#7E3478'], [33.5, 22, 3.9, '#8A3D84'], [25.5, 17.5, 3.8, '#96478F'], [32, 15.5, 3.5, '#A4569D'],
    [25.5, 11.5, 3.2, '#B266AB'], [30.5, 9.5, 2.9, '#BF78B8'], [26.5, 5.5, 2.5, '#CB8AC4'], [30, 3, 2, '#D79BD0'],
  ];
  return (
    <svg viewBox="0 0 48 48" className={cn('shrink-0', className)} aria-hidden="true">
      <path d="M17 46C20 36 25 28 28.5 4" fill="none" stroke="#5E7F5A" strokeWidth="2" strokeLinecap="round" />
      <path d="M19.5 38c-5.5-1-9-4.8-10-9.8 5 .7 8.8 4 10 9.8z" fill="#6F8F69" />
      <path d="M20.8 34c5-2.2 8.8-1.6 12.2 1.6-4.4 2-8.6 1.6-12.2-1.6z" fill="#5E7F5A" />
      <path d="M18.3 42c-4 .7-7.4-.6-9.5-3.7 3.8-.5 7.1.9 9.5 3.7z" fill="#86A57F" />
      {bells.map(([x, y, r, c]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={r} ry={r * 1.1} fill={c} />
      ))}
    </svg>
  );
}

/** Logo: lyngkvist, «Lyng» og «FAKTURA» under. */
export function Logo({ className = '', size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <span className={cn('inline-flex items-center gap-2 text-ink', className)}>
      <LyngMark className={lg ? 'size-14' : 'size-9'} />
      <span className="flex flex-col leading-none">
        <span className={cn('font-medium tracking-tight', lg ? 'text-4xl' : 'text-[1.4rem]')}>{BRAND.name}</span>
        <span className={cn('font-medium tracking-[0.35em] text-muted', lg ? 'mt-1 text-xs' : 'mt-0.5 text-[0.55rem]')}>FAKTURA</span>
      </span>
    </span>
  );
}
