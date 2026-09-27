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

/** Fakturaliste. Status vises med tekst og ikon, ikke bare farge. */
export function InvoiceRows({ invoices }: { invoices: InvoiceRow[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {invoices.map((i) => (
        <li key={i.id}>
          <a href={`/app/fakturaer/${i.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 text-ink no-underline hover:bg-surface-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{i.customerName}</span>
              <span className="block text-sm text-muted">{subline(i)}</span>
            </span>
            <span className="flex flex-col items-end gap-1">
              <span className="tabular font-semibold whitespace-nowrap">{formatNok(i.gross)}</span>
              <InvoiceStatus {...i} />
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}
