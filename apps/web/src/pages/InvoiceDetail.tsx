import { useState } from 'react';
import { formatAccountNumber, formatNok, formatOre, lineTotals, type Invoice } from '@faktura/core';
import { api } from '../api.ts';
import { navigate } from '../router.ts';
import { ErrorBox, formatDate, Loading, StatusBadge, useLoad } from '../ui.tsx';

async function sharePdf(inv: Invoice) {
  const url = api.pdfUrl(inv.id);
  const name = `${inv.kind === 'credit_note' ? 'kreditnota' : 'faktura'}-${inv.number}.pdf`;
  try {
    const blob = await (await fetch(url)).blob();
    const file = new File([blob], name, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return;
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
  }
  window.open(url, '_blank');
}

export function InvoiceDetail({ id }: { id: number }) {
  const [invoice, loadError, reload] = useLoad(() => api.invoice(id), [id]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (loadError) return <ErrorBox error={loadError} />;
  if (!invoice) return <Loading />;
  const inv = invoice;
  const isCredit = inv.kind === 'credit_note';

  const run = async (action: () => Promise<unknown>, after?: (result: any) => void) => {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      after ? after(result) : reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const title = isCredit ? `Kreditnota ${inv.number}` : inv.number ? `Faktura ${inv.number}` : 'Utkast';

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{title}</h1>
          <StatusBadge status={inv.status} overdue={inv.overdue} kind={inv.kind} />
        </div>
      </header>

      <section className="card hero">
        <span className="muted">{inv.customer.name}</span>
        <strong className="amount">{formatNok(Math.abs(inv.totals.gross))}</strong>
        {inv.status === 'draft' ? (
          <span className="muted">Ikke sendt</span>
        ) : isCredit ? (
          <span className="muted">Utstedt {formatDate(inv.issueDate)}</span>
        ) : inv.status === 'paid' ? (
          <span className="muted">Betalt {formatDate(inv.paidAt)}</span>
        ) : (
          <span className={inv.overdue ? 'danger' : 'muted'}>Forfall {formatDate(inv.dueDate)}</span>
        )}
      </section>

      <ErrorBox error={error} />

      <div className="actions wrap">
        {inv.status === 'draft' && (
          <>
            <button onClick={() => navigate(`/fakturaer/${inv.id}/rediger`)} className="secondary">
              Rediger
            </button>
            {inv.customer.email && (
              <button disabled={busy} onClick={() => run(() => api.send(inv.id, 'email'))}>
                Send på e-post
              </button>
            )}
            <button disabled={busy} className={inv.customer.email ? 'secondary' : ''} onClick={() => run(() => api.send(inv.id, 'none'))}>
              Lag faktura uten å sende
            </button>
          </>
        )}
        {inv.status === 'sent' && !isCredit && (
          <button disabled={busy} className="success" onClick={() => run(() => api.markPaid(inv.id))}>
            ✓ Merk som betalt
          </button>
        )}
        {inv.status !== 'draft' && (
          <button className="secondary" onClick={() => sharePdf(inv)}>
            Del / last ned PDF
          </button>
        )}
        {inv.status === 'draft' && (
          <a className="button secondary" href={api.pdfUrl(inv.id)} target="_blank" rel="noreferrer">
            Forhåndsvis PDF
          </a>
        )}
      </div>

      {inv.status !== 'draft' && !isCredit && (
        <section className="card payment">
          <div>
            <span className="muted">Konto</span>
            <strong>{formatAccountNumber(inv.seller!.accountNumber)}</strong>
          </div>
          <div>
            <span className="muted">KID</span>
            <strong>{inv.kid}</strong>
          </div>
        </section>
      )}

      <section className="card">
        <table className="lines">
          <thead>
            <tr>
              <th>Beskrivelse</th>
              <th className="num">Beløp</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.description}
                  <div className="muted small">
                    {String(l.quantity).replace('.', ',')} × {formatOre(l.unitPrice)}
                    {(inv.seller ?? { vatRegistered: true }).vatRegistered && ` · ${l.vatRate} % mva`}
                  </div>
                </td>
                <td className="num">{formatOre(lineTotals(l).net)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Sum eks. mva</td>
              <td className="num">{formatOre(inv.totals.net)}</td>
            </tr>
            {inv.totals.vatBreakdown
              .filter((b) => b.vat !== 0)
              .map((b) => (
                <tr key={b.rate}>
                  <td>Mva {b.rate} %</td>
                  <td className="num">{formatOre(b.vat)}</td>
                </tr>
              ))}
            <tr className="grand">
              <td>Totalt</td>
              <td className="num">{formatOre(inv.totals.gross)}</td>
            </tr>
          </tfoot>
        </table>
        {inv.note && <p className="note">{inv.note}</p>}
      </section>

      <div className="actions quiet">
        {inv.status === 'paid' && (
          <button className="link" disabled={busy} onClick={() => run(() => api.markUnpaid(inv.id))}>
            Angre betalt
          </button>
        )}
        {(inv.status === 'sent' || inv.status === 'paid') && !isCredit && (
          <button
            className="link danger"
            disabled={busy}
            onClick={() => confirm('Lage en kreditnota som nuller ut hele fakturaen?') && run(() => api.credit(inv.id), (c: Invoice) => navigate(`/fakturaer/${c.id}`))}
          >
            Krediter faktura
          </button>
        )}
        {inv.creditsInvoiceId && (
          <a className="link" href={`#/fakturaer/${inv.creditsInvoiceId}`}>
            Gå til opprinnelig faktura
          </a>
        )}
        {inv.status === 'draft' && (
          <button className="link danger" disabled={busy} onClick={() => confirm('Slette utkastet?') && run(() => api.deleteDraft(inv.id), () => navigate('/fakturaer'))}>
            Slett utkast
          </button>
        )}
      </div>
    </>
  );
}
