/**
 * Innlogging med engangskode på e-post, og tofaktor (TOTP) for alle som er med i en bedrift.
 * Nye brukere opprettes første gang de logger inn.
 * - Svaret på kodeforespørsel er alltid 202, så det avsløres ikke om e-posten finnes.
 * - Høyst 10 feil koder per e-post i løpet av 15 minutter; deretter 429.
 */
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { loginAttempts, otpCodes, sessions, users } from '@/db/schema';
import { audit } from '../audit';

/** Innlogging bruker den virkelige klokken, ikke testklokken. */
const realNow = () => new Date();
import { loadAccess } from '../context';
import { decrypt, encrypt, hmac, safeEqual } from '../crypto';
import { asSystem } from '../db';
import { ApiError, badRequest, invalid } from '../errors';
import { enqueue } from '../messaging';
import { json, route, type Ctx } from '../router';
import { clearSessionCookies, createSession, deleteSession, setSessionCookies } from '../session';
import { newTotpSecret, otpauthUri, verifyTotp } from '../totp';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED = 10;
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODES_PER_WINDOW = 5;

const emailSchema = z.string().trim().toLowerCase().email();

async function failedAttempts(c: Ctx, key: string): Promise<number> {
  const since = new Date(realNow().getTime() - WINDOW_MS);
  const rows = await c.tx
    .select({ id: loginAttempts.id })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, key), eq(loginAttempts.success, false), gt(loginAttempts.at, since)));
  return rows.length;
}

const tooMany = () =>
  new ApiError(429, { code: 'for_mange_forsok', message: 'For mange forsøk. Vent 15 minutter og prøv igjen.' });

const codeMessage = {
  subject: 'Innloggingskode til Fakturasystem',
  body: (code: string) => `Koden din er ${code}. Den gjelder i 10 minutter.\n\nHar du ikke bedt om koden, kan du se bort fra denne e-posten.`,
};

route({
  method: 'POST',
  pattern: '/api/auth/otp/request',
  auth: 'none',
  csrf: false,
  system: true,
  handler: async (c) => {
    const body = await c.body();
    const parsed = emailSchema.safeParse(body.email);
    // Samme svar uansett, også for ugyldig eller ukjent e-post.
    if (!parsed.success) return json({ ok: true }, 202);
    const email = parsed.data;
    const since = new Date(realNow().getTime() - WINDOW_MS);
    const recent = await c.tx.select({ id: otpCodes.id }).from(otpCodes).where(and(eq(otpCodes.email, email), gt(otpCodes.createdAt, since)));
    if (recent.length >= MAX_CODES_PER_WINDOW) return json({ ok: true }, 202);

    const code = String(Math.floor(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * 900000));
    await c.tx.insert(otpCodes).values({
      email,
      codeHash: hmac(`${email}:${code}`),
      createdAt: realNow(),
      expiresAt: new Date(realNow().getTime() + CODE_TTL_MS),
    });
    await enqueue(c.tx, { channel: 'email', to: email, subject: codeMessage.subject, body: codeMessage.body(code) });
    return json({ ok: true }, 202);
  },
});

route({
  method: 'POST',
  pattern: '/api/auth/otp/verify',
  auth: 'none',
  csrf: false,
  system: true,
  handler: async (c) => {
    const body = await c.body();
    const parsed = emailSchema.safeParse(body.email);
    const code = typeof body.code === 'string' ? body.code.replace(/\s/g, '') : '';
    if (!parsed.success) throw invalid([{ field: 'email', message: 'Skriv e-postadressen du fikk koden på.' }]);
    const email = parsed.data;
    if ((await failedAttempts(c, email)) >= MAX_FAILED) throw tooMany();

    const candidates = await c.tx
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.email, email), isNull(otpCodes.usedAt), gt(otpCodes.expiresAt, realNow())))
      .orderBy(desc(otpCodes.createdAt))
      .limit(5);
    const hit = candidates.find((x) => /^\d{6}$/.test(code) && safeEqual(x.codeHash, hmac(`${email}:${code}`)));
    if (!hit) {
      // Logges i en egen transaksjon, så forsøket teller selv om svaret er en feil.
      await c.tx.insert(loginAttempts).values({ key: email, success: false, at: realNow() });
      return json({ code: 'feil_kode', message: 'Koden stemmer ikke eller er utløpt. Sjekk e-posten og prøv igjen, eller be om en ny kode.' }, 401);
    }
    await c.tx.update(otpCodes).set({ usedAt: realNow() }).where(eq(otpCodes.id, hit.id));
    await c.tx.insert(loginAttempts).values({ key: email, success: true, at: realNow() });

    let user = (await c.tx.select().from(users).where(eq(users.email, email)).limit(1))[0];
    if (!user) user = (await c.tx.insert(users).values({ email, name: '' }).returning())[0];
    await c.tx.update(users).set({ lastLoginAt: realNow() }).where(eq(users.id, user.id));

    const access = await loadAccess(c.tx, user.id, null, false);
    const s = await createSession(c.tx, user.id, { mfa: false, orgId: access.orgId });
    return setSessionCookies(
      json({ csrfToken: s.csrfToken, requiresMfa: access.requiresMfa, mfaConfigured: user.totpEnabled, hasOrganization: access.memberships.length > 0 }),
      s,
      c.secure,
    );
  },
});

