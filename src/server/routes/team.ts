/**
 * Brukerne i en bedrift: se, invitere, endre rolle og fjerne.
 * Bare eiere kan gi eller ta fra eierrollen, og en bedrift har alltid minst én eier.
 */
import { and, desc, eq } from 'drizzle-orm';
import { auditLog, memberships, organizations, users, type Role } from '@/db/schema';
import { ROLE_LABELS } from '../access';
import { audit } from '../audit';
import { config } from '../env';
import { conflict, notFound } from '../errors';
import { enqueue } from '../messaging';
import { teamOf } from '../org-data';
import { json, route, type Ctx } from '../router';
import { isUuid } from '../util';
import { inviteSchema, parse, roleSchema } from '../validation';

async function memberOf(c: Ctx, orgId: string, userId: string) {
  if (!isUuid(userId)) throw notFound();
  const m = (await c.tx.select().from(memberships).where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId))).limit(1))[0];
  if (!m) throw notFound(true);
  return m;
}

async function ownerCount(c: Ctx, orgId: string) {
  const rows = await c.tx.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.orgId, orgId), eq(memberships.role, 'eier')));
  return rows.length;
}

const lastOwner = () => conflict('siste_eier', 'Bedriften må ha minst én eier. Gjør en annen til eier først.');

route({
  method: 'GET',
  pattern: '/api/team',
  handler: async (c) => teamOf(c.tx, c.access.require('team:se')),
});

route({
  method: 'POST',
  pattern: '/api/team',
  handler: async (c) => {
    const orgId = c.access.require('team:endre');
    const { email, role } = parse(inviteSchema, await c.body());
    if (role === 'eier') c.access.require('eiere:endre');
    let user = (await c.tx.select().from(users).where(eq(users.email, email)).limit(1))[0];
    if (!user) user = (await c.tx.insert(users).values({ email }).returning())[0];
    const existing = await c.tx.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.orgId, orgId), eq(memberships.userId, user.id)));
    if (existing.length) throw conflict('allerede_medlem', 'Denne personen har allerede tilgang til bedriften.');
    await c.tx.insert(memberships).values({ orgId, userId: user.id, role, invitedBy: c.userId });
    const org = (await c.tx.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId)))[0];
    const url = config.appUrl || c.origin;
    await enqueue(c.tx, {
      channel: 'email',
      orgId,
      to: email,
      subject: `Du har fått tilgang til ${org.name} i Fakturasystem`,
      body: `Hei!\n\n${c.session!.user.email} har gitt deg tilgang til ${org.name} i Fakturasystem med rollen ${ROLE_LABELS[role].toLowerCase()}.\n\nLogg inn med denne e-postadressen på ${url}/logg-inn. Første gang setter du opp tofaktor med en autentiseringsapp på telefonen.`,
    });
    await audit(c.tx, { orgId, actorId: c.userId, action: 'medlem_invitert', entity: 'user', entityId: user.id, after: { role } });
    return json({ userId: user.id, email, role }, 201);
  },
});

route({
  method: 'PATCH',
  pattern: '/api/team/:id',
  handler: async (c) => {
    const orgId = c.access.require('team:endre');
    const m = await memberOf(c, orgId, c.params.id);
    const { role } = parse(roleSchema, await c.body());
    if (role === m.role) return { userId: m.userId, role };
    if (role === 'eier' || m.role === 'eier') c.access.require('eiere:endre');
    if (m.role === 'eier' && (await ownerCount(c, orgId)) <= 1) throw lastOwner();
    await c.tx.update(memberships).set({ role: role as Role }).where(eq(memberships.id, m.id));
    await audit(c.tx, { orgId, actorId: c.userId, action: 'rolle_endret', entity: 'user', entityId: m.userId, before: { role: m.role }, after: { role } });
    return { userId: m.userId, role };
  },
});

route({
  method: 'DELETE',
  pattern: '/api/team/:id',
  handler: async (c) => {
    const orgId = c.access.require('team:se');
    const m = await memberOf(c, orgId, c.params.id);
    // Alle kan fjerne seg selv; andre krever team:endre (og eiere:endre for å fjerne en eier).
    if (m.userId !== c.userId) {
      c.access.require('team:endre');
      if (m.role === 'eier') c.access.require('eiere:endre');
    }
    if (m.role === 'eier' && (await ownerCount(c, orgId)) <= 1) throw lastOwner();
    await c.tx.delete(memberships).where(eq(memberships.id, m.id));
    await audit(c.tx, { orgId, actorId: c.userId, action: 'medlem_fjernet', entity: 'user', entityId: m.userId, before: { role: m.role } });
    return json(null, 204);
  },
});

route({
  method: 'GET',
  pattern: '/api/audit-log',
  handler: async (c) => {
    const orgId = c.access.require('logg:se');
    const rows = await c.tx
      .select({ at: auditLog.at, action: auditLog.action, entity: auditLog.entity, entityId: auditLog.entityId, actorEmail: users.email, before: auditLog.before, after: auditLog.after })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorId))
      .where(eq(auditLog.orgId, orgId))
      .orderBy(desc(auditLog.seq))
      .limit(200);
    return rows;
  },
});
