'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CustomerForm } from '@/components/customer-form';
import { Button } from '@/components/ui/button';
import { Alert, Card } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { api, errorText, type ApiErrorBody } from '@/lib/api-client';
import { formatNok, formatOre, invoiceTotals, lineTotals, parseKroner, VAT_RATES, type VatRate } from '@/lib/faktura';
import type { CustomerDto, InvoiceDto, ProductDto } from '@/server/invoicing';

type Line = { key: number; productId: string | null; description: string; quantity: string; unit: string; price: string; vatRate: VatRate };

let nextKey = 1;
const blankLine = (vatRate: VatRate): Line => ({ key: nextKey++, productId: null, description: '', quantity: '1', unit: 'stk', price: '', vatRate });
const parseQty = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'));

/**
 * Skjema for nytt utkast eller endring av utkast. Summene regnes ut mens man skriver, med samme
 * kode som serveren bruker (src/lib/faktura), så tallene på skjermen og i PDF-en er like.
 */
export function InvoiceEditor({ customers: initialCustomers, products, vatRegistered, invoice, presetCustomerId }: {
  customers: CustomerDto[];
  products: ProductDto[];
  vatRegistered: boolean;
  invoice?: InvoiceDto;
  presetCustomerId?: string;
}) {
  const router = useRouter();
  const defaultVat: VatRate = vatRegistered ? 25 : 0;
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState(invoice?.customer.id ?? presetCustomerId ?? '');
  const [addingCustomer, setAddingCustomer] = useState(initialCustomers.length === 0);
  const [lines, setLines] = useState<Line[]>(
    invoice?.lines.map((l) => ({ key: nextKey++, productId: l.productId, description: l.description, quantity: String(l.quantity).replace('.', ','), unit: l.unit, price: formatOre(l.unitPrice), vatRate: l.vatRate })) ?? [blankLine(defaultVat)],
  );
  const [theirReference, setTheirReference] = useState(invoice?.theirReference ?? '');
  const [note, setNote] = useState(invoice?.note ?? '');
  const [error, setError] = useState<ApiErrorBody | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = lines.map((l) => ({ description: l.description, quantity: parseQty(l.quantity), unitPrice: parseKroner(l.price), vatRate: vatRegistered ? l.vatRate : (0 as VatRate) }));
  const valid = parsed.filter((l): l is typeof l & { unitPrice: number } => l.unitPrice !== null && l.quantity > 0);
  const totals = invoiceTotals(valid, vatRegistered);
  const fieldError = (f: string) => error?.errors?.find((e) => e.field === f)?.message;

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function pickProduct(key: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return update(key, { productId: null });
    update(key, { productId: p.id, description: p.name, unit: p.unit, price: formatOre(p.unitPrice), vatRate: (vatRegistered ? p.vatRate : 0) as VatRate });
  }

  async function save() {
    setError(null);
    const bad = parsed.findIndex((l) => l.unitPrice === null);
    if (bad >= 0) return setError({ message: `Linje ${bad + 1}: skriv prisen i kroner, for eksempel 1 250 eller 1250,50.` });
    setBusy(true);
    const body = {
      customerId,
      theirReference,
      note,
      lines: lines.map((l, i) => ({ productId: l.productId, description: l.description, quantity: parsed[i].quantity, unit: l.unit, unitPrice: parsed[i].unitPrice, vatRate: parsed[i].vatRate })),
    };
    const r = invoice ? await api<InvoiceDto>(`/api/invoices/${invoice.id}`, { method: 'PUT', body }) : await api<InvoiceDto>('/api/invoices', { body });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.push(`/app/fakturaer/${r.data.id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="mb-3">Kunde</h2>
        {addingCustomer ? (
          <CustomerForm
            submitLabel="Legg til og velg"
            onSaved={(c) => {
              setCustomers((cs) => [...cs, c].sort((a, b) => a.name.localeCompare(b.name, 'nb')));
              setCustomerId(c.id);
              setAddingCustomer(false);
            }}
            onCancel={customers.length ? () => setAddingCustomer(false) : undefined}
          />
        ) : (
          <div className="flex gap-2">
            <Select aria-label="Kunde" value={customerId} onChange={(e) => setCustomerId(e.target.value)} aria-invalid={!!fieldError('customerId')} className="flex-1">
              <option value="">Velg kunde …</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Button variant="tonal" onClick={() => setAddingCustomer(true)}>Ny kunde</Button>
          </div>
        )}
        {fieldError('customerId') && <p className="mt-2 text-sm text-danger">{fieldError('customerId')}</p>}
      </Card>

      <Card>
        <h2 className="mb-3">Linjer</h2>
        <ol className="flex flex-col gap-4">
          {lines.map((l, i) => {
            const p = parsed[i];
            const net = p.unitPrice !== null && p.quantity > 0 ? lineTotals({ ...p, unitPrice: p.unitPrice }).net : null;
            const err = (f: string) => fieldError(`lines.${i}.${f}`);
            return (
              <li key={l.key} className="flex flex-col gap-3 border-b border-border pb-4 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted">Linje {i + 1}</span>
                  {lines.length > 1 && (
                    <Button variant="ghost" size="sm" aria-label={`Fjern linje ${i + 1}`} onClick={() => setLines(lines.filter((x) => x.key !== l.key))}>
                      <Trash2 className="size-4" aria-hidden="true" /> Fjern
                    </Button>
                  )}
                </div>
                {products.length > 0 && (
                  <Select aria-label={`Produkt på linje ${i + 1}`} value={l.productId ?? ''} onChange={(e) => pickProduct(l.key, e.target.value)}>
                    <option value="">Velg produkt, eller skriv selv under</option>
                    {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.name} – {formatNok(pr.unitPrice)}/{pr.unit}</option>)}
                  </Select>
                )}
                <Field id={`linje-${l.key}-tekst`} label="Beskrivelse" error={err('description')}>
                  <Input id={`linje-${l.key}-tekst`} value={l.description} placeholder="Hva har du levert?" onChange={(e) => update(l.key, { description: e.target.value })} aria-invalid={!!err('description')} />
                </Field>
                <div className={vatRegistered ? 'grid grid-cols-[1fr_1.4fr_1fr] items-end gap-2' : 'grid grid-cols-[1fr_1.4fr] items-end gap-2'}>
                  <Field id={`linje-${l.key}-antall`} label={`Antall (${l.unit})`} error={err('quantity')}>
                    <Input id={`linje-${l.key}-antall`} inputMode="decimal" value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} aria-invalid={!!err('quantity')} />
                  </Field>
                  <Field id={`linje-${l.key}-pris`} label="Pris eks. mva" error={err('unitPrice')}>
                    <Input id={`linje-${l.key}-pris`} inputMode="decimal" placeholder="0,00" value={l.price} onChange={(e) => update(l.key, { price: e.target.value, productId: null })} aria-invalid={!!err('unitPrice')} />
                  </Field>
                  {vatRegistered && (
                    <Field id={`linje-${l.key}-mva`} label="Mva">
                      <Select id={`linje-${l.key}-mva`} value={l.vatRate} onChange={(e) => update(l.key, { vatRate: Number(e.target.value) as VatRate })}>
                        {VAT_RATES.map((r) => <option key={r} value={r}>{r} %</option>)}
                      </Select>
                    </Field>
                  )}
                </div>
                {net !== null && <p className="tabular text-right text-sm text-muted">Beløp eks. mva: {formatNok(net)}</p>}
              </li>
            );
          })}
        </ol>
        <Button variant="ghost" className="mt-2" onClick={() => setLines([...lines, blankLine(lines.at(-1)?.vatRate ?? defaultVat)])}>+ Legg til linje</Button>

        <dl className="tabular mt-4 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-border pt-4">
          <dt>Sum eks. mva</dt>
          <dd className="text-right">{formatNok(totals.net)}</dd>
          {vatRegistered && totals.vatBreakdown.filter((b) => b.vat !== 0).map((b) => (
            <div key={b.rate} className="contents">
              <dt className="text-muted">Mva {b.rate} %</dt>
              <dd className="text-right text-muted">{formatNok(b.vat)}</dd>
            </div>
          ))}
          <dt className="pt-2 text-lg font-semibold">Å betale</dt>
          <dd className="pt-2 text-right text-lg font-semibold">{formatNok(totals.gross)}</dd>
        </dl>
        {!vatRegistered && <p className="mt-2 text-sm text-muted">Bedriften er ikke mva-registrert, så fakturaen får ikke mva.</p>}
      </Card>

      <details className="rounded-lg border border-border/70 bg-surface p-5 shadow-[var(--shadow-1)]">
        <summary className="cursor-pointer font-semibold">Referanse og melding til kunden</summary>
        <div className="mt-4 flex flex-col gap-4">
          <Field id="ref" label="Deres referanse">
            <Input id="ref" value={theirReference} onChange={(e) => setTheirReference(e.target.value)} />
          </Field>
          <Field id="melding" label="Melding på fakturaen">
            <Textarea id="melding" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </details>

      {error && <Alert tone="danger" role="alert">{errorText(error)}</Alert>}

      <div className="sticky bottom-20 flex gap-3 bg-bg py-3 md:bottom-0">
        <Button className="flex-1" disabled={busy || !customerId || addingCustomer} onClick={save}>
          {busy ? 'Lagrer …' : invoice ? 'Lagre endringer' : 'Lagre utkast'}
        </Button>
        {invoice && <Button variant="secondary" onClick={() => router.push(`/app/fakturaer/${invoice.id}`)}>Avbryt</Button>}
      </div>
    </div>
  );
}
