'use client';

import { Building2, FileText, History, LayoutDashboard, LogOut, Repeat, Users, type LucideIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/logo';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';

type Item = { href: string; label: string; icon: LucideIcon; soon?: boolean };

/**
 * Navigasjon: venstremeny på stor skjerm, bunnmeny på mobil (samme mønster som ATAK-systemet,
 * men med bunnmeny fordi fakturaer ofte lages fra telefonen).
 */
export function AppNav({ orgName, roleLabel, email, canSeeLog, manyOrgs }: { orgName: string; roleLabel: string; email: string; canSeeLog: boolean; manyOrgs: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const items: Item[] = [
    { href: '/app', label: 'Oversikt', icon: LayoutDashboard },
    { href: '/app/fakturaer', label: 'Fakturaer', icon: FileText, soon: true },
    { href: '/app/firma', label: 'Firma', icon: Building2 },
    { href: '/app/brukere', label: 'Brukere', icon: Users },
    ...(canSeeLog ? [{ href: '/app/logg', label: 'Logg', icon: History }] : []),
  ];
  const active = (href: string) => (href === '/app' ? path === '/app' : path.startsWith(href));

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
              {i.soon ? (
                <span className="flex min-h-12 items-center gap-3 rounded-md px-3 text-on-nav-muted opacity-70">
                  <i.icon className="size-5" aria-hidden="true" /> {i.label} <span className="ml-auto text-xs">Kommer</span>
                </span>
              ) : (
                <a href={i.href} aria-current={active(i.href) ? 'page' : undefined} className={cn('flex min-h-12 items-center gap-3 rounded-md px-3 text-on-nav no-underline hover:bg-nav-strong', active(i.href) && 'bg-nav-strong font-semibold')}>
                  <i.icon className="size-5" aria-hidden="true" /> {i.label}
                </a>
              )}
            </li>
          ))}
        </ul>
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
        {items.filter((i) => !i.soon && i.href !== '/app/logg').map((i) => (
          <a key={i.href} href={i.href} aria-current={active(i.href) ? 'page' : undefined} className={cn('flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs text-muted no-underline', active(i.href) && 'font-semibold text-primary')}>
            <i.icon className="size-6" aria-hidden="true" /> {i.label}
          </a>
        ))}
      </nav>
    </>
  );
}
