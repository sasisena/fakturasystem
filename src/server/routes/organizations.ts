/**
 * Organisasjoner (bedriftene som bruker systemet): opprette, velge, se og endre firmaopplysninger.
 */
import { eq } from 'drizzle-orm';
import { memberships, organizations, sessions } from '@/db/schema';
import { audit } from '../audit';
import { lookupOrgNumber } from '../brreg';
import { asSystem } from '../db';
import { mfaRequired, notFound } from '../errors';
import { json, route, type Ctx } from '../router';
import { isUuid } from '../util';
import { missingForInvoicing, orgDto } from '../org-data';
import { organizationSchema, parse } from '../validation';

type OrgRow = typeof organizations.$inferSelect;

async function currentOrg(c: Ctx, orgId: string): Promise<OrgRow> {
  // RLS slipper bare gjennom organisasjonen i omfanget; filteret på id er i tillegg.
  const row = (await c.tx.select().from(organizations).where(eq(organizations.id, orgId)).limit(1))[0];
  if (!row) throw notFound();
  return row;
}

/** Oppretter en ny bedrift. Den som oppretter den, blir eier. */
route({
  method: 'POST',
  pattern: '/api/organizations',
  handler: async (c) => {
    // Er brukeren allerede med i en bedrift, må tofaktor være fullført før en ny kan opprettes.
    if (c.access.mfaMissing) throw mfaRequired();
    const input = parse(organizationSchema, await c.body());
    const org = await asSystem(c.tx, c.scope, async () => {
      const [o] = await c.tx.insert(organizations).values(input).returning();
      await c.tx.insert(memberships).values({ orgId: o.id, userId: c.userId, role: 'eier' });
      await c.tx.update(sessions).set({ orgId: o.id }).where(eq(sessions.id, c.session!.sessionId));
      await audit(c.tx, { orgId: o.id, actorId: c.userId, action: 'organisasjon_opprettet', entity: 'organization', entityId: o.id, after: { name: o.name, orgNumber: o.orgNumber } });
      return o;
    });
    return json({ ...orgDto(org), role: 'eier', mfaConfigured: c.session!.user.totpEnabled }, 201);
  },
});

/** Bedriftene brukeren er med i. */
route({
  method: 'GET',
  pattern: '/api/organizations',
  handler: async (c) => c.access.memberships.map((m) => ({ id: m.orgId, name: m.orgName, role: m.role, current: m.orgId === c.access.orgId })),
});

/** Bytter hvilken bedrift brukeren jobber i. Bedrifter brukeren ikke er med i, gir 404. */
route({
  method: 'POST',
  pattern: '/api/session/organization',
  handler: async (c) => {
    const { orgId } = await c.body();
    if (!isUuid(orgId) || !c.access.memberships.some((m) => m.orgId === orgId)) throw notFound(true);
    await c.tx.update(sessions).set({ orgId }).where(eq(sessions.id, c.session!.sessionId));
    return { ok: true, orgId };
  },
});

route({
  method: 'GET',
  pattern: '/api/organizations/current',
  handler: async (c) => {
    const org = await currentOrg(c, c.access.require('firma:se'));
    return { ...orgDto(org), role: c.access.role, missingForInvoicing: missingForInvoicing(org) };
  },
});

route({
  method: 'PUT',
  pattern: '/api/organizations/current',
  handler: async (c) => {
    const orgId = c.access.require('firma:endre');
    const before = await currentOrg(c, orgId);
    const input = parse(organizationSchema, await c.body());
    const [after] = await c.tx.update(organizations).set(input).where(eq(organizations.id, orgId)).returning();
    const changed = Object.fromEntries(Object.keys(input).filter((k) => before[k as keyof OrgRow] !== after[k as keyof OrgRow]).map((k) => [k, true]));
    await audit(c.tx, {
      orgId, actorId: c.userId, action: 'firma_endret', entity: 'organization', entityId: orgId,
      before: Object.fromEntries(Object.keys(changed).map((k) => [k, before[k as keyof OrgRow]])),
      after: Object.fromEntries(Object.keys(changed).map((k) => [k, after[k as keyof OrgRow]])),
    });
    return { ...orgDto(after), role: c.access.role, missingForInvoicing: missingForInvoicing(after) };
  },
});

/** Oppslag i Enhetsregisteret, for å fylle ut navn og adresse. */
route({
  method: 'GET',
  pattern: '/api/lookup/:orgNumber',
  handler: async (c) => {
    const entity = await lookupOrgNumber(c.params.orgNumber).catch(() => null);
    if (!entity) throw notFound();
    return entity;
  },
});
