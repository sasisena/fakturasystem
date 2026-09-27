/**
 * Planlagte jobber. Kjøres hvert kvarter i drift (npm run jobs:run), og med POST /api/test/run-jobs i testmodus.
 */
import { lt } from 'drizzle-orm';
import { loginAttempts, otpCodes, sessions } from '@/db/schema';
import type { Tx } from './db';

/** Sletter utløpte økter, engangskoder og gamle innloggingsforsøk. */
export async function runJobs(tx: Tx): Promise<{ expiredSessions: number; oldCodes: number }> {
  const realNow = new Date();
  const dayAgo = new Date(realNow.getTime() - 24 * 3600 * 1000);
  const s = await tx.delete(sessions).where(lt(sessions.expiresAt, realNow)).returning({ id: sessions.id });
  const c = await tx.delete(otpCodes).where(lt(otpCodes.expiresAt, dayAgo)).returning({ id: otpCodes.id });
  await tx.delete(loginAttempts).where(lt(loginAttempts.at, dayAgo));
  return { expiredSessions: s.length, oldCodes: c.length };
}
