'use client';

import { useRouter } from 'next/navigation';
import { OrgForm, type OrgValues } from '@/components/org-form';
import { api } from '@/lib/api-client';

export function CompanyForm({ initial, readOnly }: { initial: OrgValues; readOnly: boolean }) {
  const router = useRouter();
  return (
    <OrgForm
      initial={initial}
      readOnly={readOnly}
      submitLabel="Lagre"
      onSubmit={async (v) => {
        const r = await api('/api/organizations/current', { method: 'PUT', body: v });
        if (r.ok) router.refresh();
        return r.ok ? { ok: true } : r;
      }}
    />
  );
}
