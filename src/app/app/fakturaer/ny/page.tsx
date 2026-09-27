import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { InvoiceEditor } from '@/components/invoice-editor';
import { editorData } from '@/server/invoicing';
import { withOrg } from '@/server/org-data';
import { requireOrg } from '@/server/page-auth';

export const metadata: Metadata = { title: 'Ny faktura' };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ kunde?: string }> }) {
  const { kunde } = await searchParams;
  const u = await requireOrg('/app/fakturaer/ny');
  if (!u.access.can('faktura:endre')) redirect('/app/fakturaer');
  const data = await withOrg(u, 'faktura:endre', editorData);
  const preset = data.customers.some((c) => c.id === kunde) ? kunde : undefined;
  return (
    <div className="flex flex-col gap-6">
      <h1>Ny faktura</h1>
      <InvoiceEditor {...data} presetCustomerId={preset} />
    </div>
  );
}
