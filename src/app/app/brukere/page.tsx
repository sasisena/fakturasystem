import type { Metadata } from 'next';
import { ROLE_LABELS } from '@/server/access';
import { currentTeam } from '@/server/org-data';
import { requireOrg } from '@/server/page-auth';
import { Team } from './team';

export const metadata: Metadata = { title: 'Brukere' };

export default async function UsersPage() {
  const u = await requireOrg('/app/brukere');
  return (
    <div className="flex flex-col gap-6">
      <h1>Brukere</h1>
      <p className="text-muted">Gi regnskapsfører eller kolleger tilgang til bedriften. De logger inn med sin egen e-postadresse.</p>
      <Team
        members={await currentTeam(u)}
        me={u.session.user.id}
        canEdit={u.access.can('team:endre')}
        canEditOwners={u.access.can('eiere:endre')}
        roleLabels={ROLE_LABELS}
      />
    </div>
  );
}
