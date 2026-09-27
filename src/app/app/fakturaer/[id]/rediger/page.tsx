import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { InvoiceEditor } from '@/components/invoice-editor';
import { editorData, invoiceById } from '@/server/invoicing';
import { withOrg } from '@/server/org-data';
import { requireOrg } from '@/server/page-auth';

export const metadata: Metadata = { title: 'Endre faktura' };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireOrg(`/app/fakturaer/${id}/rediger`);
  if (!u.access.can('faktura:endre')) redirect(`/app/fakturaer/${id}`);
  const { data, invoice } = await withOrg(u, 'faktura:endre', async (tx, orgId) => ({ data: await editorData(tx, orgId), invoice: await invoiceById(tx, orgId, id) }));
  return (
    <div className="flex flex-col gap-6">
      <h1>Endre utkast</h1>
      <InvoiceEditor {...data} invoice={invoice} />
    </div>
  );
}
