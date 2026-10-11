import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';

/** Fast «tilfeldighet», så tegningen blir lik hver gang (og lik på server og i nettleser). */
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/** Lynghei i morgendis: lys himmel, åser i lag og lyngtuer i forgrunnen. */
function HeatherScene() {
  const rnd = seeded(7);
  const tufts = Array.from({ length: 170 }, () => {
    const x = rnd() * 620 - 10;
    const y = 560 + rnd() * 150;
    const depth = (y - 560) / 150;
    return { x, y, r: 3 + depth * 6 + rnd() * 2, c: ['#8E4489', '#A65AA0', '#C27ABB', '#7A3A75', '#6F8F69'][Math.floor(rnd() * 5)] };
  }).sort((a, b) => a.y - b.y);
  return (
    <svg viewBox="0 0 600 700" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 size-full" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FCF8FA" />
          <stop offset="1" stopColor="#EEDDEA" />
        </linearGradient>
        <linearGradient id="near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#A9619F" />
          <stop offset="1" stopColor="#6B3466" />
        </linearGradient>
      </defs>
      <rect width="600" height="700" fill="url(#sky)" />
      <path d="M0 420C90 380 170 400 250 385S420 340 600 375V700H0z" fill="#E3CFDF" />
      <path d="M0 470C120 430 210 455 320 440S500 410 600 430V700H0z" fill="#CFA9CA" />
      <path d="M0 520C110 495 230 515 340 505S520 480 600 495V700H0z" fill="#B67DAE" />
      <path d="M0 575C140 548 260 565 380 556S540 540 600 548V700H0z" fill="url(#near)" />
      {tufts.map((t, i) => (
        <ellipse key={i} cx={t.x} cy={t.y} rx={t.r} ry={t.r * 0.8} fill={t.c} opacity="0.9" />
      ))}
    </svg>
  );
}

/** Ramme for innlogging og registrering: bilde med slagord til venstre, skjema til høyre. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4 md:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-1)] md:grid-cols-[1.1fr_1fr]">
        <div className="relative h-36 md:h-auto md:min-h-[600px]">
          <HeatherScene />
          <div className="relative hidden p-10 text-[#1E1B22] md:block">
            <Logo size="lg" className="text-[#1E1B22] [&_.text-muted]:text-[#615B66]" />
            <p className="mt-14 text-[2rem] leading-tight">Fakturering<br />med litt mer ro.</p>
            <p className="mt-4 text-lg text-[#4B4450]">Enklere fakturering.<br />Mer ro i hverdagen.</p>
          </div>
        </div>
        <main id="innhold" className="flex flex-col justify-center p-6 sm:p-10">
          <Logo className="mb-8 md:hidden" />
          {children}
        </main>
      </div>
    </div>
  );
}
