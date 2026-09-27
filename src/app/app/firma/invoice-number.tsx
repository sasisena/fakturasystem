'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { api, errorText } from '@/lib/api-client';

/** Neste fakturanummer. Kan bare økes, for eksempel for å fortsette serien fra et tidligere system. */
export function InvoiceNumber({ next, canEdit }: { next: number; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(next));
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await api('/api/organizations/current/invoice-number', { method: 'PUT', body: { nextInvoiceNumber: Number(value), reason } });
    if (!r.ok) return setMessage({ tone: 'danger', text: errorText(r.error) });
    setMessage({ tone: 'success', text: 'Lagret.' });
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <p>Neste faktura får nummer <strong className="tabular">{next}</strong>. Fakturaer og kreditnotaer deler nummerserien, og den får aldri hull.</p>
      {canEdit && !editing && (
        <Button variant="secondary" className="self-start" onClick={() => setEditing(true)}>Endre startnummer</Button>
      )}
      {editing && (
        <form onSubmit={save} className="flex flex-col gap-4" noValidate>
          <p className="text-sm text-muted">Nummeret kan bare økes. Bruk dette hvis du fortsetter en nummerserie fra et annet fakturaprogram.</p>
          <Field id="neste-nummer" label="Neste fakturanummer">
            <Input id="neste-nummer" inputMode="numeric" className="max-w-40" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <Field id="begrunnelse" label="Hvorfor endres det?" hint="Lagres i loggen.">
            <Input id="begrunnelse" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For eksempel: fortsetter serien fra Fiken" />
          </Field>
          <div className="flex gap-3">
            <Button type="submit">Lagre</Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>Avbryt</Button>
          </div>
        </form>
      )}
      {message && <Alert tone={message.tone} role={message.tone === 'danger' ? 'alert' : 'status'}>{message.text}</Alert>}
    </div>
  );
}
