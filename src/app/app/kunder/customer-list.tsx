'use client';

import { ChevronRight, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CustomerForm } from '@/components/customer-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/field';
import type { CustomerDto } from '@/server/invoicing';

export function CustomerList({ customers, canEdit }: { customers: CustomerDto[]; canEdit: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = customers.filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.orgNumber.includes(needle) || String(c.customerNumber) === needle);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Kunder</h1>
        {canEdit && !adding && <Button onClick={() => setAdding(true)}><Plus className="size-5" aria-hidden="true" /> Ny kunde</Button>}
      </div>
      {adding && (
        <Card>
          <h2 className="mb-4">Ny kunde</h2>
          <CustomerForm onSaved={(c) => router.push(`/app/kunder/${c.id}`)} onCancel={() => setAdding(false)} />
        </Card>
      )}
      {customers.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input type="search" aria-label="Søk i kunder" placeholder="Søk på navn, org.nr. eller kundenummer" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
        </div>
      )}
      {customers.length === 0 && !adding && <p className="text-muted">Du har ingen kunder ennå.</p>}
      {shown.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {shown.map((c) => (
            <li key={c.id}>
              <a href={`/app/kunder/${c.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 text-ink no-underline hover:bg-surface-2">
                <span className="tabular w-10 shrink-0 text-sm text-muted">{c.customerNumber}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.name}</span>
                  <span className="block truncate text-sm text-muted">{[c.email, c.city].filter(Boolean).join(' · ') || 'Ingen e-post'}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
