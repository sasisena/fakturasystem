import type { Metadata } from 'next';
import { FileDown, Pencil } from 'lucide-react';
import { InvoiceStatus } from '@/components/invoice-status';
import { buttonVariants } from '@/components/ui/button';
import { Alert, Card } from '@/components/ui/card';
import { formatAccountNumber, formatNok, formatOre } from '@/lib/faktura';
import { invoiceById } from '@/server/invoicing';
import { currentOrganization, missingForInvoicing, withOrg } from '@/server/org-data';
import { requireOrg } from '@/server/page-auth';
import { DeleteDraft } from './delete-draft';
import { InvoiceActions } from './invoice-actions';

export const metadata: Metadata = { title: 'Faktura' };

const qty = (q: number) => q.toLocaleString('nb-NO', { maximumFractionDigits: 3 });
const d = (iso: string | null) => (iso ? iso.split('-').reverse().join('.') : '');
const formatKid = (kid: string) => kid.replace(/(\d{5})(\d{7})(\d)/, '$1 $2 $3');

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireOrg(`/app/fakturaer/${id}`);
  const { inv, related } = await withOrg(u, 'faktura:se', async (tx, orgId) => {
    const inv = await invoiceById(tx, orgId, id);
    const relatedId = inv.creditOf ?? inv.creditedBy;
    return { inv, related: relatedId ? await invoiceById(tx, orgId, relatedId) : null };
  });
  const org = await currentOrganization(u);
  const canEdit = u.access.can('faktura:endre');
  const isCredit = inv.kind === 'kreditnota';
  const isDraft = inv.status === 'utkast';
  const title = isDraft ? `Faktura til ${inv.customer.name}` : `${isCredit ? 'Kreditnota' : 'Faktura'} ${inv.number}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <InvoiceStatus {...inv} />
        <h1 className="mt-2">{title}</h1>
        {!isDraft && <p className="text-muted">{inv.customer.name}</p>}
      </div>

      <Card className="flex flex-col items-center gap-1 text-center">
        <span className="text-muted">{isCredit ? 'Til gode for kunden' : 'Å betale'}</span>
        <strong className="tabular text-4xl">{formatNok(Math.abs(inv.totals.gross))}</strong>
        {inv.vatRegistered && <span className="tabular text-sm text-muted">herav mva {formatNok(Math.abs(inv.totals.vat))}</span>}
        {inv.status === 'sendt' && !isCredit && (
          <span className={inv.overdue ? 'mt-1 font-semibold text-danger' : 'mt-1 text-muted'}>
            {inv.overdue ? 'Forfalt ' : 'Forfaller '}{d(inv.dueDate)}
          </span>
        )}
        {inv.status === 'betalt' && <span className="mt-1 font-semibold text-success">Betalt {d(inv.paidDate)}</span>}
      </Card>

      {!isDraft && !isCredit && (
        <Card className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div><p className="text-sm text-muted">Fakturadato</p><p className="tabular font-semibold">{d(inv.issueDate)}</p></div>
          <div><p className="text-sm text-muted">Forfall</p><p className="tabular font-semibold">{d(inv.dueDate)}</p></div>
          <div><p className="text-sm text-muted">Konto</p><p className="tabular font-semibold">{formatAccountNumber(inv.seller?.accountNumber ?? '')}</p></div>
          <div><p className="text-sm text-muted">KID</p><p className="tabular font-semibold">{formatKid(inv.kid ?? '')}</p></div>
        </Card>
      )}

      {inv.status !== 'utkast' && (
        <p className="text-sm text-muted">
          {inv.delivery === 'epost' ? `Sendt på e-post til ${inv.sentTo}` : 'Laget ferdig for å sendes av deg selv'}
          {inv.sentAt && ` ${new Intl.DateTimeFormat('nb-NO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Oslo' }).format(inv.sentAt)}`}.
        </p>
      )}
      {related && (
        <Alert tone="info">
          {isCredit ? <>Denne kreditnotaen nuller ut <a href={`/app/fakturaer/${related.id}`}>faktura {related.number}</a>.</>
            : <>Fakturaen er kreditert med <a href={`/app/fakturaer/${related.id}`}>kreditnota {related.number}</a>.</>}
        </Alert>
      )}

      <div className="flex flex-wrap gap-3">
        {canEdit && isDraft && <a href={`/app/fakturaer/${inv.id}/rediger`} className={buttonVariants({ variant: 'secondary' })}><Pencil className="size-5" aria-hidden="true" /> Endre</a>}
        <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'secondary' })}>
          <FileDown className="size-5" aria-hidden="true" /> {isDraft ? 'Se PDF' : 'Last ned PDF'}
        </a>
      </div>

      <InvoiceActions id={inv.id} kind={inv.kind} status={inv.status} customerEmail={inv.customer.email} missing={missingForInvoicing(org)} canEdit={canEdit} />

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
      {canEdit && isDraft && <DeleteDraft id={inv.id} />}
    </div>
  );
}
