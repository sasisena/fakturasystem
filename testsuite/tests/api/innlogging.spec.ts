import { expect, test } from '@playwright/test';
import { anon, json, lastCode, resetData, totp } from '../../lib/api';

test.beforeEach(resetData);

test('ny bruker logger inn med kode, registrerer bedrift og setter opp tofaktor', async () => {
  const ctx = await anon();
  const email = 'ny@eksempel.example';
  expect((await ctx.post('/api/auth/otp/request', { data: { email } })).status()).toBe(202);
  const verify = await json(await ctx.post('/api/auth/otp/verify', { data: { email, code: await lastCode(email) } }));
  expect(verify).toMatchObject({ requiresMfa: false, hasOrganization: false });
  const csrf = { 'X-CSRF-Token': verify.csrfToken };

  const org = await json(await ctx.post('/api/organizations', { headers: csrf, data: { name: 'Testfirma', orgNumber: '923 609 016', accountNumber: '8601.11.17947' } }), 201);
  expect(org).toMatchObject({ name: 'Testfirma', orgNumber: '923609016', accountNumber: '86011117947', role: 'eier' });

  // Etter registreringen kreves tofaktor før bedriften kan brukes.
  const blocked = await ctx.get('/api/organizations/current');
  expect(blocked.status()).toBe(403);
  expect((await blocked.json()).code).toBe('mfa_kreves');

  const { secret } = await json(await ctx.post('/api/auth/mfa/setup', { headers: csrf }));
  expect((await ctx.post('/api/auth/mfa/verify', { headers: csrf, data: { code: '000000' } })).status()).toBe(401);
  await json(await ctx.post('/api/auth/mfa/verify', { headers: csrf, data: { code: totp(secret) } }));

  const current = await json(await ctx.get('/api/organizations/current'));
  expect(current).toMatchObject({ id: org.id, name: 'Testfirma', role: 'eier', missingForInvoicing: ['adresse'] });
});

test('forespørsel om kode avslører ikke om e-posten finnes', async () => {
  const ctx = await anon();
  expect((await ctx.post('/api/auth/otp/request', { data: { email: 'kari@fjellsno.example' } })).status()).toBe(202);
  expect((await ctx.post('/api/auth/otp/request', { data: { email: 'finnes.ikke@example.no' } })).status()).toBe(202);
  expect((await ctx.post('/api/auth/otp/request', { data: { email: 'ikke-en-epost' } })).status()).toBe(202);
});

test('feil kode gir 401, og for mange forsøk gir 429', async () => {
  const ctx = await anon();
  const email = 'kari@fjellsno.example';
  await ctx.post('/api/auth/otp/request', { data: { email } });
  let last = 0;
  for (let i = 0; i < 11; i++) {
    last = (await ctx.post('/api/auth/otp/verify', { data: { email, code: '000000' } })).status();
    if (last === 429) break;
    expect(last).toBe(401);
  }
  expect(last).toBe(429);
});

test('eksisterende bruker med én bedrift får den valgt automatisk', async () => {
  const ctx = await anon();
  const email = 'kari@fjellsno.example';
  await ctx.post('/api/auth/otp/request', { data: { email } });
  const verify = await json(await ctx.post('/api/auth/otp/verify', { data: { email, code: await lastCode(email) } }));
  expect(verify).toMatchObject({ requiresMfa: true, hasOrganization: true });
  const session = await json(await ctx.get('/api/auth/session'));
  expect(session).toMatchObject({ loggedIn: true, mfa: false, currentOrganization: '0a000000-0000-4000-8000-000000000001', role: 'eier' });
});
