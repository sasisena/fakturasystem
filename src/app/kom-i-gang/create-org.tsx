'use client';

import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/card';
import { EMPTY_ORG, OrgForm } from '@/components/org-form';
import { api } from '@/lib/api-client';

export function CreateOrg({ needsMfa }: { needsMfa: boolean }) {
  const router = useRouter();
  if (needsMfa) {
    return <Alert tone="info">Bekreft innloggingen med tofaktor før du registrerer en ny bedrift. <a href="/logg-inn/tofaktor?neste=/kom-i-gang">Gå til tofaktor</a></Alert>;
  }
  return (
    <OrgForm
      initial={EMPTY_ORG}
      submitLabel="Registrer bedriften"
      onSubmit={async (v) => {
        const r = await api('/api/organizations', { body: v });
        if (!r.ok) return r;
        // Tofaktor settes opp rett etter registreringen, før brukeren kommer inn i appen.
        router.push('/logg-inn/tofaktor?neste=/app');
        router.refresh();
        return { ok: true };
      }}
    />
  );
}
