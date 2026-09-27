import type { Metadata } from 'next';
import { PublicHeader } from '@/components/logo';
import { requireUser } from '@/server/page-auth';
import { safeNext } from '@/lib/safe-next';
import { MfaForm } from './mfa-form';

export const metadata: Metadata = { title: 'Tofaktor' };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ neste?: string }> }) {
  const { neste } = await searchParams;
  const next = safeNext(neste, '/app');
  const u = await requireUser(`/logg-inn/tofaktor?neste=${encodeURIComponent(next)}`);
  return (
    <>
      <PublicHeader />
      <main id="innhold" className="mx-auto max-w-md px-4 py-10">
        <MfaForm next={next} configured={u.session.user.totpEnabled} />
      </main>
    </>
  );
}
