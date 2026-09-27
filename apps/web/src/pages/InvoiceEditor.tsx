import { useEffect, useState } from 'react';
import { formatNok, formatOre, invoiceTotals, parseKroner, VAT_RATES, type Company, type Customer, type InvoiceLineInput, type VatRate } from '@faktura/core';
import { api, type DraftInput } from '../api.ts';
import { navigate } from '../router.ts';
import { ErrorBox, Loading } from '../ui.tsx';
import { CustomerForm } from './CustomerForm.tsx';

interface LineState {
  key: number;
  description: string;
  quantity: string;
  price: string;
  vatRate: VatRate;
}

let nextKey = 1;
const newLine = (): LineState => ({ key: nextKey++, description: '', quantity: '1', price: '', vatRate: 25 });
const parseQty = (s: string) => Number(s.replace(',', '.'));

function toLineInput(l: LineState): InvoiceLineInput {
  return { description: l.description, quantity: parseQty(l.quantity), unitPrice: parseKroner(l.price) ?? NaN, vatRate: l.vatRate };
}

/** Oppretter ny faktura, eller redigerer et utkast når id er satt. */
export function InvoiceEditor({ id }: { id?: number }) {
  const [company, setCompany] = useState<Company>();
  const [customers, setCustomers] = useState<Customer[]>();
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [lines, setLines] = useState<LineState[]>([newLine()]);
  const [theirReference, setTheirReference] = useState('');
  const [note, setNote] = useState('');
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.company(), api.customers(), id ? api.invoice(id) : null]).then(([co, cs, inv]) => {
      setCompany(co);
      setCustomers(cs);
      if (inv) {
        setCustomerId(inv.customerId);
        setTheirReference(inv.theirReference);
        setNote(inv.note);
        setLines(inv.lines.map((l) => ({ key: nextKey++, description: l.description, quantity: String(l.quantity).replace('.', ','), price: formatOre(l.unitPrice), vatRate: l.vatRate })));
      } else {
        const preset = Number(new URLSearchParams(window.location.hash.split('?')[1]).get('kunde'));
        if (preset) setCustomerId(preset);
        else if (cs.length === 0) setAddingCustomer(true);
      }
    }, setError);
  }, [id]);

  if (!company || !customers) return error ? <ErrorBox error={error} /> : <Loading />;

  const customer = customers.find((c) => c.id === customerId);
  const validLines = lines.map(toLineInput).filter((l) => Number.isFinite(l.unitPrice) && l.quantity > 0);
  const totals = invoiceTotals(validLines, company.vatRegistered);
  const updateLine = (key: number, patch: Partial<LineState>) => setLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const save = async (then: 'draft' | 'email' | 'none') => {
    setBusy(true);
    setError(null);
    try {
      const draft: DraftInput = { customerId: Number(customerId), lines: lines.map(toLineInput), theirReference, note };
      const inv = id ? await api.updateDraft(id, draft) : await api.createDraft(draft);
      if (then !== 'draft') await api.send(inv.id, then);
      navigate(`/fakturaer/${inv.id}`);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  return (
    <>
      <header className="page-head">
        <h1>{id ? 'Rediger utkast' : 'Ny faktura'}</h1>
      </header>

      <section className="card">
        <h2>Kunde</h2>
        {addingCustomer ? (
          <CustomerForm
            onSaved={(c) => {
              setCustomers([...customers, c]);
              setCustomerId(c.id);
              setAddingCustomer(false);
            }}
            onCancel={customers.length ? () => setAddingCustomer(false) : undefined}
          />
        ) : (
          <div className="row">
            <select value={customerId} onChange={(e) => setCustomerId(Number(e.target.value) || '')} aria-label="Kunde">
              <option value="">Velg kunde …</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="button" className="secondary" onClick={() => setAddingCustomer(true)}>
              + Ny
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Linjer</h2>
        {lines.map((l, i) => (
          <div className="line" key={l.key}>
            <input
              className="desc"
              placeholder="Hva har du levert?"
              value={l.description}
              onChange={(e) => updateLine(l.key, { description: e.target.value })}
              autoFocus={i > 0 && l.description === ''}
            />
            <div className="line-nums">
              <label>
                <span>Antall</span>
                <input inputMode="decimal" value={l.quantity} onChange={(e) => updateLine(l.key, { quantity: e.target.value })} />
              </label>
              <label>
                <span>Pris eks. mva</span>
                <input inputMode="decimal" placeholder="0,00" value={l.price} onChange={(e) => updateLine(l.key, { price: e.target.value })} />
              </label>
              {company.vatRegistered && (
                <label>
                  <span>Mva</span>
                  <select value={l.vatRate} onChange={(e) => updateLine(l.key, { vatRate: Number(e.target.value) as VatRate })}>
                    {VAT_RATES.map((r) => (
                      <option key={r} value={r}>
                        {r} %
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {lines.length > 1 && (
                <button type="button" className="icon" aria-label="Fjern linje" onClick={() => setLines(lines.filter((x) => x.key !== l.key))}>
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
        <button type="button" className="link" onClick={() => setLines([...lines, { ...newLine(), vatRate: lines.at(-1)!.vatRate }])}>
          + Legg til linje
        </button>

        <dl className="totals">
          <dt>Sum eks. mva</dt>
          <dd>{formatOre(totals.net)}</dd>
          {company.vatRegistered && (
            <>
              <dt>Mva</dt>
              <dd>{formatOre(totals.vat)}</dd>
            </>
          )}
          <dt className="grand">Å betale</dt>
          <dd className="grand">{formatNok(totals.gross)}</dd>
        </dl>
      </section>

      <details className="card">
        <summary>Referanse og melding</summary>
        <div className="stack">
          <label className="field">
            <span>Deres referanse</span>
            <input value={theirReference} onChange={(e) => setTheirReference(e.target.value)} />
          </label>
          <label className="field">
            <span>Melding på fakturaen</span>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
      </details>

      <ErrorBox error={error} />

      <div className="actions sticky">
        <button type="button" className="secondary" disabled={busy} onClick={() => save('draft')}>
          Lagre utkast
        </button>
        {customer?.email ? (
          <button type="button" disabled={busy} onClick={() => save('email')}>
            Send til {customer.email}
          </button>
        ) : (
          <button type="button" disabled={busy || !customer} onClick={() => save('none')} title="Fakturaen låses og får nummer — del PDF-en selv">
            Lag faktura
          </button>
        )}
      </div>
    </>
  );
}
