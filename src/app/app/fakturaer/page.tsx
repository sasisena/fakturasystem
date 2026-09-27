import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { InvoiceRows } from '@/components/invoice-rows';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { LIST_FILTERS, listInvoices } from '@/server/invoicing';
import { withOrg } from '@/server/org-data';
import { requireOrg } from '@/server/page-auth';

export const metadata: Metadata = { title: 'Fakturaer' };

const FILTERS: [string, string][] = [['', 'Alle'], ['utkast', 'Utkast'], ['ubetalt', 'Ubetalt'], ['forfalt', 'Forfalt'], ['betalt', 'Betalt'], ['kreditert', 'Kreditert']];

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: raw } = await searchParams;
  const status = (LIST_FILTERS as readonly string[]).includes(raw ?? '') ? raw! : '';
  const u = await requireOrg('/app/fakturaer');
  const invoices = await withOrg(u, 'faktura:se', (tx, orgId) => listInvoices(tx, orgId, { status }));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Fakturaer</h1>
        {u.access.can('faktura:endre') && (
          <Link href="/app/fakturaer/ny" className={buttonVariants()}><Plus className="size-5" aria-hidden="true" /> Ny faktura</Link>
        )}
      </div>
      <nav aria-label="Filter" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map(([value, label]) => (
          <Link
            key={value}
            href={value ? `/app/fakturaer?status=${value}` : '/app/fakturaer'}
            aria-current={status === value ? 'page' : undefined}
            className={cn('rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap no-underline', status === value ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface text-ink')}
          >
            {label}
          </Link>
        ))}
      </nav>
      {invoices.length ? <InvoiceRows invoices={invoices} /> : <p className="text-muted">{status ? 'Ingen fakturaer her.' : 'Ingen fakturaer ennå. Lag din første – det tar under et minutt.'}</p>}
    </div>
  );
}
