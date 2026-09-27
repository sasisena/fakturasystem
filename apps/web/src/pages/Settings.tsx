import { useEffect, useState, type FormEvent } from 'react';
import { isValidOrgNumber, type Company } from '@faktura/core';
import { api } from '../api.ts';
import { ErrorBox, Field, Loading } from '../ui.tsx';

export function Settings() {
  const [c, setC] = useState<Company>();
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.company().then(setC, setError);
  }, []);
  if (!c) return error ? <ErrorBox error={error} /> : <Loading />;

  const set = (k: keyof Company) => (e: { target: { value: string } }) => {
    setSaved(false);
    setC({ ...c, [k]: e.target.value });
  };

  const onOrgChange = async (value: string) => {
    setC({ ...c, orgNumber: value });
    if (!isValidOrgNumber(value)) return;
    try {
      const e = await api.lookup(value);
      setC((prev) => prev && { ...prev, orgNumber: e.orgNumber, name: prev.name || e.name, address: e.address, postalCode: e.postalCode, city: e.city, vatRegistered: e.vatRegistered });
    } catch {
      /* fyll ut manuelt */
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setC(await api.saveCompany({ ...c, paymentTermsDays: Number(c.paymentTermsDays) }));
      setSaved(true);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <>
      <header className="page-head">
        <h1>Firma</h1>
      </header>
      <form className="card stack" onSubmit={submit}>
        <Field label="Organisasjonsnummer" hint="Vi henter navn, adresse og mva-status fra Brønnøysundregistrene">
          <input inputMode="numeric" value={c.orgNumber} onChange={(e) => onOrgChange(e.target.value)} />
        </Field>
        <Field label="Firmanavn">
          <input value={c.name} onChange={set('name')} required />
        </Field>
        <label className="check">
          <input type="checkbox" checked={c.vatRegistered} onChange={(e) => setC({ ...c, vatRegistered: e.target.checked })} />
          <span>Registrert i Merverdiavgiftsregisteret</span>
        </label>
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
        <Field label="Kontonummer" hint="Kundene betaler hit">
          <input inputMode="numeric" value={c.accountNumber} onChange={set('accountNumber')} placeholder="1234.56.78903" />
        </Field>
        <div className="row">
          <Field label="E-post">
            <input type="email" value={c.email} onChange={set('email')} />
          </Field>
          <Field label="Telefon">
            <input type="tel" value={c.phone} onChange={set('phone')} />
          </Field>
        </div>
        <Field label="Betalingsfrist (dager)">
          <input inputMode="numeric" value={c.paymentTermsDays} onChange={set('paymentTermsDays')} className="short" />
        </Field>
        <ErrorBox error={error} />
        <div className="actions">
          {saved && <span className="saved">✓ Lagret</span>}
          <button type="submit">Lagre</button>
        </div>
      </form>
    </>
  );
}
