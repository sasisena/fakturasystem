'use client';

import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

export function ChooseOrg({ orgs }: { orgs: { id: string; name: string; role: string }[] }) {
  const router = useRouter();
  async function choose(orgId: string) {
    const r = await api('/api/session/organization', { body: { orgId } });
    if (r.ok) {
      router.push('/app');
      router.refresh();
    }
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {orgs.map((o) => (
        <li key={o.id}>
          <button type="button" onClick={() => choose(o.id)} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2">
            <span>
              <span className="block font-semibold">{o.name}</span>
              <span className="text-sm text-muted">{o.role}</span>
            </span>
            <ChevronRight className="size-5 text-muted" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
