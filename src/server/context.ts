/** Bygger tilgangsbildet (organisasjoner og roller) for en innlogget bruker. */
import { eq } from 'drizzle-orm';
import { memberships, organizations } from '@/db/schema';
import { Access } from './access';
import type { DbScope, Q } from './db';

/** Må kjøres i systemmodus: leser medlemskap på tvers av organisasjoner for denne ene brukeren. */
export async function loadAccess(db: Q, userId: string, orgId: string | null, mfa: boolean): Promise<Access> {
  const rows = await db
    .select({ orgId: memberships.orgId, role: memberships.role, orgName: organizations.name })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(eq(memberships.userId, userId))
    .orderBy(organizations.name);
  // Er brukeren bare med i én organisasjon, er den valgt automatisk.
  const current = rows.some((r) => r.orgId === orgId) ? orgId : rows.length === 1 ? rows[0].orgId : null;
  return new Access(userId, rows, current, mfa);
}

/** RLS-omfanget: bare den valgte organisasjonen, og bare når tofaktor er fullført. */
export function scopeFor(access: Access | null): DbScope {
  if (!access || access.mfaMissing) return { mode: 'scoped', org: null };
  return { mode: 'scoped', org: access.orgId };
}