/** Starter oppsett av TOTP: gir hemmeligheten som legges inn i autentiseringsappen. */
route({
  method: 'POST',
  pattern: '/api/auth/mfa/setup',
  handler: async (c) => {
    const user = c.session!.user;
    if (user.totpEnabled) throw new ApiError(409, { code: 'allerede_satt_opp', message: 'Tofaktor er allerede satt opp.' });
    const secret = newTotpSecret();
    await c.tx.update(users).set({ totpSecret: encrypt(secret) }).where(eq(users.id, user.id));
    return { secret, otpauthUri: otpauthUri(secret, user.email) };
  },
});

/** Bekrefter en TOTP-kode. Første gang slås tofaktor på for brukeren. */
route({
  method: 'POST',
  pattern: '/api/auth/mfa/verify',
  handler: async (c) => {
    const body = await c.body();
    const user = (await c.tx.select().from(users).where(eq(users.id, c.userId)).limit(1))[0];
    if (!user?.totpSecret) throw badRequest('Sett opp tofaktor først.');
    const key = `mfa:${user.id}`;
    if ((await failedAttempts(c, key)) >= MAX_FAILED) throw tooMany();
    const code = typeof body.code === 'string' ? body.code.replace(/\s/g, '') : '';
    if (!verifyTotp(decrypt(user.totpSecret), code, realNow())) {
      await c.tx.insert(loginAttempts).values({ key, success: false, at: realNow() });
      return json({ code: 'feil_kode', message: 'Koden stemmer ikke. Skriv inn de seks sifrene som vises i appen nå.' }, 401);
    }
    await c.tx.insert(loginAttempts).values({ key, success: true, at: realNow() });
    if (!user.totpEnabled) await c.tx.update(users).set({ totpEnabled: true }).where(eq(users.id, user.id));
    await c.tx.update(sessions).set({ mfa: true }).where(eq(sessions.id, c.session!.sessionId));
    // Økten hadde ikke tofaktor før nå, så RLS-omfanget er tomt; loggføringen skjer i systemmodus.
    await asSystem(c.tx, c.scope, () =>
      audit(c.tx, { orgId: c.access.orgId, actorId: user.id, action: 'innlogging', entity: 'user', entityId: user.id, after: { mfa: true } }),
    );
    return { ok: true };
  },
});

route({
  method: 'POST',
  pattern: '/api/auth/logout',
  handler: async (c) => {
    await deleteSession(c.tx, c.session!.sessionId);
    return clearSessionCookies(json({ ok: true }), c.secure);
  },
});

route({
  method: 'GET',
  pattern: '/api/auth/session',
  auth: 'none',
  system: true,
  handler: async (c) => {
    if (!c.session) return { loggedIn: false };
    const access = await loadAccess(c.tx, c.session.user.id, c.session.orgId, c.session.mfa);
    return {
      loggedIn: true,
      userId: c.session.user.id,
      name: c.session.user.name,
      email: c.session.user.email,
      mfa: c.session.mfa,
      requiresMfa: access.requiresMfa,
      mfaConfigured: c.session.user.totpEnabled,
      organizations: access.memberships.map((m) => ({ id: m.orgId, name: m.orgName, role: m.role })),
      currentOrganization: access.orgId,
      role: access.role,
    };
  },
});

/** Enkel helsesjekk for vertstjenesten. Avslører ingenting om data eller oppsett. */
route({
  method: 'GET',
  pattern: '/api/health',
  auth: 'none',
  handler: async () => ({ ok: true }),
});
