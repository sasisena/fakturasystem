'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/card';
import { api, errorText } from '@/lib/api-client';

export function DeleteDraft({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  async function remove() {
    if (!confirm('Slette utkastet?')) return;
    const r = await api(`/api/invoices/${id}`, { method: 'DELETE' });
    if (!r.ok) return setError(errorText(r.error));
    router.push('/app/fakturaer');
    router.refresh();
  }
  return (
    <div>
      {error && <Alert tone="danger" role="alert">{error}</Alert>}
      <Button variant="ghost" className="text-danger" onClick={remove}>Slett utkast</Button>
    </div>
  );
}
