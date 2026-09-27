'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/card';
import { Field, Input, describedBy } from '@/components/ui/field';
import { api, errorText, type ApiErrorBody } from '@/lib/api-client';
import { isValidOrgNumber } from '@/lib/faktura';

export type OrgValues = {
  name: string;
  orgNumber: string;
  organizationForm: string;
  vatRegistered: boolean;
  address: string;
  postalCode: string;
  city: string;
  email: string;
  phone: string;
  accountNumber: string;
  paymentTermsDays: number | string;
};

export const EMPTY_ORG: OrgValues = {
  name: '', orgNumber: '', organizationForm: '', vatRegistered: false, address: '', postalCode: '', city: '',
  email: '', phone: '', accountNumber: '', paymentTermsDays: 14,
};

type Lookup = { name: string; organizationForm: string; address: string; postalCode: string; city: string; vatRegistered: boolean };

/**
 * Firmaopplysninger. Når organisasjonsnummeret er gyldig, hentes navn, adresse og mva-status
 * fra Enhetsregisteret. Brukes både ved registrering og under «Firma».
 */
export function OrgForm({ initial, submitLabel, onSubmit, readOnly = false }: {
  initial: OrgValues;
  submitLabel: string;
  onSubmit: (v: OrgValues) => Promise<{ ok: true } | { ok: false; error: ApiErrorBody }>;
  readOnly?: boolean;
}) {
  const [v, setV] = useState<OrgValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<string | null>(null);

  const set = (k: keyof OrgValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(null);
    setV((prev) => ({ ...prev, [k]: e.target.value }));
  };

  async function onOrgNumber(value: string) {
    setV((prev) => ({ ...prev, orgNumber: value }));
    setFound(null);
    const digits = value.replace(/\s/g, '');
    if (!isValidOrgNumber(digits)) return;
    const r = await api<Lookup>(`/api/lookup/${digits}`);
    if (!r.ok) return;
    setFound(r.data.name);
    setV((prev) => ({ ...prev, name: r.data.name, organizationForm: r.data.organizationForm, address: r.data.address, postalCode: r.data.postalCode, city: r.data.city, vatRegistered: r.data.vatRegistered }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);
    const r = await onSubmit({ ...v, paymentTermsDays: Number(v.paymentTermsDays) });
    setBusy(false);
    if (r.ok) return setMessage({ tone: 'success', text: 'Lagret.' });
    setErrors(Object.fromEntries((r.error.errors ?? []).map((x) => [x.field, x.message])));
    setMessage({ tone: 'danger', text: errorText(r.error) });
  }

  const input = (id: keyof OrgValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <Field id={`org-${id}`} label={label} hint={hint} error={errors[id]}>
      <Input
        id={`org-${id}`}
        value={String(v[id] ?? '')}
        onChange={set(id)}
        aria-invalid={!!errors[id]}
        aria-describedby={describedBy(`org-${id}`, hint, errors[id])}
        disabled={readOnly}
        {...props}
      />
    </Field>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <Field id="org-orgNumber" label="Organisasjonsnummer" hint={found ? `Fant ${found} i Brønnøysundregistrene.` : 'Vi henter navn, adresse og mva-status automatisk.'} error={errors.orgNumber}>
        <Input
          id="org-orgNumber"
          inputMode="numeric"
          autoComplete="off"
          value={v.orgNumber}
          onChange={(e) => onOrgNumber(e.target.value)}
          aria-invalid={!!errors.orgNumber}
          aria-describedby={describedBy('org-orgNumber', true, errors.orgNumber)}
          disabled={readOnly}
          placeholder="9 siffer"
        />
      </Field>
      {input('name', 'Navn på bedriften', { required: true, autoComplete: 'organization' })}
      <label className="flex items-center gap-3">
        <input type="checkbox" className="size-5 accent-[var(--color-primary)]" checked={v.vatRegistered} disabled={readOnly} onChange={(e) => setV({ ...v, vatRegistered: e.target.checked })} />
        <span>Registrert i Merverdiavgiftsregisteret (mva)</span>
      </label>
      {input('address', 'Adresse', { autoComplete: 'street-address' })}
      <div className="grid grid-cols-[8rem_1fr] gap-3">
        {input('postalCode', 'Postnummer', { inputMode: 'numeric', autoComplete: 'postal-code' })}
        {input('city', 'Sted', { autoComplete: 'address-level2' })}
      </div>
      {input('accountNumber', 'Kontonummer', { inputMode: 'numeric', placeholder: '1234.56.78903' }, 'Kundene betaler til dette kontoet.')}
      <div className="grid gap-3 sm:grid-cols-2">
        {input('email', 'E-post', { type: 'email', autoComplete: 'email' })}
        {input('phone', 'Telefon', { type: 'tel', autoComplete: 'tel' })}
      </div>
      {input('paymentTermsDays', 'Betalingsfrist (dager)', { inputMode: 'numeric', className: 'max-w-32' })}
      {message && <Alert tone={message.tone} role={message.tone === 'danger' ? 'alert' : 'status'}>{message.text}</Alert>}
      {!readOnly && <Button type="submit" disabled={busy}>{busy ? 'Lagrer …' : submitLabel}</Button>}
    </form>
  );
}
