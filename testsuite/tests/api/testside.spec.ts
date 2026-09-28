import { expect, test } from '@playwright/test';
import { anon, json, loginAs, resetData } from '../../lib/api';
import { customer } from '../../lib/fixture';

/**
 * Testsiden /test/koder (testmiljøet). Kjøres bare når FAKTURA_TESTSIDE_PASSORD er satt og
 * appen er startet med samme verdi i TEST_PAGE_PASSWORD.
 */
const PASSORD = process.env.FAKTURA_TESTSIDE_PASSORD ?? '';
test.skip(!PASSORD, 'FAKTURA_TESTSIDE_PASSORD er ikke satt');
test.beforeEach(resetData);

const basic = (pw: string) => ({ Authorization: `Basic ${Buffer.from(`hvem-som-helst:${pw}`).toString('base64')}` });

test('testsiden krever passord', async () => {
  const ctx = await anon();
  expect((await ctx.get('/test/koder')).status()).toBe(401);
  expect((await ctx.get('/test/koder', { headers: basic('feil-passord-123') })).status()).toBe(401);
  expect((await ctx.get('/test/koder', { headers: basic(PASSORD) })).status()).toBe(200);
});

test('innloggingskoden vises på testsiden og kan brukes', async () => {
  const ctx = await anon();
  const email = 'testside@eksempel.example';
  await ctx.post('/api/auth/otp/request', { data: { email } });
  const html = await (await ctx.get('/test/koder', { headers: basic(PASSORD) })).text();
  const code = html.match(new RegExp(`${email.replace('.', '\\.')}</td><td class="kode">(\\d{6})<`))?.[1];
  expect(code, 'koden skal stå på testsiden').toBeTruthy();
  expect((await ctx.post('/api/auth/otp/verify', { data: { email, code } })).status()).toBe(200);
});

test('faktura sendt på e-post kan åpnes som PDF fra testsiden', async () => {
  const a = await loginAs('eier-a');
  const d = await json(await a.post('/api/invoices', { data: { customerId: customer(0).id, lines: [{ description: 'x', quantity: 1, unitPrice: 1000, vatRate: 25 }] } }), 201);
  await json(await a.post(`/api/invoices/${d.id}/send`, { data: { delivery: 'epost' } }));
  const ctx = await anon();
  const html = await (await ctx.get('/test/koder', { headers: basic(PASSORD) })).text();
  expect(html).toContain('Faktura 1 fra Fjellsnø Design AS');
  const link = html.match(/href="(\/test\/koder\?pdf=\d+)"/)![1];
  const pdf = await ctx.get(link, { headers: basic(PASSORD) });
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
});
