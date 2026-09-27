import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import { InvoiceRows } from '@/components/invoice-rows';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { customerById, customerDto, listInvoices } from '@/server/invoicing';
import { withOrg } from '@/server/org-data';
import { requireOrg } from '@/server/page-auth';
import { CustomerEditor } from './customer-editor';

export const metadata: Metadata = { title: 'Kunde' };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireOrg(`/app/kunder/${id}`);
  const { customer, invoices } = await withOrg(u, 'faktura:se', async (tx, orgId) => ({
    customer: customerDto(await customerById(tx, orgId, id)),
    invoices: await listInvoices(tx, orgId, { customerId: id }),
  }));
  const canEdit = u.access.can('faktura:endre');
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Kunde nr. {customer.customerNumber}</p>
          <h1>{customer.name}</h1>
        </div>
        {canEdit && (
          <a href={`/app/fakturaer/ny?kunde=${customer.id}`} className={buttonVariants()}>
            <Plus className="size-5" aria-hidden="true" /> Ny faktura
          </a>
        )}
      </div>
      <Card>
        <CustomerEditor customer={customer} canEdit={canEdit} canDelete={canEdit && invoices.length === 0} />
      </Card>
      <section className="flex flex-col gap-3">
        <h2>Fakturaer</h2>
        {invoices.length ? <InvoiceRows invoices={invoices} /> : <p className="text-muted">Ingen fakturaer til denne kunden ennå.</p>}
      </section>
    </div>
  );
}
