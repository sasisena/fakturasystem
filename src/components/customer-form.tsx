'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/card';
import { Field, Input, describedBy } from '@/components/ui/field';
import { api, errorText } from '@/lib/api-client';
import { isValidOrgNumber } from '@/lib/faktura';
import type { CustomerDto } from '@/server/invoicing';

type Values = Omit<CustomerDto, 'id' | 'customerNumber'>;
const EMPTY: Values = { name: '', orgNumber: '', email: '', phone: '', address: '', postalCode: '', city: '' };

/**
 * Kundeskjema. Er kunden en bedrift, fylles navn og adresse ut fra Brønnøysundregistrene når
 * organisasjonsnummeret er gyldig. Brukes på kundesidene og direkte fra fakturaskjemaet.
 */
export function CustomerForm({ initial, onSaved, onCancel, submitLabel, readOnly = false }: {
  initial?: CustomerDto;
  onSaved: (c: CustomerDto) => void;
  onCancel?: () => void;
  submitLabel?: string;
  readOnly?: boolean;
}) {
  const [v, setV] = useState<Values>(initial ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function onOrgNumber(value: string) {
    setV((p) => ({ ...p, orgNumber: value }));
    const digits = value.replace(/\s/g, '');
    if (!isValidOrgNumber(digits)) return;
    const r = await api<{ name: string; address: string; postalCode: string; city: string }>(`/api/lookup/${digits}`);
    if (r.ok) setV((p) => ({ ...p, name: p.name || r.data.name, address: r.data.address, postalCode: r.data.postalCode, city: r.data.city }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage('');
    const r = initial
      ? await api<CustomerDto>(`/api/customers/${initial.id}`, { method: 'PUT', body: v })
      : await api<CustomerDto>('/api/customers', { body: v });
    setBusy(false);
    if (r.ok) return onSaved(r.data);
    setErrors(Object.fromEntries((r.error.errors ?? []).map((x) => [x.field, x.message])));
    setMessage(errorText(r.error));
  }

  const input = (id: keyof Values, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <Field id={`kunde-${id}`} label={label} hint={hint} error={errors[id]}>
      <Input
        id={`kunde-${id}`}
        value={v[id]}
        onChange={(e) => setV({ ...v, [id]: e.target.value })}
        aria-invalid={!!errors[id]}
        aria-describedby={describedBy(`kunde-${id}`, hint, errors[id])}
        disabled={readOnly}
        {...props}
      />
    </Field>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {input('orgNumber', 'Organisasjonsnummer', { inputMode: 'numeric', autoComplete: 'off', placeholder: 'Bare for bedrifter', onChange: (e) => onOrgNumber(e.target.value) }, 'Navn og adresse fylles ut automatisk.')}
      {input('name', 'Navn', { autoComplete: 'off' })}
      {input('email', 'E-post', { type: 'email', inputMode: 'email', autoComplete: 'off' }, 'Fakturaen sendes hit.')}
      {input('address', 'Adresse', { autoComplete: 'off' })}
      <div className="grid grid-cols-[8rem_1fr] gap-3">
        {input('postalCode', 'Postnummer', { inputMode: 'numeric', autoComplete: 'off' })}
        {input('city', 'Sted', { autoComplete: 'off' })}
      </div>
      {input('phone', 'Telefon', { type: 'tel', autoComplete: 'off' })}
      {message && <Alert tone="danger" role="alert">{message}</Alert>}
      {!readOnly && (
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy}>{busy ? 'Lagrer …' : (submitLabel ?? (initial ? 'Lagre' : 'Legg til kunde'))}</Button>
          {onCancel && <Button variant="secondary" onClick={onCancel}>Avbryt</Button>}
        </div>
      )}
    </form>
  );
}
