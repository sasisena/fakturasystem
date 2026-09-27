import { useState, type FormEvent } from 'react';
import { isValidOrgNumber, type Customer } from '@faktura/core';
import { api, type CustomerInput } from '../api.ts';
import { ErrorBox, Field } from '../ui.tsx';

const EMPTY: CustomerInput = { name: '', orgNumber: '', email: '', address: '', postalCode: '', city: '' };

/** Kundeskjema med oppslag i Enhetsregisteret: tast org.nr., resten fylles ut. */
export function CustomerForm({ initial, onSaved, onCancel }: { initial?: Customer; onSaved: (c: Customer) => void; onCancel?: () => void }) {
  const [c, setC] = useState<CustomerInput>(initial ?? EMPTY);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof CustomerInput) => (e: { target: { value: string } }) => setC({ ...c, [k]: e.target.value });

  const lookup = async (orgNumber: string) => {
    try {
      const e = await api.lookup(orgNumber);
      setC((prev) => ({ ...prev, orgNumber: e.orgNumber, name: e.name, address: e.address, postalCode: e.postalCode, city: e.city }));
    } catch {
      /* Oppslag er bare en hjelp — brukeren kan fylle ut selv */
    }
  };

  const onOrgChange = (value: string) => {
    setC({ ...c, orgNumber: value });
    if (isValidOrgNumber(value) && !c.name) lookup(value.replace(/\s/g, ''));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(initial ? await api.updateCustomer(initial.id, c) : await api.createCustomer(c));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      <Field label="Org.nr." hint="Valgfritt for privatpersoner. Navn og adresse hentes automatisk.">
        <input inputMode="numeric" value={c.orgNumber} onChange={(e) => onOrgChange(e.target.value)} placeholder="9 siffer" />
      </Field>
      <Field label="Navn">
        <input value={c.name} onChange={set('name')} required autoComplete="off" />
      </Field>
      <Field label="E-post" hint="Fakturaen sendes hit">
        <input type="email" inputMode="email" value={c.email} onChange={set('email')} />
      </Field>
      <Field label="Adresse">
        <input value={c.address} onChange={set('address')} />
      </Field>
      <div className="row">
        <Field label="Postnr.">
          <input inputMode="numeric" value={c.postalCode} onChange={set('postalCode')} className="short" />
        </Field>
        <Field label="Sted">
          <input value={c.city} onChange={set('city')} />
        </Field>
      </div>
      <ErrorBox error={error} />
      <div className="actions">
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Avbryt
          </button>
        )}
        <button type="submit" disabled={busy}>
          {initial ? 'Lagre' : 'Legg til kunde'}
        </button>
      </div>
    </form>
  );
}
