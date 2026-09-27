import type { Metadata } from 'next';
import { FileDown, Pencil } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Alert, Badge, Card } from '@/components/ui/card';
import { formatNok, formatOre } from '@/lib/faktura';
import { invoiceById } from '@/server/invoicing';
import { withOrg } from '@/server/org-data';
import { requireOrg } from '@/server/page-auth';
import { DeleteDraft } from './delete-draft';

export const metadata: Metadata = { title: 'Faktura' };

const qty = (q: number) => q.toLocaleString('nb-NO', { maximumFractionDigits: 3 });

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireOrg(`/app/fakturaer/${id}`);
  const inv = await withOrg(u, 'faktura:se', (tx, orgId) => invoiceById(tx, orgId, id));
  const canEdit = u.access.can('faktura:endre');
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Badge tone="neutral">Utkast</Badge>
        <h1 className="mt-2">Faktura til {inv.customer.name}</h1>
      </div>

      <Card className="flex flex-col items-center gap-1 text-center">
        <span className="text-muted">Å betale</span>
        <strong className="tabular text-4xl">{formatNok(inv.totals.gross)}</strong>
        {inv.vatRegistered && <span className="tabular text-sm text-muted">herav mva {formatNok(inv.totals.vat)}</span>}
      </Card>

      <div className="flex flex-wrap gap-3">
        {canEdit && <a href={`/app/fakturaer/${inv.id}/rediger`} className={buttonVariants()}><Pencil className="size-5" aria-hidden="true" /> Endre</a>}
        <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'secondary' })}>
          <FileDown className="size-5" aria-hidden="true" /> Se PDF
        </a>
      </div>

      <Alert tone="info">Dette er et utkast. Utsending med fakturanummer og KID kommer i neste versjon.</Alert>

      <Card>
        <table className="w-full border-collapse">
          <caption className="sr-only">Fakturalinjer</caption>
          <thead>
            <tr className="text-left text-sm text-muted">
              <th className="pb-2 font-semibold">Beskrivelse</th>
              <th className="pb-2 text-right font-semibold">Beløp</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l) => (
              <tr key={l.id} className="border-t border-border align-top">
                <td className="py-2 pr-3">
                  {l.description}
                  <div className="tabular text-sm text-muted">
                    {qty(l.quantity)} {l.unit} × {formatOre(l.unitPrice)}{inv.vatRegistered && ` · ${l.vatRate} % mva`}
                  </div>
                </td>
                <td className="tabular py-2 text-right whitespace-nowrap">{formatOre(l.net)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="tabular">
            <tr className="border-t border-border"><td className="pt-3">Sum eks. mva</td><td className="pt-3 text-right">{formatOre(inv.totals.net)}</td></tr>
            {inv.vatRegistered && inv.totals.vatBreakdown.filter((b) => b.vat !== 0).map((b) => (
              <tr key={b.rate}><td>Mva {b.rate} %</td><td className="text-right">{formatOre(b.vat)}</td></tr>
            ))}
            <tr className="text-lg font-semibold"><td className="pt-2">Totalt</td><td className="pt-2 text-right">{formatNok(inv.totals.gross)}</td></tr>
          </tfoot>
        </table>
        {(inv.theirReference || inv.note) && (
          <div className="mt-4 border-t border-border pt-4 text-sm">
            {inv.theirReference && <p><span className="text-muted">Deres ref.:</span> {inv.theirReference}</p>}
            {inv.note && <p className="mt-1 whitespace-pre-wrap">{inv.note}</p>}
          </div>
        )}
      </Card>

      <p className="text-sm"><a href={`/app/kunder/${inv.customer.id}`}>Kunde nr. {inv.customer.customerNumber}: {inv.customer.name}</a></p>
      {canEdit && <DeleteDraft id={inv.id} />}
    </div>
  );
}
