import { formatNok, type InvoiceSummary } from '@faktura/core';
import { api } from '../api.ts';
import { ErrorBox, formatDate, Loading, StatusBadge, useLoad } from '../ui.tsx';

const FILTERS: [string, string][] = [
  ['', 'Alle'],
  ['draft', 'Utkast'],
  ['sent', 'Ubetalt'],
  ['overdue', 'Forfalt'],
  ['paid', 'Betalt'],
];

export function InvoiceRows({ invoices }: { invoices: InvoiceSummary[] }) {
  return (
    <ul className="list">
      {invoices.map((i) => (
        <li key={i.id}>
          <a href={`#/fakturaer/${i.id}`}>
            <div>
              <strong>{i.customerName}</strong>
              <span className="muted">
                {i.number ? `#${i.number}` : 'Utkast'}
                {i.dueDate && i.kind === 'invoice' && ` · forfall ${formatDate(i.dueDate)}`}
              </span>
            </div>
            <div className="right">
              <strong>{formatNok(i.gross)}</strong>
              <StatusBadge status={i.status} overdue={i.overdue} kind={i.kind} />
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function Invoices({ filter }: { filter: string }) {
  const [invoices, error] = useLoad(() => api.invoices(filter), [filter]);
  return (
    <>
      <header className="page-head">
        <h1>Fakturaer</h1>
        <a className="button" href="#/ny">
          + Ny faktura
        </a>
      </header>
      <nav className="chips" aria-label="Filter">
        {FILTERS.map(([value, label]) => (
          <a key={value} href={`#/fakturaer${value ? `?status=${value}` : ''}`} className={filter === value ? 'active' : ''}>
            {label}
          </a>
        ))}
      </nav>
      {error ? <ErrorBox error={error} /> : !invoices ? <Loading /> : invoices.length === 0 ? <p className="muted">Ingen fakturaer her.</p> : <InvoiceRows invoices={invoices} />}
    </>
  );
}
