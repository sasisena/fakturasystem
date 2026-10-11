'use client';

import { Building2, Contact, FileText, History, LayoutDashboard, LogOut, Menu, Package, Plus, Repeat, Users, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';

type Item = { href: string; label: string; icon: LucideIcon };
type Props = { orgName: string; roleLabel: string; email: string; userName: string | null; canSeeLog: boolean; canInvoice: boolean; manyOrgs: boolean; children: ReactNode };

function initials(name: string | null, email: string) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length) return (words[0][0] + (words.length > 1 ? words.at(-1)![0] : '')).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

/**
 * Rammen rundt appen: lys venstremeny og topplinje på stor skjerm, bunnmeny på mobil
 * (fakturaer lages ofte fra telefonen).
 */
export function AppShell({ orgName, roleLabel, email, userName, canSeeLog, canInvoice, manyOrgs, children }: Props) {
  const path = usePathname();
  const router = useRouter();
  const main: Item[] = [
    { href: '/app', label: 'Oversikt', icon: LayoutDashboard },
    { href: '/app/fakturaer', label: 'Fakturaer', icon: FileText },
    { href: '/app/kunder', label: 'Kunder', icon: Contact },
    { href: '/app/produkter', label: 'Produkter', icon: Package },
  ];
  const settings: Item[] = [
    { href: '/app/firma', label: 'Firma', icon: Building2 },
    { href: '/app/brukere', label: 'Brukere', icon: Users },
    ...(canSeeLog ? [{ href: '/app/logg', label: 'Logg', icon: History }] : []),
  ];
  // Bunnmenyen på mobil: de viktigste, pluss «Mer» for resten.
  const mobile: Item[] = [main[0], main[1], { href: '/app/fakturaer/ny', label: 'Ny faktura', icon: Plus }, main[2], { href: '/app/mer', label: 'Mer', icon: Menu }];
  const active = (href: string) =>
    href === '/app' ? path === '/app'
    : href === '/app/fakturaer' ? path.startsWith(href) && !path.startsWith('/app/fakturaer/ny')
    : href === '/app/mer' ? ['/app/mer', '/app/produkter', '/app/firma', '/app/brukere', '/app/logg'].some((p) => path.startsWith(p))
    : path.startsWith(href);

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  const link = (i: Item) => (
    <li key={i.href}>
      <a
        href={i.href}
        aria-current={active(i.href) ? 'page' : undefined}
        className={cn('flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-ink no-underline hover:bg-surface-2', active(i.href) && 'bg-primary-soft font-semibold text-primary-strong hover:bg-primary-soft')}
      >
        <i.icon className={cn('size-[1.15rem]', active(i.href) ? 'text-primary' : 'text-muted')} aria-hidden="true" /> {i.label}
      </a>
    </li>
  );

  const avatar = (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary-strong" aria-hidden="true">
      {initials(userName, email)}
    </span>
  );

  return (
    <div className="md:flex">
      <nav aria-label="Hovedmeny" className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 md:flex">
        <a href="/app" className="mb-7 px-2 no-underline"><Logo /></a>
        <ul className="flex flex-col gap-0.5">{main.map(link)}</ul>
        {canInvoice && (
          <Link href="/app/fakturaer/ny" className="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-button)] bg-primary text-sm font-semibold text-on-primary no-underline hover:brightness-110">
            <Plus className="size-5" aria-hidden="true" /> Ny faktura
          </Link>
        )}
        <div className="mt-auto">
          <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-muted uppercase">Innstillinger</p>
          <ul className="flex flex-col gap-0.5">{settings.map(link)}</ul>
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 py-2.5 backdrop-blur md:justify-end md:px-8">
          <a href="/app" className="no-underline md:hidden"><Logo /></a>
          <div className="flex items-center gap-3">
            {avatar}
            <div className="hidden min-w-0 leading-tight sm:block">
              <p className="max-w-56 truncate text-sm font-semibold">{userName ?? email}</p>
              <p className="max-w-56 truncate text-xs text-muted">{orgName} · {roleLabel}</p>
            </div>
            {manyOrgs && (
              <a href="/velg-bedrift" aria-label="Bytt bedrift" title="Bytt bedrift" className="grid size-10 place-items-center rounded-md text-muted hover:bg-surface-2">
                <Repeat className="size-5" aria-hidden="true" />
              </a>
            )}
            <button type="button" onClick={logout} aria-label="Logg ut" title="Logg ut" className="grid size-10 place-items-center rounded-md text-muted hover:bg-surface-2">
              <LogOut className="size-5" aria-hidden="true" />
            </button>
          </div>
        </header>
        <main id="innhold" className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 md:px-8 md:pb-12">{children}</main>
      </div>

      <nav aria-label="Hovedmeny" className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {mobile.map((i) =>
          i.href === '/app/fakturaer/ny' ? (
            <a key={i.href} href={i.href} className="flex min-h-16 flex-1 flex-col items-center justify-center text-primary no-underline">
              <span className="grid size-12 place-items-center rounded-full bg-primary text-on-primary shadow-[var(--shadow-1)]"><Plus className="size-6" aria-hidden="true" /></span>
              <span className="sr-only">{i.label}</span>
            </a>
          ) : (
            <a key={i.href} href={i.href} aria-current={active(i.href) ? 'page' : undefined} className={cn('flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs text-muted no-underline', active(i.href) && 'font-semibold text-primary')}>
              <i.icon className="size-6" aria-hidden="true" /> {i.label}
            </a>
          ),
        )}
      </nav>
    </div>
  );
}
