import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { InvoiceRows } from '@/components/invoice-rows';
import { buttonVariants } from '@/components/ui/button';
import { listInvoices } from '@/server/invoicing';
import { withOrg } from '@/server/org-data';
import { requireOrg } from '@/server/page-auth';

export const metadata: Metadata = { title: 'Fakturaer' };

export default async function InvoicesPage() {
  const u = await requireOrg('/app/fakturaer');
  const invoices = await withOrg(u, 'faktura:se', (tx, orgId) => listInvoices(tx, orgId, {}));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Fakturaer</h1>
        {u.access.can('faktura:endre') && (
          <Link href="/app/fakturaer/ny" className={buttonVariants()}><Plus className="size-5" aria-hidden="true" /> Ny faktura</Link>
        )}
      </div>
      {invoices.length ? <InvoiceRows invoices={invoices} /> : <p className="text-muted">Ingen fakturaer ennå. Lag din første – det tar under et minutt.</p>}
    </div>
  );
}
