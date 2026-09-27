import { expect, test } from '@playwright/test';
import { json, loginAs, resetData } from '../../lib/api';
import { ORG_A, customer, product } from '../../lib/fixture';

test.beforeEach(resetData);

test('opprette, endre og slette produkter', async () => {
  const a = await loginAs('fakturering-a');
  const p = await json(await a.post('/api/products', { data: { name: 'Logopakke', unit: 'stk', unitPrice: 750000, vatRate: 25 } }), 201);
  expect(p).toMatchObject({ name: 'Logopakke', unit: 'stk', unitPrice: 750000, vatRate: 25 });
  expect((await json(await a.get('/api/products'))).map((x: { name: string }) => x.name)).toEqual(['Designtime', 'Logopakke']);
  expect(await json(await a.put(`/api/products/${p.id}`, { data: { ...p, unitPrice: 800000 } }))).toMatchObject({ unitPrice: 800000 });
  await json(await a.delete(`/api/products/${p.id}`), 204);
});

test('fakturalinjen beholder tekst og pris når produktet endres eller slettes', async () => {
  const a = await loginAs('eier-a');
  const p = product(0);
  const inv = await json(await a.post('/api/invoices', { data: { customerId: customer(0).id, lines: [{ productId: p.id, description: p.name, quantity: 2, unit: p.unit, unitPrice: p.unitPrice, vatRate: 25 }] } }), 201);
  await json(await a.put(`/api/products/${p.id}`, { data: { ...p, name: 'Ny tekst', unitPrice: 1 } }));
  await json(await a.delete(`/api/products/${p.id}`), 204);
  const after = await json(await a.get(`/api/invoices/${inv.id}`));
  expect(after.lines[0]).toMatchObject({ description: 'Designtime', unitPrice: 110000, productId: null });
});

test('validering', async () => {
  const a = await loginAs('eier-a');
  const r = await a.post('/api/products', { data: { name: '', unitPrice: 10.5, vatRate: 8 } });
  expect(r.status()).toBe(422);
  expect((await r.json()).errors.map((e: { field: string }) => e.field).sort()).toEqual(['name', 'unitPrice', 'vatRate']);
});

test('lesetilgang og andre bedrifter', async () => {
  const r = await loginAs('regnskap', { orgId: ORG_A });
  expect((await r.post('/api/products', { data: { name: 'X', unitPrice: 1, vatRate: 25 } })).status()).toBe(403);
  const b = await loginAs('eier-b');
  expect((await json(await b.get('/api/products'))).map((x: { name: string }) => x.name)).toEqual(['Rundstykker']);
  expect((await b.put(`/api/products/${product(0).id}`, { data: { name: 'X', unitPrice: 1, vatRate: 25 } })).status()).toBe(404);
});
