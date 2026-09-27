/**
 * Sessions lagres i databasen. Cookien inneholder bare et tilfeldig token; databasen har hashen.
 * CSRF-tokenet hører til sessionen og må sendes i headeren X-CSRF-Token på alle endrende kall.
 */
import { and, eq, gt } from 'drizzle-orm';
import { sessions, users } from '@/db/schema';
import { randomToken, sha256 } from './crypto';
import type { Q } from './db';

export const SESSION_COOKIE = 'faktura_session';
/** Lesbar for skriptet i nettleseren, slik at skjemaene kan sende X-CSRF-Token. */
export const CSRF_COOKIE = 'faktura_csrf';

/** 30 dager: appen skal kunne brukes fra telefonen uten ny innlogging hver dag. */
const TTL_MS = 30 * 24 * 3600 * 1000;

export type SessionUser = {
  sessionId: string;
  csrfToken: string;
  mfa: boolean;
  orgId: string | null;
  user: typeof users.$inferSelect;
};

export async function createSession(db: Q, userId: string, opts: { mfa: boolean; orgId?: string | null }) {
  const token = randomToken();
  const csrfToken = randomToken(24);
  // Sessions og innlogging følger den virkelige klokken, også i testmodus.
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.insert(sessions).values({ id: sha256(token), userId, orgId: opts.orgId ?? null, csrfToken, mfa: opts.mfa, expiresAt, createdAt: new Date() });
  return { token, csrfToken, expiresAt };
}

export async function loadSession(db: Q, token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const rows = await db
    .select({ s: sessions, u: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return { sessionId: r.s.id, csrfToken: r.s.csrfToken, mfa: r.s.mfa, orgId: r.s.orgId, user: r.u };
}

export async function deleteSession(db: Q, sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/** Setter session-cookie (HttpOnly) og CSRF-cookie (lesbar for skjemaene) på svaret. */
export function setSessionCookies(res: Response, s: { token: string; csrfToken: string; expiresAt: Date }, secure: boolean): Response {
  const exp = s.expiresAt.toUTCString();
  const sec = secure ? '; Secure' : '';
  res.headers.append('Set-Cookie', `${SESSION_COOKIE}=${s.token}; Path=/; Expires=${exp}; HttpOnly; SameSite=Lax${sec}`);
  res.headers.append('Set-Cookie', `${CSRF_COOKIE}=${s.csrfToken}; Path=/; Expires=${exp}; SameSite=Lax${sec}`);
  return res;
}

export function clearSessionCookies(res: Response, secure: boolean): Response {
  const sec = secure ? '; Secure' : '';
  res.headers.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${sec}`);
  res.headers.append('Set-Cookie', `${CSRF_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${sec}`);
  return res;
}
