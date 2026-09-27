import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { isValidKid } from '@faktura/core';
import { buildApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import type { Mail } from '../src/mailer.ts';

let app: FastifyInstance;
let sent: Mail[];

const company = {
  name: 'Kari Konsulent',
  orgNumber: '923 609 016',
  vatRegistered: true,
  address: 'Storgata 1',
  postalCode: '0155',
  city: 'Oslo',
  email: 'kari@example.no',
  accountNumber: '8601.11.17947',
  paymentTermsDays: 14,
};

beforeEach(() => {
  sent = [];
  const fakeFetch = (async (url: string) =>
    url.endsWith('/923609016')
      ? new Response(
          JSON.stringify({
            organisasjonsnummer: '923609016',
            navn: 'EQUINOR ASA',
            forretningsadresse: { adresse: ['Forusbeen 50'], postnummer: '4035', poststed: 'STAVANGER' },
            registrertIMvaregisteret: true,
            organisasjonsform: { kode: 'ASA' },
          }),
        )
      : new Response('', { status: 404 })) as typeof fetch;
  app = buildApp({ db: openDb(':memory:'), mailer: { send: async (m) => void sent.push(m) }, fetchFn: fakeFetch });
});

async function call(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) {
  const res = await app.inject({ method, url, payload });
  return { status: res.statusCode, body: res.body ? res.json() : undefined, res };
}

async function setup() {
  await call('PUT', '/api/company', company);
  const customer = (await call('POST', '/api/customers', { name: 'Kunde AS', email: 'post@kunde.no', address: 'Vei 2', postalCode: '5003', city: 'Bergen' })).body;
  const draft = (
    await call('POST', '/api/invoices', {
      customerId: customer.id,
      lines: [
        { description: 'Rådgivning', quantity: 7.5, unitPrice: 120_000, vatRate: 25 },
        { description: 'Reise', quantity: 1, unitPrice: 50_000, vatRate: 12 },
      ],
    })
  ).body;
  return { customer, draft };
}

test('full flyt: utkast → send → betalt', async () => {
  const { draft } = await setup();
  assert.equal(draft.status, 'draft');
  assert.equal(draft.number, null);
  assert.equal(draft.totals.gross, 900_000 * 1.25 + 50_000 * 1.12);

  const { status, body: inv } = await call('POST', `/api/invoices/${draft.id}/send`);
  assert.equal(status, 200);
  assert.equal(inv.status, 'sent');
  assert.equal(inv.number, 1001);
  assert.ok(isValidKid(inv.kid));
  assert.equal(inv.seller.name, 'Kari Konsulent');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'post@kunde.no');
  assert.match(sent[0].subject, /Faktura 1001/);
  assert.equal(sent[0].attachments![0].content.subarray(0, 4).toString(), '%PDF');

  const paid = await call('POST', `/api/invoices/${draft.id}/mark-paid`, { paidDate: '2026-09-27' });
  assert.equal(paid.body.status, 'paid');
  assert.equal(paid.body.paidAt, '2026-09-27');
});

test('sendt faktura kan ikke endres eller slettes', async () => {
  const { draft, customer } = await setup();
  await call('POST', `/api/invoices/${draft.id}/send`, { delivery: 'none' });
  assert.equal(sent.length, 0);
  const upd = await call('PUT', `/api/invoices/${draft.id}`, { customerId: customer.id, lines: [{ description: 'x', quantity: 1, unitPrice: 1, vatRate: 25 }] });
  assert.equal(upd.status, 409);
  assert.equal((await call('DELETE', `/api/invoices/${draft.id}`)).status, 409);
});

test('kundeendring påvirker ikke sendt faktura', async () => {
  const { draft, customer } = await setup();
  await call('POST', `/api/invoices/${draft.id}/send`);
  await call('PUT', `/api/customers/${customer.id}`, { ...customer, name: 'Nytt Navn AS' });
  assert.equal((await call('GET', `/api/invoices/${draft.id}`)).body.customer.name, 'Kunde AS');
});

