import { expect, test } from '@playwright/test';
import { anon, loginAs, resetData } from '../../lib/api';

test.beforeEach(resetData);

test('uinnlogget gir 401', async () => {
  const ctx = await anon();
  for (const path of ['/api/organizations/current', '/api/team', '/api/organizations', '/api/audit-log']) {
    expect((await ctx.get(path)).status(), path).toBe(401);
  }
});

test('endrende kall uten CSRF-token eller fra fremmed nettside gir 403', async () => {
  const noCsrf = await loginAs('eier-a', { csrf: false });
  expect((await noCsrf.put('/api/organizations/current', { data: { name: 'X' } })).status()).toBe(403);
  const ctx = await loginAs('eier-a');
  const foreign = await ctx.put('/api/organizations/current', { data: { name: 'X' }, headers: { Origin: 'https://ondsinnet.example' } });
  expect(foreign.status()).toBe(403);
});

test('uten fullført tofaktor gir alle bedriftsendepunkter mfa_kreves', async () => {
  const ctx = await loginAs('eier-a', { mfa: false });
  for (const path of ['/api/organizations/current', '/api/team', '/api/audit-log']) {
    const r = await ctx.get(path);
    expect(r.status(), path).toBe(403);
    expect((await r.json()).code, path).toBe('mfa_kreves');
  }
});

test('sikkerhetshoder og cookie', async () => {
  const r = await (await anon()).post('/api/test/login', { data: { userId: '1a000000-0000-4000-8000-000000000001' } });
  const cookies = r.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie').map((h) => h.value);
  const session = cookies.find((c) => /session=/.test(c))!;
  expect(session).toMatch(/HttpOnly/);
  expect(session).toMatch(/SameSite=Lax/);
  const h = (await (await anon()).get('/api/auth/session')).headers();
  expect(h['content-security-policy']).toContain('frame-ancestors');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBeTruthy();
});

test('feilsvar inneholder ikke tekniske detaljer', async () => {
  const ctx = await loginAs('eier-a');
  const r = await ctx.post('/api/session/organization', { data: 'ikke json{', headers: { 'Content-Type': 'application/json' } });
  const text = await r.text();
  expect(r.status()).toBe(400);
  expect(text).not.toMatch(/at \w+ \(|SELECT|postgres|\/home\/|node_modules/i);
});

test('testendepunktene finnes (bare i testmodus)', async () => {
  expect((await (await anon()).get('/api/test/health')).status()).toBe(200);
});
