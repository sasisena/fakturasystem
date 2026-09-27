'use client';

import { CheckCircle2, FileMinus, Mail, RotateCcw, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Card } from '@/components/ui/card';
import { api, errorText, type ApiErrorBody } from '@/lib/api-client';

type Props = {
  id: string;
  kind: string;
  status: string;
  customerEmail: string;
  missing: string[];
  canEdit: boolean;
};

/**
 * Handlingene på en faktura. Utsending og kreditering bekreftes i en egen boks, fordi de ikke kan
 * angres: fakturaen låses og får nummer.
 */
export function InvoiceActions({ id, kind, status, customerEmail, missing, canEdit }: Props) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<'send' | 'credit' | null>(null);
  const [delivery, setDelivery] = useState<'epost' | 'manuell'>(customerEmail ? 'epost' : 'manuell');
  const [error, setError] = useState<ApiErrorBody | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canEdit || kind !== 'faktura' || status === 'kreditert') return null;

  async function run(path: string, body: unknown, goTo?: (data: { id: string }) => string) {
    setBusy(true);
    setError(null);
    const r = await api<{ id: string }>(`/api/invoices/${id}/${path}`, { body });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setConfirm(null);
    if (goTo) router.push(goTo(r.data));
    router.refresh();
  }

  const errorBox = error && (
    <Alert tone="danger" role="alert">
      {errorText(error)}
      {error.code === 'mangler_firmaopplysninger' && <> <a href="/app/firma">Gå til Firma</a></>}
    </Alert>
  );

  if (status === 'utkast') {
    return (
      <Card className="flex flex-col gap-4">
        <h2>Send fakturaen</h2>
        {missing.length > 0 ? (
          <Alert tone="warning">
            Før du kan sende, må du fylle ut {missing.join(', ')} under <a href="/app/firma">Firma</a>.
          </Alert>
        ) : (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">Hvordan skal kunden få den?</legend>
              <label className={`flex items-start gap-3 rounded-md border p-3 ${delivery === 'epost' ? 'border-primary bg-primary-soft' : 'border-border'} ${customerEmail ? '' : 'opacity-60'}`}>
                <input type="radio" name="levering" className="mt-1 size-5 accent-[var(--color-primary)]" checked={delivery === 'epost'} disabled={!customerEmail} onChange={() => setDelivery('epost')} />
                <span>
                  <span className="block font-semibold">Send på e-post</span>
                  <span className="text-sm text-muted">{customerEmail ? `Til ${customerEmail}, med PDF-en som vedlegg.` : 'Kunden har ingen e-postadresse.'}</span>
                </span>
              </label>
              <label className={`flex items-start gap-3 rounded-md border p-3 ${delivery === 'manuell' ? 'border-primary bg-primary-soft' : 'border-border'}`}>
                <input type="radio" name="levering" className="mt-1 size-5 accent-[var(--color-primary)]" checked={delivery === 'manuell'} onChange={() => setDelivery('manuell')} />
                <span>
                  <span className="block font-semibold">Jeg sender den selv</span>
                  <span className="text-sm text-muted">Fakturaen får nummer og KID, og du laster ned PDF-en.</span>
                </span>
              </label>
            </fieldset>
            {confirm === 'send' ? (
              <Alert tone="warning">
                <p className="font-semibold">Når fakturaen er sendt, kan den ikke endres eller slettes.</p>
                <p className="mt-1">Er noe feil etterpå, lager du en kreditnota. Vil du sende nå?</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button disabled={busy} onClick={() => run('send', { delivery })}>
                    {delivery === 'epost' ? <Mail className="size-5" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />}
                    {busy ? 'Sender …' : 'Ja, send fakturaen'}
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirm(null)}>Avbryt</Button>
                </div>
              </Alert>
            ) : (
              <Button onClick={() => setConfirm('send')}>
                <Send className="size-5" aria-hidden="true" /> {delivery === 'epost' ? 'Send på e-post' : 'Lag ferdig faktura'}
              </Button>
            )}
          </>
        )}
        {errorBox}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {status === 'sendt' && (
          <Button variant="primary" className="bg-success" disabled={busy} onClick={() => run('mark-paid', {})}>
            <CheckCircle2 className="size-5" aria-hidden="true" /> Merk som betalt
          </Button>
        )}
        {status === 'betalt' && (
          <Button variant="secondary" disabled={busy} onClick={() => run('mark-unpaid', {})}>
            <RotateCcw className="size-5" aria-hidden="true" /> Angre betalt
          </Button>
        )}
        {confirm !== 'credit' && (
          <Button variant="ghost" className="text-danger" onClick={() => setConfirm('credit')}>
            <FileMinus className="size-5" aria-hidden="true" /> Krediter
          </Button>
        )}
      </div>
      {confirm === 'credit' && (
        <Alert tone="warning">
          <p className="font-semibold">Lage en kreditnota som nuller ut hele fakturaen?</p>
          <p className="mt-1">
            Kreditnotaen får neste fakturanummer{customerEmail ? ` og sendes til ${customerEmail}` : ''}. Dette kan ikke angres.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button variant="danger" disabled={busy} onClick={() => run('credit', { delivery: customerEmail ? 'epost' : 'manuell' }, (d) => `/app/fakturaer/${d.id}`)}>
              {busy ? 'Lager …' : 'Ja, krediter'}
            </Button>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Avbryt</Button>
          </div>
        </Alert>
      )}
      {errorBox}
    </div>
  );
}