test('kreditering lager kreditnota med neste nummer og negativ sum', async () => {
  const { draft } = await setup();
  const inv = (await call('POST', `/api/invoices/${draft.id}/send`)).body;
  const credit = await call('POST', `/api/invoices/${draft.id}/credit`);
  assert.equal(credit.status, 201);
  assert.equal(credit.body.kind, 'credit_note');
  assert.equal(credit.body.number, 1002);
  assert.equal(credit.body.totals.gross, -inv.totals.gross);
  assert.equal((await call('GET', `/api/invoices/${draft.id}`)).body.status, 'credited');
  assert.equal((await call('POST', `/api/invoices/${draft.id}/credit`)).status, 409);
});

test('kan ikke sende før firmaopplysninger er komplette', async () => {
  const customer = (await call('POST', '/api/customers', { name: 'Kunde', email: 'a@b.no' })).body;
  const draft = (await call('POST', '/api/invoices', { customerId: customer.id, lines: [{ description: 'x', quantity: 1, unitPrice: 100, vatRate: 25 }] })).body;
  const res = await call('POST', `/api/invoices/${draft.id}/send`);
  assert.equal(res.status, 409);
  assert.ok(res.body.details.includes('Mangler: Kontonummer'));
  // Nummerserien skal ikke ha hull etter et mislykket forsøk
  await call('PUT', '/api/company', company);
  assert.equal((await call('POST', `/api/invoices/${draft.id}/send`)).body.number, 1001);
});

test('e-postutsendelse krever e-post på kunden', async () => {
  await call('PUT', '/api/company', company);
  const customer = (await call('POST', '/api/customers', { name: 'Uten e-post' })).body;
  const draft = (await call('POST', '/api/invoices', { customerId: customer.id, lines: [{ description: 'x', quantity: 1, unitPrice: 100, vatRate: 25 }] })).body;
  const res = await call('POST', `/api/invoices/${draft.id}/send`);
  assert.equal(res.status, 400);
  assert.equal((await call('GET', `/api/invoices/${draft.id}`)).body.status, 'draft');
});

test('validering', async () => {
  const bad = await call('PUT', '/api/company', { ...company, orgNumber: '123456789', accountNumber: '12345678901' });
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.body.details, ['Ugyldig organisasjonsnummer', 'Ugyldig kontonummer']);
  const inv = await call('POST', '/api/invoices', { customerId: 999, lines: [] });
  assert.equal(inv.status, 400);
  assert.equal(inv.body.details[0], 'Velg en kunde');
});

test('ikke mva-registrert selger får fakturaer uten mva', async () => {
  await call('PUT', '/api/company', { ...company, vatRegistered: false });
  const customer = (await call('POST', '/api/customers', { name: 'Privat' })).body;
  const draft = (await call('POST', '/api/invoices', { customerId: customer.id, lines: [{ description: 'x', quantity: 2, unitPrice: 50_000, vatRate: 25 }] })).body;
  assert.equal(draft.totals.vat, 0);
  assert.equal(draft.totals.gross, 100_000);
});

test('kunde med fakturaer kan ikke slettes', async () => {
  const { customer } = await setup();
  assert.equal((await call('DELETE', `/api/customers/${customer.id}`)).status, 409);
});

test('PDF-endepunkt', async () => {
  const { draft } = await setup();
  const pdf = await app.inject({ method: 'GET', url: `/api/invoices/${draft.id}/pdf` });
  assert.equal(pdf.headers['content-type'], 'application/pdf');
  assert.equal(pdf.rawPayload.subarray(0, 4).toString(), '%PDF');
});

test('dashboard og filtrering', async () => {
  const { draft } = await setup();
  let dash = (await call('GET', '/api/dashboard')).body;
  assert.equal(dash.draftCount, 1);
  assert.deepEqual(dash.missingCompanyInfo, []);
  await call('POST', `/api/invoices/${draft.id}/send`);
  dash = (await call('GET', '/api/dashboard')).body;
  assert.equal(dash.outstandingCount, 1);
  assert.equal(dash.outstanding, draft.totals.gross);
  assert.equal((await call('GET', '/api/invoices?status=sent')).body.length, 1);
  assert.equal((await call('GET', '/api/invoices?status=draft')).body.length, 0);
});

test('oppslag i Enhetsregisteret', async () => {
  const hit = await call('GET', '/api/lookup/923609016');
  assert.equal(hit.body.name, 'EQUINOR ASA');
  assert.equal(hit.body.city, 'STAVANGER');
  assert.equal((await call('GET', '/api/lookup/123')).status, 404);
});
