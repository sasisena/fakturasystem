/** Testmodus (testkontrakten, avsnitt 1). Rutene finnes bare når FAKTURA_TEST_MODE=true. */
import { asc, eq } from 'drizzle-orm';
import { outbox, users } from '@/db/schema';
import { DEFAULT_TEST_NOW, setClock } from '../clock';
import { loadAccess } from '../context';
import { badRequest, notFound } from '../errors';
import { loadFixture } from '../fixture';
import { runJobs } from '../jobs';
import { json, route } from '../router';
import { createSession, setSessionCookies } from '../session';
import { isUuid } from '../util';

const T = { auth: 'none' as const, csrf: false, test: true, system: true };

route({ ...T, method: 'GET', pattern: '/api/test/health', handler: async () => ({ testMode: true }) });

route({
  ...T,
  method: 'POST',
  pattern: '/api/test/reset',
  handler: async (c) => {
    const body = await c.body();
    if (!body.fixture || typeof body.fixture !== 'object') throw badRequest('Mangler fixture.');
    await loadFixture(c.tx, body.fixture);
    setClock(DEFAULT_TEST_NOW);
    return json(null, 204);
  },
});

/** Logger inn uten e-postkode. `mfa: false` gir en økt uten fullført tofaktor. `orgId` velger bedrift. */
route({
  ...T,
  method: 'POST',
  pattern: '/api/test/login',
  handler: async (c) => {
    const body = await c.body();
    let userId: string;
    if (typeof body.newUserEmail === 'string') {
      const email = body.newUserEmail.trim().toLowerCase();
      const existing = await c.tx.select().from(users).where(eq(users.email, email)).limit(1);
      userId = existing[0]?.id ?? (await c.tx.insert(users).values({ email }).returning())[0].id;
    } else if (isUuid(body.userId)) {
      const u = await c.tx.select().from(users).where(eq(users.id, body.userId)).limit(1);
      if (!u[0]) throw notFound();
      userId = u[0].id;
    } else {
      throw badRequest('Oppgi userId eller newUserEmail.');
    }
    const access = await loadAccess(c.tx, userId, isUuid(body.orgId) ? body.orgId : null, true);
    const s = await createSession(c.tx, userId, { mfa: body.mfa !== false, orgId: access.orgId });
    return setSessionCookies(json({ csrfToken: s.csrfToken }), s, c.secure);
  },
});

route({
  ...T,
  method: 'GET',
  pattern: '/api/test/outbox',
  handler: async (c) => {
    const rows = await c.tx.select().from(outbox).orderBy(asc(outbox.seq));
    return json(rows.map((r) => ({ channel: r.channel, to: r.to, replyTo: r.replyTo, subject: r.subject, body: r.body, orgId: r.orgId, invoiceId: r.invoiceId, hasAttachment: !!r.invoiceId })));
  },
});

route({
  ...T,
  method: 'POST',
  pattern: '/api/test/clock',
  handler: async (c) => {
    const v = (await c.body()).now;
    if (v === 'reset') setClock(DEFAULT_TEST_NOW);
    else if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) setClock(v);
    else throw badRequest('Oppgi now som ISO 8601-tidspunkt.');
    return json(null, 204);
  },
});

route({
  ...T,
  method: 'POST',
  pattern: '/api/test/run-jobs',
  handler: async (c) => {
    await runJobs(c.tx);
    return json(null, 204);
  },
});
