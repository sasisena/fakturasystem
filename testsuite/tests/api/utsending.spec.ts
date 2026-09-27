import { expect, test, type APIRequestContext } from '@playwright/test';
import { anon, json, loginAs, outbox, resetData } from '../../lib/api';
import { ORG_A, customer } from '../../lib/fixture';

test.beforeEach(resetData);

const lines = [
  { description: 'Rådgivning', quantity: 2, unit: 'timer', unitPrice: 120000, vatRate: 25 },
  { description: 'Lunsj', quantity: 1, unitPrice: 45000, vatRate: 15 },
];

async function draft(ctx: APIRequestContext, customerId = customer(0).id) {
  return json(await ctx.post('/api/invoices', { data: { customerId, theirReference: 'Kari', lines } }), 201);
}

function mod10(base: string) {
  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    let n = Number(base[base.length - 1 - i]);
    if (i % 2 === 0) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return (10 - (sum % 10)) % 10;
}

async function setClock(now: string) {
  const ctx = await anon();
  expect((await ctx.post('/api/test/clock', { data: { now } })).status()).toBe(204);
}

test('sende på e-post gir nummer, KID, datoer og e-post med PDF', async () => {
  const a = await loginAs('fakturering-a');
  const d = await draft(a);
  const inv = await json(await a.post(`/api/invoices/${d.id}/send`, { data: { delivery: 'epost' } }));
  expect(inv).toMatchObject({ kind: 'faktura', status: 'sendt', overdue: false, number: 1, issueDate: '2026-09-24', dueDate: '2026-10-08', delivery: 'epost', sentTo: 'post@havbris.example' });
  expect(inv.kid).toBe(`000010000001${mod10('000010000001')}`);
  const mail = (await outbox()).find((m) => m.invoiceId === d.id);
  expect(mail).toMatchObject({ to: 'post@havbris.example', replyTo: 'post@fjellsno.example', subject: 'Faktura 1 fra Fjellsnø Design AS', hasAttachment: true, orgId: ORG_A });
  expect(mail.body).toContain(inv.kid);
  expect(mail.body).toContain('8601.11.17947');
  expect(mail.body).toContain('08.10.2026');
  const pdf = await a.get(`/api/invoices/${d.id}/pdf`);
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  const owner = await loginAs('eier-a');
  expect((await json(await owner.get('/api/audit-log'))).map((e: { action: string }) => e.action)).toContain('faktura_sendt');
});

test('manuell utsending gir neste nummer uten e-post', async () => {
  const a = await loginAs('eier-a');
  await json(await a.post(`/api/invoices/${(await draft(a)).id}/send`, { data: { delivery: 'manuell' } }));
  const second = await json(await a.post(`/api/invoices/${(await draft(a)).id}/send`, { data: { delivery: 'manuell' } }));
  expect(second).toMatchObject({ number: 2, delivery: 'manuell', sentTo: null });
  expect((await outbox()).filter((m) => m.invoiceId)).toEqual([]);
});

test('en sendt faktura kan ikke endres eller slettes', async () => {
  const a = await loginAs('eier-a');
  const d = await draft(a);
  await json(await a.post(`/api/invoices/${d.id}/send`, { data: { delivery: 'manuell' } }));
  for (const r of [await a.put(`/api/invoices/${d.id}`, { data: { customerId: customer(0).id, lines } }), await a.delete(`/api/invoices/${d.id}`)]) {
    expect(r.status()).toBe(409);
    expect((await r.json()).code).toBe('faktura_sendt');
  }
  expect((await a.post(`/api/invoices/${d.id}/send`, { data: { delivery: 'manuell' } })).status()).toBe(409);
});

test('kunde- og firmaopplysninger fryses ved utsending', async () => {
  const a = await loginAs('eier-a');
  const d = await draft(a);
  await json(await a.post(`/api/invoices/${d.id}/send`, { data: { delivery: 'manuell' } }));
  await json(await a.put(`/api/customers/${customer(0).id}`, { data: { ...customer(0), name: 'Nytt Navn AS', city: 'Oslo' } }));
  const org = await json(await a.get('/api/organizations/current'));
  await json(await a.put('/api/organizations/current', { data: { ...org, address: 'Ny gate 9', accountNumber: '1234.56.78903' } }));
  const inv = await json(await a.get(`/api/invoices/${d.id}`));
  expect(inv.customer).toMatchObject({ name: 'Havbris Kafé AS', city: 'Bergen' });
  expect((await json(await a.get(`/api/invoices?customerId=${customer(0).id}`)))[0].customerName).toBe('Havbris Kafé AS');
});

