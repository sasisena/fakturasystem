/** Innlogging i sidene (server components). Tilgang til data sjekkes alltid på nytt i API-et. */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Access } from './access';
import { loadAccess } from './context';
import { rootDb, withSystem } from './db';
import { SESSION_COOKIE, loadSession, type SessionUser } from './session';
import { ensureStarted } from './startup';

export type PageUser = { session: SessionUser; access: Access };

export async function currentUser(): Promise<PageUser | null> {
  // cookies() først: gjør siden dynamisk, så den aldri forhåndsbygges uten database.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await ensureStarted();
  const session = await loadSession(rootDb(), token);
  if (!session) return null;
  const access = await withSystem((tx) => loadAccess(tx, session.user.id, session.orgId, session.mfa));
  return { session, access };
}

export async function requireUser(next: string): Promise<PageUser> {
  const u = await currentUser();
  if (!u) redirect(`/logg-inn?neste=${encodeURIComponent(next)}`);
  return u;
}

/**
 * Sidene i appen krever innlogging, fullført tofaktor og en valgt organisasjon.
 * Brukere uten organisasjon sendes til «Kom i gang».
 */
export async function requireOrg(next: string): Promise<PageUser> {
  const u = await requireUser(next);
  if (u.access.memberships.length === 0) redirect('/kom-i-gang');
  if (u.access.mfaMissing) redirect(`/logg-inn/tofaktor?neste=${encodeURIComponent(next)}`);
  if (!u.access.orgId) redirect('/velg-bedrift');
  return u;
}
