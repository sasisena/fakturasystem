import { ChevronRight } from 'lucide-react';
import { InvoiceStatus } from '@/components/invoice-status';
import { formatNok } from '@/lib/faktura';

export type InvoiceRow = {
  id: string;
  kind: string;
  status: string;
  overdue: boolean;
  number: number | null;
  customerName: string;
  gross: number;
  dueDate: string | null;
  issueDate: string | null;
  updatedAt: Date | string;
};

const fmtIso = (iso: string) => iso.split('-').reverse().join('.');
const fmtDate = (d: Date | string) => new Intl.DateTimeFormat('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Oslo' }).format(new Date(d));

function subline(i: InvoiceRow) {
  if (i.status === 'utkast') return `Utkast · endret ${fmtDate(i.updatedAt)}`;
  if (i.kind === 'kreditnota') return `Kreditnota ${i.number} · ${fmtIso(i.issueDate!)}`;
  return `Nr. ${i.number} · forfall ${fmtIso(i.dueDate!)}`;
}

const date = (i: InvoiceRow) => (i.issueDate ? fmtIso(i.issueDate) : fmtDate(i.updatedAt));

/**
 * Fakturaliste: ser ut som en tabell på stor skjerm og som kort på mobil (samme markering, så
 * hver tekst finnes bare én gang). Hele raden er en lenke. Status vises med tekst og ikon.
 */
export function InvoiceRows({ invoices }: { invoices: InvoiceRow[] }) {
  const cols = 'md:grid md:grid-cols-[minmax(0,1fr)_7rem_8rem_8rem] md:items-center md:gap-4';
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div aria-hidden="true" className={`hidden border-b border-border bg-surface-2 px-4 py-3 text-xs font-semibold text-muted ${cols}`}>
        <span>Kunde</span>
        <span>Dato</span>
        <span className="text-right">Beløp</span>
        <span>Status</span>
      </div>
      <ul className="divide-y divide-border">
        {invoices.map((i) => (
          <li key={i.id}>
            <a href={`/app/fakturaer/${i.id}`} className={`flex min-h-16 items-center gap-3 px-4 py-3 text-ink no-underline hover:bg-surface-2 ${cols}`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{i.customerName}</span>
                <span className="block text-sm text-muted md:text-xs">{subline(i)}</span>
              </span>
              <span className="tabular hidden text-sm text-muted md:block">{date(i)}</span>
              <span className="flex flex-col items-end gap-1 md:contents">
                <span className="tabular font-semibold whitespace-nowrap md:text-right md:text-sm">{formatNok(i.gross)}</span>
                <span className="md:justify-self-start"><InvoiceStatus {...i} /></span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted md:hidden" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