test('utsending avvises når firmaopplysninger mangler, uten å bruke et nummer', async () => {
  const b = await loginAs('eier-b');
  const d = await json(await b.post('/api/invoices', { data: { customerId: customer(2).id, lines: [{ description: 'Brød', quantity: 1, unitPrice: 5000, vatRate: 0 }] } }), 201);
  const r = await b.post(`/api/invoices/${d.id}/send`, { data: { delivery: 'epost' } });
  expect(r.status()).toBe(409);
  const body = await r.json();
  expect(body.code).toBe('mangler_firmaopplysninger');
  expect(body.missing).toEqual(['organisasjonsnummer', 'kontonummer']);
  expect((await json(await b.get(`/api/invoices/${d.id}`))).status).toBe('utkast');
  const org = await json(await b.get('/api/organizations/current'));
  await json(await b.put('/api/organizations/current', { data: { ...org, orgNumber: '923609016', accountNumber: '8601.11.17947' } }));
  expect((await json(await b.post(`/api/invoices/${d.id}/send`, { data: { delivery: 'epost' } }))).number).toBe(1);
});

test('e-post krever at kunden har e-postadresse', async () => {
  const a = await loginAs('eier-a');
  const c = await json(await a.post('/api/customers', { data: { name: 'Uten e-post' } }), 201);
  const d = await draft(a, c.id);
  const r = await a.post(`/api/invoices/${d.id}/send`, { data: { delivery: 'epost' } });
  expect(r.status()).toBe(409);
  expect((await r.json()).code).toBe('kunde_mangler_epost');
  expect((await json(await a.post(`/api/invoices/${d.id}/send`, { data: { delivery: 'manuell' } }))).number).toBe(1);
});

test('ugyldig leveringsmåte gir 422', async () => {
  const a = await loginAs('eier-a');
  expect((await a.post(`/api/invoices/${(await draft(a)).id}/send`, { data: { delivery: 'fax' } })).status()).toBe(422);
});

test('forfalt, betalt og angre betalt', async () => {
  const a = await loginAs('eier-a');
  const d = await draft(a);
  expect((await a.post(`/api/invoices/${d.id}/mark-paid`, { data: {} })).status()).toBe(409);
  const sent = await json(await a.post(`/api/invoices/${d.id}/send`, { data: { delivery: 'manuell' } }));
  await setClock('2026-10-08T23:30:00+02:00');
  expect((await json(await a.get(`/api/invoices/${d.id}`))).overdue).toBe(false);
  await setClock('2026-10-09T00:30:00+02:00');
  expect((await json(await a.get(`/api/invoices/${d.id}`))).overdue).toBe(true);
  expect((await json(await a.get('/api/invoices?status=forfalt'))).map((i: { id: string }) => i.id)).toEqual([d.id]);
  expect(await json(await a.get('/api/dashboard'))).toMatchObject({ outstanding: sent.totals.gross, outstandingCount: 1, overdue: sent.totals.gross, overdueCount: 1, paidThisMonth: 0, draftCount: 0 });

  const paid = await json(await a.post(`/api/invoices/${d.id}/mark-paid`, { data: { paidDate: '2026-10-09' } }));
  expect(paid).toMatchObject({ status: 'betalt', paidDate: '2026-10-09', overdue: false });
  expect(await json(await a.get('/api/dashboard'))).toMatchObject({ outstanding: 0, overdueCount: 0, paidThisMonth: sent.totals.gross });
  expect((await json(await a.get('/api/invoices?status=betalt'))).length).toBe(1);
  expect(await json(await a.post(`/api/invoices/${d.id}/mark-unpaid`, { data: {} }))).toMatchObject({ status: 'sendt', paidDate: null });
});

test('kreditnota nuller ut fakturaen', async () => {
  const a = await loginAs('eier-a');
  const d = await draft(a);
  expect((await a.post(`/api/invoices/${d.id}/credit`, { data: {} })).status()).toBe(409);
  const inv = await json(await a.post(`/api/invoices/${d.id}/send`, { data: { delivery: 'epost' } }));
  await setClock('2026-09-30T10:00:00+02:00');
  const cn = await json(await a.post(`/api/invoices/${d.id}/credit`, { data: { delivery: 'epost' } }), 201);
  expect(cn).toMatchObject({ kind: 'kreditnota', status: 'sendt', number: 2, creditOf: d.id, kid: null, dueDate: null, issueDate: '2026-09-30', overdue: false });
  expect(cn.lines.map((l: { quantity: number }) => l.quantity)).toEqual([-2, -1]);
  expect(cn.totals.gross).toBe(-inv.totals.gross);
  expect(cn.totals.vat).toBe(-inv.totals.vat);
  const original = await json(await a.get(`/api/invoices/${d.id}`));
  expect(original).toMatchObject({ status: 'kreditert', creditedBy: cn.id });
  const r = await a.post(`/api/invoices/${d.id}/credit`, { data: {} });
  expect(r.status()).toBe(409);
  expect((await r.json()).code).toBe('allerede_kreditert');
  expect((await a.post(`/api/invoices/${cn.id}/credit`, { data: {} })).status()).toBe(409);
  expect((await a.post(`/api/invoices/${cn.id}/mark-paid`, { data: {} })).status()).toBe(409);
  expect((await outbox()).find((m) => m.invoiceId === cn.id)).toMatchObject({ subject: 'Kreditnota 2 fra Fjellsnø Design AS', hasAttachment: true });
  expect(await json(await a.get('/api/dashboard'))).toMatchObject({ outstanding: 0, outstandingCount: 0 });
  expect((await json(await a.get('/api/invoices?status=kreditert'))).map((i: { id: string }) => i.id)).toEqual([d.id]);
});

