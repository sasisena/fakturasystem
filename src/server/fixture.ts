/**
 * Testdata: tømmer databasen og laster en fixture (bare i testmodus, POST /api/test/reset).
 * Alle data i fixturene er oppdiktet.
 */
import { sql } from 'drizzle-orm';
import { memberships, organizations, ROLES, users, type Role } from '@/db/schema';
import type { Tx } from './db';
import { badRequest } from './errors';

type FixtureOrg = Partial<typeof organizations.$inferInsert> & { id: string; name: string };
type FixtureUser = { id: string; email: string; name?: string; totpEnabled?: boolean; memberships?: { org: string; role: Role }[] };
export type Fixture = { organizations?: FixtureOrg[]; users?: FixtureUser[] };

const TABLES = ['audit_log', 'outbox', 'sessions', 'otp_codes', 'login_attempts', 'memberships', 'users', 'organizations'];

export async function loadFixture(tx: Tx, fixture: unknown): Promise<void> {
  const f = fixture as Fixture;
  await tx.execute(sql.raw(`TRUNCATE ${TABLES.join(', ')} CASCADE`));
  if (f.organizations?.length) await tx.insert(organizations).values(f.organizations);
  for (const u of f.users ?? []) {
    await tx.insert(users).values({ id: u.id, email: u.email.toLowerCase(), name: u.name ?? '', totpEnabled: u.totpEnabled ?? true, lastLoginAt: new Date() });
    for (const m of u.memberships ?? []) {
      if (!ROLES.includes(m.role)) throw badRequest(`Ukjent rolle i fixturen: ${m.role}`);
      await tx.insert(memberships).values({ orgId: m.org, userId: u.id, role: m.role });
    }
  }
}
