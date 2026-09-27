import { formatNok } from '@faktura/core';
import { api } from '../api.ts';
import { ErrorBox, Loading, useLoad } from '../ui.tsx';
import { InvoiceRows } from './Invoices.tsx';

export function Dashboard() {
  const [data, error] = useLoad(() => Promise.all([api.dashboard(), api.invoices()]));
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const [d, invoices] = data;

  return (
    <>
      {d.missingCompanyInfo.length > 0 && (
        <a className="banner" href="#/innstillinger">
          <strong>Fullfør firmaopplysningene før du sender første faktura</strong>
          <span>Mangler: {d.missingCompanyInfo.join(', ')} →</span>
        </a>
      )}

      <a className="cta" href="#/ny">
        + Ny faktura
      </a>

      <div className="stats">
        <a className="stat" href="#/fakturaer?status=sent">
          <span>Utestående</span>
          <strong>{formatNok(d.outstanding)}</strong>
          <small>{d.outstandingCount} {d.outstandingCount === 1 ? 'faktura' : 'fakturaer'}</small>
        </a>
        <a className={`stat ${d.overdueCount ? 'warn' : ''}`} href="#/fakturaer?status=overdue">
          <span>Forfalt</span>
          <strong>{formatNok(d.overdue)}</strong>
          <small>{d.overdueCount} {d.overdueCount === 1 ? 'faktura' : 'fakturaer'}</small>
        </a>
        <a className="stat" href="#/fakturaer?status=paid">
          <span>Betalt denne måneden</span>
          <strong>{formatNok(d.paidThisMonth)}</strong>
        </a>
      </div>

      <h2>Siste fakturaer</h2>
      {invoices.length === 0 ? <p className="muted">Du har ingen fakturaer ennå. Lag din første — det tar under et minutt.</p> : <InvoiceRows invoices={invoices.slice(0, 8)} />}
    </>
  );
}
