import { request } from '@playwright/test';
import { BASE_URL } from './env';

/**
 * Stopper hele kjøringen hvis adressen ikke er et testmiljø.
 * Testene sletter og erstatter data, og skal aldri kjøres mot produksjon.
 */
export default async function globalSetup(): Promise<void> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  let ok = false;
  try {
    const r = await ctx.get('/api/test/health');
    ok = r.status() === 200 && (await r.json()).testMode === true;
  } catch {
    throw new Error(`Får ikke kontakt med ${BASE_URL}. Start testmiljøet eller sett FAKTURA_BASE_URL.`);
  } finally {
    await ctx.dispose();
  }
  if (!ok) throw new Error(`${BASE_URL} svarer ikke som et testmiljø (GET /api/test/health skal gi {"testMode": true}).`);
}
