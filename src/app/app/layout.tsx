import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-nav';
import { ROLE_LABELS } from '@/server/access';
import { requireOrg } from '@/server/page-auth';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const u = await requireOrg('/app');
  const current = u.access.memberships.find((m) => m.orgId === u.access.orgId)!;
  return (
    <AppShell
      orgName={current.orgName}
      roleLabel={ROLE_LABELS[current.role]}
      email={u.session.user.email}
      userName={u.session.user.name ?? null}
      canSeeLog={u.access.can('logg:se')}
      canInvoice={u.access.can('faktura:endre')}
      manyOrgs={u.access.memberships.length > 1}
    >
      {children}
    </AppShell>
  );
}
