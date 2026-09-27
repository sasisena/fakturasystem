import { createHmac } from 'node:crypto';
import { expect, request, type APIRequestContext, type APIResponse } from '@playwright/test';
import { BASE_URL } from './env';
import { seed, user } from './fixture';

/** Tilbakestiller testdatabasen til fixtures/seed.json. */
export async function resetData(): Promise<void> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  const r = await ctx.post('/api/test/reset', { data: { fixture: seed } });
  expect(r.status(), 'POST /api/test/reset skal gi 204').toBe(204);
  await ctx.dispose();
}

async function testLogin(body: Record<string, unknown>, label: string, csrf = true): Promise<APIRequestContext> {
  const anon = await request.newContext({ baseURL: BASE_URL });
  const r = await anon.post('/api/test/login', { data: body });
  expect(r.status(), `test-innlogging som ${label}`).toBe(200);
  const { csrfToken } = await r.json();
  const storageState = await anon.storageState();
  await anon.dispose();
  return request.newContext({ baseURL: BASE_URL, storageState, extraHTTPHeaders: csrf ? { 'X-CSRF-Token': csrfToken } : {} });
}

/** Logger inn som en bruker fra fixturen. mfa=false gir en økt uten fullført tofaktor. */
export async function loginAs(userKey: string, opts: { mfa?: boolean; orgId?: string; csrf?: boolean } = {}): Promise<APIRequestContext> {
  return testLogin({ userId: user(userKey).id, mfa: opts.mfa ?? true, orgId: opts.orgId }, userKey, opts.csrf ?? true);
}

/** Ny bruker uten bedrift (har bekreftet e-posten, men ikke registrert noe ennå). */
export async function loginNewUser(email: string): Promise<APIRequestContext> {
  return testLogin({ newUserEmail: email }, email);
}

export async function anon(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: BASE_URL });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function outbox(): Promise<any[]> {
  const ctx = await anon();
  const r = await ctx.get('/api/test/outbox');
  const body = await r.json();
  await ctx.dispose();
  return body;
}

/** Siste innloggingskode sendt til e-postadressen. */
export async function lastCode(email: string): Promise<string> {
  const mails = (await outbox()).filter((m) => m.to === email && /Innloggingskode/.test(m.subject));
  const m = mails.at(-1)?.body.match(/\b(\d{6})\b/);
  if (!m) throw new Error(`Fant ingen innloggingskode til ${email}`);
  return m[1];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function json<T = any>(r: APIResponse, expectedStatus = 200): Promise<T> {
  expect(r.status(), `${r.url()} → ${(await r.text().catch(() => '')).slice(0, 300)}`).toBe(expectedStatus);
  return r.status() === 204 ? (undefined as T) : r.json();
}

/** TOTP-kode (RFC 6238, SHA-1, 6 siffer, 30 s) – som en autentiseringsapp. */
export function totp(secretBase32: string, at = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of secretBase32.replace(/\s|=/g, '').toUpperCase()) {
    value = (value << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
