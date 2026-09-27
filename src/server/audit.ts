/**
 * Revisjonslogg for endringer, innlogging og nektede forsøk.
 * Loggen inneholder id-er og endrede felt, ikke hele personopplysninger i fritekst.
 */
import { auditLog } from '@/db/schema';
import { now } from './clock';
import type { Q } from './db';

export const AUDIT_ACTIONS = [
  'tilgang_nektet', 'innlogging', 'organisasjon_opprettet', 'firma_endret', 'medlem_invitert', 'rolle_endret',
  'medlem_fjernet', 'organisasjon_valgt',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export async function audit(
  db: Q,
  e: { orgId: string | null; actorId: string | null; action: AuditAction; entity: string; entityId?: string | null; before?: unknown; after?: unknown },
) {
  await db.insert(auditLog).values({
    at: now(),
    orgId: e.orgId,
    actorId: e.actorId,
    action: e.action,
    entity: e.entity,
    entityId: e.entityId ?? null,
    before: (e.before ?? null) as never,
    after: (e.after ?? null) as never,
  });
}
