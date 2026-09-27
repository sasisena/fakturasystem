'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CustomerForm } from '@/components/customer-form';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/card';
import { api, errorText } from '@/lib/api-client';
import type { CustomerDto } from '@/server/invoicing';

export function CustomerEditor({ customer, canEdit, canDelete }: { customer: CustomerDto; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    if (!confirm(`Slette ${customer.name}?`)) return;
    const r = await api(`/api/customers/${customer.id}`, { method: 'DELETE' });
    if (!r.ok) return setError(errorText(r.error));
    router.push('/app/kunder');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <CustomerForm
        initial={customer}
        readOnly={!canEdit}
        onSaved={() => {
          setSaved(true);
          router.refresh();
        }}
      />
      {saved && <Alert tone="success" role="status">Lagret.</Alert>}
      {error && <Alert tone="danger" role="alert">{error}</Alert>}
      {canDelete && <Button variant="ghost" className="self-start text-danger" onClick={remove}>Slett kunde</Button>}
    </div>
  );
}
