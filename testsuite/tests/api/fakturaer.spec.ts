import { expect, test } from '@playwright/test';
import { json, loginAs, resetData } from '../../lib/api';
import { ORG_A, customer, product } from '../../lib/fixture';

test.beforeEach(resetData);

const lines = [
  { description: 'Rådgivning', quantity: 7.5, unit: 'timer', unitPrice: 120000, vatRate: 25 },
  { description: 'Lunsj til workshop', quantity: 3, unitPrice: 15000, vatRate: 15 },
  { description: 'Reise', quantity: 1, unitPrice: 50000, vatRate: 12 },
  { description: 'Fagbok', quantity: 1, unitPrice: 39900, vatRate: 0 },
];

test('utkast med flere mva-satser regnes riktig', async () => {
  const a = await loginAs('fakturering-a');
  const inv = await json(await a.post('/api/invoices', { data: { customerId: customer(0).id, theirReference: 'Kari', note: 'Takk!', lines } }), 201);
  expect(inv).toMatchObject({ status: 'utkast', theirReference: 'Kari', note: 'Takk!', vatRegistered: true, customer: { name: 'Havbris Kafé AS', customerNumber: 1 } });
  expect(inv.lines.map((l: { net: number }) => l.net)).toEqual([900000, 45000, 50000, 39900]);
  expect(inv.totals).toEqual({
    net: 1034900,
    vat: 225000 + 6750 + 6000,
    gross: 1034900 + 237750,
    vatBreakdown: [
      { rate: 25, base: 900000, vat: 225000 },
      { rate: 15, base: 45000, vat: 6750 },
      { rate: 12, base: 50000, vat: 6000 },
      { rate: 0, base: 39900, vat: 0 },
    ],
  });
  expect(await json(await a.get(`/api/invoices/${inv.id}`))).toEqual(inv);
});

test('mva rundes til hele øre per sats', async () => {
  const a = await loginAs('eier-a');
  const inv = await json(await a.post('/api/invoices', { data: { customerId: customer(0).id, lines: [
    { description: 'a', quantity: 1.333, unitPrice: 999, vatRate: 25 },
    { description: 'b', quantity: 1, unitPrice: 1, vatRate: 25 },
  ] } }), 201);
  // 1,333 × 9,99 kr = 13,31667 kr → 1332 øre; + 1 øre = 1333 øre grunnlag; 25 % = 333,25 → 333 øre
  expect(inv.totals).toMatchObject({ net: 1333, vat: 333, gross: 1666 });
});

test('bedrift uten mva-registrering lager fakturaer uten mva', async () => {
  const b = await loginAs('eier-b');
  const inv = await json(await b.post('/api/invoices', { data: { customerId: customer(2).id, lines: [{ productId: product(1).id, description: 'Rundstykker', quantity: 40, unitPrice: 1500, vatRate: 15 }] } }), 201);
  expect(inv.vatRegistered).toBe(false);
  expect(inv.lines[0].vatRate).toBe(0);
  expect(inv.totals).toEqual({ net: 60000, vat: 0, gross: 60000, vatBreakdown: [{ rate: 0, base: 60000, vat: 0 }] });
});

test('endre, liste og slette utkast', async () => {
  const a = await loginAs('eier-a');
  const inv = await json(await a.post('/api/invoices', { data: { customerId: customer(0).id, lines } }), 201);
  const upd = await json(await a.put(`/api/invoices/${inv.id}`, { data: { customerId: customer(1).id, lines: [{ description: 'Kun én linje', quantity: 2, unitPrice: 50000, vatRate: 25 }] } }));
  expect(upd).toMatchObject({ customer: { name: 'Ola Privat' }, totals: { net: 100000, vat: 25000, gross: 125000 } });
  expect(upd.lines).toHaveLength(1);
  const list = await json(await a.get('/api/invoices'));
  expect(list).toEqual([expect.objectContaining({ id: inv.id, status: 'utkast', customerName: 'Ola Privat', customerNumber: 2, gross: 125000 })]);
  expect(await json(await a.get(`/api/invoices?customerId=${customer(0).id}`))).toEqual([]);
  await json(await a.delete(`/api/invoices/${inv.id}`), 204);
  expect((await a.get(`/api/invoices/${inv.id}`)).status()).toBe(404);
});

