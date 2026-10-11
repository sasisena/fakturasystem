import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { requireUser } from '@/server/page-auth';
import { CreateOrg } from './create-org';

export const metadata: Metadata = { title: 'Kom i gang' };

export default async function GetStarted() {
  const u = await requireUser('/kom-i-gang');
  return (
    <AuthShell>
        <h1>Registrer bedriften din</h1>
        <p className="mt-2 mb-6 text-muted">
          Start med organisasjonsnummeret, så fyller vi ut resten. Du kan endre alt senere.
        </p>
        <CreateOrg needsMfa={u.access.mfaMissing} />
    </AuthShell>
  );
}
