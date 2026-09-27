'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import { api, errorText } from '@/lib/api-client';

import type { TeamMember as Member } from '@/server/org-data';

const ROLE_HELP: Record<string, string> = {
  eier: 'Alt, også å gi andre eierrollen.',
  administrator: 'Alt unntatt å endre eiere.',
  fakturering: 'Lage og sende fakturaer og holde kundelisten.',
  lesetilgang: 'Se alt uten å endre noe. Passer for regnskapsfører.',
};

export function Team({ members, me, canEdit, canEditOwners, roleLabels }: { members: Member[]; me: string; canEdit: boolean; canEditOwners: boolean; roleLabels: Record<string, string> }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('lesetilgang');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => router.refresh();

  const roles = Object.keys(roleLabels).filter((r) => canEditOwners || r !== 'eier');

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const r = await api('/api/team', { body: { email, role } });
    setBusy(false);
    if (!r.ok) return setMessage({ tone: 'danger', text: errorText(r.error) });
    setMessage({ tone: 'success', text: `${email} har fått tilgang og en e-post med beskjed om hvordan de logger inn.` });
    setEmail('');
    load();
  }

  async function changeRole(userId: string, newRole: string) {
    setMessage(null);
    const r = await api(`/api/team/${userId}`, { method: 'PATCH', body: { role: newRole } });
    if (!r.ok) setMessage({ tone: 'danger', text: errorText(r.error) });
    load();
  }

  async function remove(m: Member) {
    const self = m.userId === me;
    if (!confirm(self ? 'Vil du fjerne din egen tilgang til bedriften?' : `Fjerne tilgangen til ${m.email}?`)) return;
    const r = await api(`/api/team/${m.userId}`, { method: 'DELETE' });
    if (!r.ok) return setMessage({ tone: 'danger', text: errorText(r.error) });
    if (self) {
      router.push('/');
      router.refresh();
    } else load();
  }

  return (
    <>
      {message && <Alert tone={message.tone} role={message.tone === 'danger' ? 'alert' : 'status'}>{message.text}</Alert>}
      <Card className="p-0 md:p-0">
        <ul className="divide-y divide-border">
          {members.map((m) => {
            const editable = canEdit && (canEditOwners || m.role !== 'eier');
            return (
              <li key={m.userId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{m.name || m.email}{m.userId === me && ' (deg)'}</p>
                  {m.name && <p className="truncate text-sm text-muted">{m.email}</p>}
                  <div className="mt-1 flex flex-wrap gap-2">
                    {m.invited ? <Badge tone="warning">Invitert</Badge> : m.mfaEnabled && <Badge tone="success">Tofaktor på</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editable ? (
                    <Select aria-label={`Rolle for ${m.email}`} value={m.role} onChange={(e) => changeRole(m.userId, e.target.value)} className="w-auto">
                      {(canEditOwners ? Object.keys(roleLabels) : roles).map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
                    </Select>
                  ) : (
                    <Badge tone="neutral">{m.roleLabel}</Badge>
                  )}
                  {(editable || m.userId === me) && (
                    <Button variant="ghost" size="sm" onClick={() => remove(m)}>Fjern</Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {canEdit && (
        <Card>
          <h2 className="mb-4">Gi en person tilgang</h2>
          <form onSubmit={invite} className="flex flex-col gap-4" noValidate>
            <Field id="invite-email" label="E-post">
              <Input id="invite-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field id="invite-role" label="Rolle" hint={ROLE_HELP[role]}>
              <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)}>
                {roles.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
              </Select>
            </Field>
            <Button type="submit" disabled={busy || !email}>{busy ? 'Sender …' : 'Gi tilgang'}</Button>
          </form>
        </Card>
      )}
    </>
  );
}
