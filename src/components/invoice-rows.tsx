import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/card';
import { formatNok } from '@/lib/faktura';

export type InvoiceRow = { id: string; status: string; customerName: string; customerNumber: number; gross: number; updatedAt: Date | string };

const fmtDate = (d: Date | string) => new Intl.DateTimeFormat('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Oslo' }).format(new Date(d));

/** Fakturaliste. Status vises med tekst og ikon, ikke bare farge. */
export function InvoiceRows({ invoices }: { invoices: InvoiceRow[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {invoices.map((i) => (
        <li key={i.id}>
          <a href={`/app/fakturaer/${i.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 text-ink no-underline hover:bg-surface-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{i.customerName}</span>
              <span className="block text-sm text-muted">Endret {fmtDate(i.updatedAt)}</span>
            </span>
            <span className="flex flex-col items-end gap-1">
              <span className="tabular font-semibold whitespace-nowrap">{formatNok(i.gross)}</span>
              <Badge tone="neutral">{i.status === 'utkast' ? 'Utkast' : i.status}</Badge>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}
