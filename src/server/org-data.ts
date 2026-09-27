/** Lesing av organisasjonsdata fra sidene (server components), med samme RLS-omfang som API-et. */
import { eq } from 'drizzle-orm';
import { memberships, organizations, users } from '@/db/schema';
import { ROLE_LABELS } from './access';
import { scopeFor } from './context';
import { withScope, type Tx } from './db';
import type { PageUser } from './page-auth';

export async function currentOrganization(u: PageUser) {
  const orgId = u.access.require('firma:se');
  return withScope(scopeFor(u.access), async (tx) => (await tx.select().from(organizations).where(eq(organizations.id, orgId)).limit(1))[0]);
}

export type OrgRow = typeof organizations.$inferSelect;

export const orgDto = (o: OrgRow) => ({
  id: o.id,
  name: o.name,
  orgNumber: o.orgNumber,
  organizationForm: o.organizationForm,
  vatRegistered: o.vatRegistered,
  address: o.address,
  postalCode: o.postalCode,
  city: o.city,
  email: o.email,
  phone: o.phone,
  accountNumber: o.accountNumber,
  paymentTermsDays: o.paymentTermsDays,
});

/** Hva som mangler før bedriften kan sende en faktura som oppfyller bokføringsforskriften. */
export function missingForInvoicing(o: OrgRow): string[] {
  const missing: string[] = [];
  if (!o.orgNumber) missing.push('organisasjonsnummer');
  if (!o.address || !o.postalCode || !o.city) missing.push('adresse');
  if (!o.accountNumber) missing.push('kontonummer');
  return missing;
}


export type TeamMember = { userId: string; name: string; email: string; role: keyof typeof ROLE_LABELS; roleLabel: string; mfaEnabled: boolean; invited: boolean };

/** Brukerne i bedriften. Brukes av både API-et og siden «Brukere». */
export async function teamOf(tx: Tx, orgId: string): Promise<TeamMember[]> {
  const rows = await tx
    .select({ userId: users.id, name: users.name, email: users.email, role: memberships.role, mfaEnabled: users.totpEnabled, lastLoginAt: users.lastLoginAt })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.orgId, orgId))
    .orderBy(users.email);
  return rows.map(({ lastLoginAt, ...r }) => ({ ...r, roleLabel: ROLE_LABELS[r.role], invited: !lastLoginAt }));
}

export async function currentTeam(u: PageUser) {
  const orgId = u.access.require('team:se');
  return withScope(scopeFor(u.access), (tx) => teamOf(tx, orgId));
}
