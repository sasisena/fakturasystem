'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { api, errorText } from '@/lib/api-client';

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Skriv en gyldig e-postadresse, for eksempel navn@eksempel.no.');
    setBusy(true);
    await api('/api/auth/otp/request', { body: { email: email.trim() } });
    setBusy(false);
    setSent(true);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const r = await api<{ requiresMfa: boolean; hasOrganization: boolean }>('/api/auth/otp/verify', { body: { email: email.trim(), code: code.trim() } });
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    if (!r.data.hasOrganization) router.push('/kom-i-gang');
    else if (r.data.requiresMfa) router.push(`/logg-inn/tofaktor?neste=${encodeURIComponent(next)}`);
    else router.push(next);
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {error && <Alert tone="danger" role="alert">{error}</Alert>}
      {!sent ? (
        <form onSubmit={send} className="flex flex-col gap-4" noValidate>
          <Field id="login-email" label="E-post">
            <Input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Button type="submit" disabled={busy}>{busy ? 'Sender …' : 'Send kode'}</Button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
          <Alert tone="info">Vi har sendt en kode til {email}. Den gjelder i 10 minutter.</Alert>
          <Field id="login-code" label="Kode fra e-posten">
            <Input id="login-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Button type="submit" disabled={busy}>{busy ? 'Sjekker …' : 'Logg inn'}</Button>
          <Button variant="ghost" onClick={() => { setSent(false); setCode(''); }}>Send ny kode</Button>
        </form>
      )}
    </div>
  );
}
