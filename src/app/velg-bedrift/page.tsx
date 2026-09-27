import type { Metadata } from 'next';
import { PublicHeader } from '@/components/logo';
import { ROLE_LABELS } from '@/server/access';
import { requireUser } from '@/server/page-auth';
import { ChooseOrg } from './choose-org';

export const metadata: Metadata = { title: 'Velg bedrift' };

export default async function ChooseOrgPage() {
  const u = await requireUser('/velg-bedrift');
  const orgs = u.access.memberships.map((m) => ({ id: m.orgId, name: m.orgName, role: ROLE_LABELS[m.role] }));
  return (
    <>
      <PublicHeader />
      <main id="innhold" className="mx-auto max-w-xl px-4 py-10">
        <h1>Velg bedrift</h1>
        <p className="mt-2 mb-6 text-muted">Du har tilgang til flere bedrifter. Hvilken vil du jobbe i nå?</p>
        <ChooseOrg orgs={orgs} />
        <p className="mt-6"><a href="/kom-i-gang">Registrer en ny bedrift</a></p>
      </main>
    </>
  );
}
