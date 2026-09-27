import { desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { auditLog, users } from '@/db/schema';
import { scopeFor } from '@/server/context';
import { withScope } from '@/server/db';
import { requireOrg } from '@/server/page-auth';

export const metadata: Metadata = { title: 'Logg' };

const ACTION_LABELS: Record<string, string> = {
  organisasjon_opprettet: 'Registrerte bedriften',
  innlogging: 'Logget inn',
  firma_endret: 'Endret firmaopplysninger',
  medlem_invitert: 'Ga en person tilgang',
  rolle_endret: 'Endret rolle',
  medlem_fjernet: 'Fjernet tilgang',
  tilgang_nektet: 'Forsøk uten tilgang',
};

const fmt = new Intl.DateTimeFormat('nb-NO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Oslo' });

export default async function LogPage() {
  const u = await requireOrg('/app/logg');
  if (!u.access.can('logg:se')) redirect('/app');
  const orgId = u.access.orgId!;
  const rows = await withScope(scopeFor(u.access), (tx) =>
    tx
      .select({ seq: auditLog.seq, at: auditLog.at, action: auditLog.action, actor: users.email })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorId))
      .where(eq(auditLog.orgId, orgId))
      .orderBy(desc(auditLog.seq))
      .limit(200),
  );
  return (
    <div className="flex flex-col gap-6">
      <h1>Logg</h1>
      <p className="text-muted">Alle endringer i bedriften blir logget, med hvem som gjorde dem og når.</p>
      <Card className="p-0 md:p-0">
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.seq} className="flex flex-col gap-0.5 p-4 sm:flex-row sm:justify-between">
              <span className="font-semibold">{ACTION_LABELS[r.action] ?? r.action}</span>
              <span className="text-sm text-muted">{r.actor ?? 'Systemet'} · {fmt.format(r.at)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
