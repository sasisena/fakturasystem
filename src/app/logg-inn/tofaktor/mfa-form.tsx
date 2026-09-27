'use client';

import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { api, errorText } from '@/lib/api-client';

export function MfaForm({ next, configured }: { next: string; configured: boolean }) {
  const router = useRouter();
  const [secret, setSecret] = useState<{ secret: string; otpauthUri: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (configured) return;
    api<{ secret: string; otpauthUri: string }>('/api/auth/mfa/setup', { method: 'POST' }).then(async (r) => {
      if (!r.ok) return setError(errorText(r.error));
      setSecret({ ...r.data, qr: await QRCode.toDataURL(r.data.otpauthUri, { margin: 1, width: 200 }) });
    });
  }, [configured]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await api('/api/auth/mfa/verify', { body: { code: code.trim() } });
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    router.push(next);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1>{configured ? 'Bekreft innloggingen' : 'Sett opp tofaktor'}</h1>
      <p className="text-muted">
        {configured
          ? 'Skriv inn de seks sifrene fra autentiseringsappen på telefonen.'
          : 'Fakturaer og kundeopplysninger skal være godt beskyttet. Skann koden med en autentiseringsapp, for eksempel Google Authenticator eller Microsoft Authenticator, og skriv inn de seks sifrene appen viser.'}
      </p>
      {error && <Alert tone="danger" role="alert">{error}</Alert>}
      {secret && (
        <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-surface p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={secret.qr} alt="QR-kode for autentiseringsappen" width={200} height={200} />
          <p className="text-sm text-muted">Kan du ikke skanne? Skriv inn denne nøkkelen i appen:</p>
          <p className="font-mono text-lg break-all">{secret.secret.match(/.{1,4}/g)?.join(' ')}</p>
          <a href={secret.otpauthUri} className="text-sm">Åpne i autentiseringsappen på denne enheten</a>
        </div>
      )}
      <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
        <Field id="mfa-code" label="Kode fra appen">
          <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy}>{busy ? 'Sjekker …' : 'Bekreft'}</Button>
      </form>
    </div>
  );
}
