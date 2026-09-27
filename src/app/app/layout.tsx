import type { ReactNode } from 'react';
import { AppNav } from '@/components/app-nav';
import { ROLE_LABELS } from '@/server/access';
import { requireOrg } from '@/server/page-auth';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const u = await requireOrg('/app');
  const current = u.access.memberships.find((m) => m.orgId === u.access.orgId)!;
  return (
    <div className="md:flex">
      <AppNav
        orgName={current.orgName}
        roleLabel={ROLE_LABELS[current.role]}
        email={u.session.user.email}
        canSeeLog={u.access.can('logg:se')}
        manyOrgs={u.access.memberships.length > 1}
      />
      <main id="innhold" className="mx-auto w-full max-w-4xl px-4 pt-6 pb-28 md:px-8 md:pb-12">{children}</main>
    </div>
  );
}
