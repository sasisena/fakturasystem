'use client';

import { Building2, Contact, FileText, History, LayoutDashboard, LogOut, Menu, Package, Plus, Repeat, Users, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/logo';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';

type Item = { href: string; label: string; icon: LucideIcon };

/**
 * Navigasjon: venstremeny på stor skjerm, bunnmeny på mobil (samme mønster som ATAK-systemet,
 * men med bunnmeny fordi fakturaer ofte lages fra telefonen).
 */
export function AppNav({ orgName, roleLabel, email, canSeeLog, manyOrgs }: { orgName: string; roleLabel: string; email: string; canSeeLog: boolean; manyOrgs: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const items: Item[] = [
    { href: '/app', label: 'Oversikt', icon: LayoutDashboard },
    { href: '/app/fakturaer', label: 'Fakturaer', icon: FileText },
    { href: '/app/kunder', label: 'Kunder', icon: Contact },
    { href: '/app/produkter', label: 'Produkter', icon: Package },
    { href: '/app/firma', label: 'Firma', icon: Building2 },
    { href: '/app/brukere', label: 'Brukere', icon: Users },
    ...(canSeeLog ? [{ href: '/app/logg', label: 'Logg', icon: History }] : []),
  ];
  // Bunnmenyen på mobil: de viktigste, pluss «Mer» for resten.
  const mobile: Item[] = [
    items[0],
    items[1],
    { href: '/app/fakturaer/ny', label: 'Ny faktura', icon: Plus },
    items[2],
    { href: '/app/mer', label: 'Mer', icon: Menu },
  ];
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

  return (
    <>
      <nav aria-label="Hovedmeny" className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-nav p-4 text-on-nav md:flex">
        <a href="/app" className="mb-6 text-on-nav no-underline"><Logo /></a>
        <div className="mb-6 rounded-md bg-nav-strong p-3">
          <p className="font-semibold">{orgName}</p>
          <p className="text-sm text-on-nav-muted">{roleLabel}</p>
          {manyOrgs && (
            <a href="/velg-bedrift" className="mt-2 inline-flex items-center gap-1 text-sm text-on-nav-muted">
              <Repeat className="size-4" aria-hidden="true" /> Bytt bedrift
            </a>
          )}
        </div>
        <ul className="flex flex-col gap-1">
          {items.map((i) => (
            <li key={i.href}>
              <a href={i.href} aria-current={active(i.href) ? 'page' : undefined} className={cn('flex min-h-12 items-center gap-3 rounded-md px-3 text-on-nav no-underline hover:bg-nav-strong', active(i.href) && 'bg-nav-strong font-semibold')}>
                <i.icon className="size-5" aria-hidden="true" /> {i.label}
              </a>
            </li>
          ))}
        </ul>
        <Link href="/app/fakturaer/ny" className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-button)] bg-accent font-semibold text-on-accent no-underline hover:brightness-105">
          <Plus className="size-5" aria-hidden="true" /> Ny faktura
        </Link>
        <div className="mt-auto border-t border-white/20 pt-4 text-sm">
          <p className="truncate text-on-nav-muted">{email}</p>
          <button type="button" onClick={logout} className="mt-2 inline-flex items-center gap-2 text-on-nav hover:underline">
            <LogOut className="size-4" aria-hidden="true" /> Logg ut
          </button>
        </div>
      </nav>

      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
        <a href="/app" className="min-w-0 no-underline">
          <span className="block truncate font-semibold text-ink">{orgName}</span>
          <span className="block text-sm text-muted">{roleLabel}</span>
        </a>
        <div className="flex items-center gap-3">
          {manyOrgs && <a href="/velg-bedrift" aria-label="Bytt bedrift"><Repeat className="size-5" aria-hidden="true" /></a>}
          <button type="button" onClick={logout} aria-label="Logg ut" className="text-primary"><LogOut className="size-5" aria-hidden="true" /></button>
        </div>
      </header>
      <nav aria-label="Hovedmeny" className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {mobile.map((i) =>
          i.href === '/app/fakturaer/ny' ? (
            <a key={i.href} href={i.href} className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold text-primary no-underline">
              <span className="grid size-10 place-items-center rounded-full bg-primary text-on-primary"><Plus className="size-6" aria-hidden="true" /></span>
              <span className="sr-only">{i.label}</span>
            </a>
          ) : (
            <a key={i.href} href={i.href} aria-current={active(i.href) ? 'page' : undefined} className={cn('flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs text-muted no-underline', active(i.href) && 'font-semibold text-primary')}>
              <i.icon className="size-6" aria-hidden="true" /> {i.label}
            </a>
          ),
        )}
      </nav>
    </>
  );
}
