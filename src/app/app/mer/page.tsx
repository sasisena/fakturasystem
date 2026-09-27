import { Building2, ChevronRight, History, Package, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { requireOrg } from '@/server/page-auth';

export const metadata: Metadata = { title: 'Mer' };

export default async function MorePage() {
  const u = await requireOrg('/app/mer');
  const links = [
    { href: '/app/produkter', label: 'Produkter', hint: 'Faste varer og tjenester', icon: Package },
    { href: '/app/firma', label: 'Firma', hint: 'Opplysningene på fakturaene', icon: Building2 },
    { href: '/app/brukere', label: 'Brukere', hint: 'Hvem som har tilgang', icon: Users },
    ...(u.access.can('logg:se') ? [{ href: '/app/logg', label: 'Logg', hint: 'Alle endringer', icon: History }] : []),
  ];
  return (
    <div className="flex flex-col gap-6">
      <h1>Mer</h1>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href} className="flex min-h-16 items-center gap-4 px-4 py-3 text-ink no-underline hover:bg-surface-2">
              <l.icon className="size-6 text-primary" aria-hidden="true" />
              <span className="flex-1">
                <span className="block font-semibold">{l.label}</span>
                <span className="text-sm text-muted">{l.hint}</span>
              </span>
              <ChevronRight className="size-5 text-muted" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