test('validering av linjer', async () => {
  const a = await loginAs('eier-a');
  const r = await a.post('/api/invoices', { data: { customerId: customer(0).id, lines: [{ description: '', quantity: 0, unitPrice: 1.5, vatRate: 8 }, { description: 'x', quantity: 1.0001, unitPrice: 1, vatRate: 25 }] } });
  expect(r.status()).toBe(422);
  expect((await r.json()).errors.map((e: { field: string }) => e.field).sort()).toEqual(['lines.0.description', 'lines.0.quantity', 'lines.0.unitPrice', 'lines.0.vatRate', 'lines.1.quantity']);
  expect((await a.post('/api/invoices', { data: { customerId: customer(0).id, lines: [] } })).status()).toBe(422);
  const neg = await a.post('/api/invoices', { data: { customerId: customer(0).id, lines: [{ description: 'Rabatt', quantity: 1, unitPrice: -100, vatRate: 25 }] } });
  expect(neg.status()).toBe(422);
  const discount = await a.post('/api/invoices', { data: { customerId: customer(0).id, lines: [{ description: 'Tjeneste', quantity: 1, unitPrice: 1000, vatRate: 25 }, { description: 'Rabatt', quantity: 1, unitPrice: -100, vatRate: 25 }] } });
  expect((await json(discount, 201)).totals.net).toBe(900);
});

test('kunde og produkt fra en annen bedrift avvises uten å avsløre at de finnes', async () => {
  const b = await loginAs('eier-b');
  const r = await b.post('/api/invoices', { data: { customerId: customer(0).id, lines: [{ description: 'x', quantity: 1, unitPrice: 1, vatRate: 0 }] } });
  expect(r.status()).toBe(422);
  expect((await r.json()).errors[0].field).toBe('customerId');
  const p = await b.post('/api/invoices', { data: { customerId: customer(2).id, lines: [{ productId: product(0).id, description: 'x', quantity: 1, unitPrice: 1, vatRate: 0 }] } });
  expect(p.status()).toBe(422);
  expect((await p.json()).errors[0].field).toBe('lines.0.productId');
});

test('fakturaer i en annen bedrift finnes ikke', async () => {
  const a = await loginAs('eier-a');
  const inv = await json(await a.post('/api/invoices', { data: { customerId: customer(0).id, lines } }), 201);
  const b = await loginAs('eier-b');
  for (const r of [await b.get(`/api/invoices/${inv.id}`), await b.get(`/api/invoices/${inv.id}/pdf`), await b.put(`/api/invoices/${inv.id}`, { data: { customerId: customer(2).id, lines } }), await b.delete(`/api/invoices/${inv.id}`)]) {
    expect(r.status()).toBe(404);
  }
  expect(await json(await b.get('/api/invoices'))).toEqual([]);
});

test('lesetilgang kan se og laste ned PDF, men ikke endre', async () => {
  const a = await loginAs('eier-a');
  const inv = await json(await a.post('/api/invoices', { data: { customerId: customer(0).id, lines } }), 201);
  const r = await loginAs('regnskap', { orgId: ORG_A });
  expect((await json(await r.get(`/api/invoices/${inv.id}`))).id).toBe(inv.id);
  const pdf = await r.get(`/api/invoices/${inv.id}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
  expect((await r.post('/api/invoices', { data: { customerId: customer(0).id, lines } })).status()).toBe(403);
  expect((await r.delete(`/api/invoices/${inv.id}`)).status()).toBe(403);
});
