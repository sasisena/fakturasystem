import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { requireUser } from '@/server/page-auth';
import { safeNext } from '@/lib/safe-next';
import { MfaForm } from './mfa-form';

export const metadata: Metadata = { title: 'Tofaktor' };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ neste?: string }> }) {
  const { neste } = await searchParams;
  const next = safeNext(neste, '/app');
  const u = await requireUser(`/logg-inn/tofaktor?neste=${encodeURIComponent(next)}`);
  return (
    <AuthShell>
        <MfaForm next={next} configured={u.session.user.totpEnabled} />
    </AuthShell>
  );
}