test('en betalt faktura kan også krediteres', async () => {
  const a = await loginAs('eier-a');
  const d = await draft(a);
  await json(await a.post(`/api/invoices/${d.id}/send`, { data: { delivery: 'manuell' } }));
  await json(await a.post(`/api/invoices/${d.id}/mark-paid`, { data: {} }));
  expect((await json(await a.post(`/api/invoices/${d.id}/credit`, { data: { delivery: 'manuell' } }), 201)).number).toBe(2);
});

test('nummerserien kan bare økes, med begrunnelse, og det logges', async () => {
  const a = await loginAs('eier-a');
  expect((await json(await a.get('/api/organizations/current'))).nextInvoiceNumber).toBe(1);
  expect((await a.put('/api/organizations/current/invoice-number', { data: { nextInvoiceNumber: 1000 } })).status()).toBe(422);
  await json(await a.put('/api/organizations/current/invoice-number', { data: { nextInvoiceNumber: 1000, reason: 'Fortsetter serien fra Fiken' } }));
  expect((await json(await a.post(`/api/invoices/${(await draft(a)).id}/send`, { data: { delivery: 'manuell' } }))).number).toBe(1000);
  expect((await a.put('/api/organizations/current/invoice-number', { data: { nextInvoiceNumber: 500, reason: 'Feil' } })).status()).toBe(422);
  const log = await json(await a.get('/api/audit-log'));
  expect(log.find((e: { action: string }) => e.action === 'fakturaserie_endret')).toMatchObject({ before: { nextInvoiceNumber: 1 }, after: { nextInvoiceNumber: 1000, reason: 'Fortsetter serien fra Fiken' } });
  const per = await loginAs('fakturering-a');
  expect((await per.put('/api/organizations/current/invoice-number', { data: { nextInvoiceNumber: 2000, reason: 'x' } })).status()).toBe(403);
});

test('samtidig utsending gir numre uten hull og dubletter', async () => {
  const a = await loginAs('eier-a');
  const drafts = [];
  for (let i = 0; i < 6; i++) drafts.push(await draft(a));
  const results = await Promise.all(drafts.map((d) => a.post(`/api/invoices/${d.id}/send`, { data: { delivery: 'manuell' } })));
  const numbers = (await Promise.all(results.map((r) => json(r)))).map((i: { number: number }) => i.number).sort((x, y) => x - y);
  expect(numbers).toEqual([1, 2, 3, 4, 5, 6]);
});

test('bedriftene har hver sin nummerserie', async () => {
  const a = await loginAs('eier-a');
  await json(await a.post(`/api/invoices/${(await draft(a)).id}/send`, { data: { delivery: 'manuell' } }));
  const b = await loginAs('eier-b');
  const org = await json(await b.get('/api/organizations/current'));
  await json(await b.put('/api/organizations/current', { data: { ...org, orgNumber: '923609016', accountNumber: '8601.11.17947' } }));
  const d = await json(await b.post('/api/invoices', { data: { customerId: customer(2).id, lines } }), 201);
  expect((await json(await b.post(`/api/invoices/${d.id}/send`, { data: { delivery: 'manuell' } }))).number).toBe(1);
});

test('lesetilgang og andre bedrifter kan ikke sende, betale eller kreditere', async () => {
  const a = await loginAs('eier-a');
  const d = await draft(a);
  const r = await loginAs('regnskap', { orgId: ORG_A });
  expect((await r.post(`/api/invoices/${d.id}/send`, { data: { delivery: 'manuell' } })).status()).toBe(403);
  await json(await a.post(`/api/invoices/${d.id}/send`, { data: { delivery: 'manuell' } }));
  expect((await r.post(`/api/invoices/${d.id}/mark-paid`, { data: {} })).status()).toBe(403);
  expect((await r.post(`/api/invoices/${d.id}/credit`, { data: {} })).status()).toBe(403);
  const b = await loginAs('eier-b');
  for (const path of ['send', 'mark-paid', 'mark-unpaid', 'credit']) {
    expect((await b.post(`/api/invoices/${d.id}/${path}`, { data: { delivery: 'manuell' } })).status(), path).toBe(404);
  }
});
