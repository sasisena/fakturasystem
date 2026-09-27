'use client';

import { Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Card } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import { api, errorText } from '@/lib/api-client';
import { formatNok, formatOre, parseKroner, VAT_RATES } from '@/lib/faktura';
import type { ProductDto } from '@/server/invoicing';

type Draft = { id?: string; name: string; unit: string; price: string; vatRate: number };
const UNITS = ['stk', 'timer', 'dager', 'km', 'mnd'];

function ProductForm({ initial, vatRegistered, onDone }: { initial: Draft; vatRegistered: boolean; onDone: () => void }) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const unitPrice = parseKroner(d.price);
    if (unitPrice === null) return setError('Skriv prisen i kroner, for eksempel 1 250 eller 1250,50.');
    setBusy(true);
    const body = { name: d.name, unit: d.unit, unitPrice, vatRate: vatRegistered ? d.vatRate : 0 };
    const r = d.id ? await api(`/api/products/${d.id}`, { method: 'PUT', body }) : await api('/api/products', { body });
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    onDone();
    router.refresh();
  }

  async function remove() {
    if (!d.id || !confirm(`Slette ${d.name}? Fakturaer der produktet er brukt, blir ikke endret.`)) return;
    const r = await api(`/api/products/${d.id}`, { method: 'DELETE' });
    if (!r.ok) return setError(errorText(r.error));
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4" noValidate>
      <Field id="produkt-navn" label="Navn">
        <Input id="produkt-navn" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field id="produkt-pris" label="Pris eks. mva (kr)">
          <Input id="produkt-pris" inputMode="decimal" value={d.price} onChange={(e) => setD({ ...d, price: e.target.value })} placeholder="0" />
        </Field>
        <Field id="produkt-enhet" label="Enhet">
          <Select id="produkt-enhet" value={d.unit} onChange={(e) => setD({ ...d, unit: e.target.value })}>
            {[...new Set([...UNITS, d.unit])].map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        </Field>
        {vatRegistered && (
          <Field id="produkt-mva" label="Mva">
            <Select id="produkt-mva" value={d.vatRate} onChange={(e) => setD({ ...d, vatRate: Number(e.target.value) })}>
              {VAT_RATES.map((r) => <option key={r} value={r}>{r} %</option>)}
            </Select>
          </Field>
        )}
      </div>
      {error && <Alert tone="danger" role="alert">{error}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy}>{d.id ? 'Lagre' : 'Legg til produkt'}</Button>
        <Button variant="secondary" onClick={onDone}>Avbryt</Button>
        {d.id && <Button variant="ghost" className="ml-auto text-danger" onClick={remove}>Slett</Button>}
      </div>
    </form>
  );
}

export function ProductList({ products, canEdit, vatRegistered }: { products: ProductDto[]; canEdit: boolean; vatRegistered: boolean }) {
  const [editing, setEditing] = useState<string | null>(null);
  const fresh: Draft = { name: '', unit: 'stk', price: '', vatRate: vatRegistered ? 25 : 0 };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Produkter</h1>
        {canEdit && editing !== 'ny' && <Button onClick={() => setEditing('ny')}><Plus className="size-5" aria-hidden="true" /> Nytt produkt</Button>}
      </div>
      <p className="text-muted">Varer og tjenester du fakturerer ofte. Velg dem på fakturaen, så fylles tekst og pris ut.</p>
      {editing === 'ny' && (
        <Card>
          <h2 className="mb-4">Nytt produkt</h2>
          <ProductForm initial={fresh} vatRegistered={vatRegistered} onDone={() => setEditing(null)} />
        </Card>
      )}
      {products.length === 0 && editing !== 'ny' && <p className="text-muted">Ingen produkter ennå.</p>}
      {products.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {products.map((p) =>
            editing === p.id ? (
              <li key={p.id} className="p-4">
                <ProductForm initial={{ id: p.id, name: p.name, unit: p.unit, price: formatOre(p.unitPrice), vatRate: p.vatRate }} vatRegistered={vatRegistered} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={p.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="text-sm text-muted">
                    {formatNok(p.unitPrice)} per {p.unit}{vatRegistered && ` · ${p.vatRate} % mva`}
                  </span>
                </span>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(p.id)} aria-label={`Endre ${p.name}`}>
                    <Pencil className="size-4" aria-hidden="true" /> Endre
                  </Button>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
