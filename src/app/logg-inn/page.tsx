import type { Metadata } from 'next';
import { PublicHeader } from '@/components/logo';
import { safeNext } from '@/lib/safe-next';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Logg inn' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ neste?: string }> }) {
  const { neste } = await searchParams;
  return (
    <>
      <PublicHeader />
      <main id="innhold" className="mx-auto max-w-md px-4 py-10">
        <h1>Logg inn</h1>
        <p className="mt-2 text-muted">Vi sender en kode til e-posten din. Er du ny, lager vi en bruker til deg.</p>
        <LoginForm next={safeNext(neste, '/app')} />
      </main>
    </>
  );
}
