import { expect, test } from '@playwright/test';
import { json, loginAs, resetData } from '../../lib/api';
import { ORG_A, customer } from '../../lib/fixture';

test.beforeEach(resetData);

test('ny kunde får neste kundenummer i bedriften', async () => {
  const a = await loginAs('fakturering-a');
  const c = await json(await a.post('/api/customers', { data: { name: 'Solstråle Frisør', orgNumber: '923 609 016', email: 'Post@Solstraale.example', postalCode: '0150', city: 'Oslo' } }), 201);
  expect(c).toMatchObject({ customerNumber: 3, name: 'Solstråle Frisør', orgNumber: '923609016', email: 'post@solstraale.example' });
  const b = await loginAs('eier-b');
  expect((await json(await b.post('/api/customers', { data: { name: 'Ny kunde B' } }), 201)).customerNumber).toBe(2);
});

test('liste, søk, endre og slette', async () => {
  const a = await loginAs('eier-a');
  const list = await json(await a.get('/api/customers'));
  expect(list.map((c: { name: string }) => c.name)).toEqual(['Havbris Kafé AS', 'Ola Privat']);
  expect((await json(await a.get('/api/customers?q=havbris'))).length).toBe(1);
  expect((await json(await a.get('/api/customers?q=2')))[0].name).toBe('Ola Privat');
  const id = customer(1).id;
  const upd = await json(await a.put(`/api/customers/${id}`, { data: { ...customer(1), name: 'Ola Nordmann', customerNumber: 99 } }));
  expect(upd).toMatchObject({ name: 'Ola Nordmann', customerNumber: 2 });
  await json(await a.delete(`/api/customers/${id}`), 204);
  expect((await a.get(`/api/customers/${id}`)).status()).toBe(404);
});

test('kunde med fakturaer kan ikke slettes', async () => {
  const a = await loginAs('eier-a');
  const id = customer(0).id;
  await json(await a.post('/api/invoices', { data: { customerId: id, lines: [{ description: 'x', quantity: 1, unitPrice: 100, vatRate: 25 }] } }), 201);
  const r = await a.delete(`/api/customers/${id}`);
  expect(r.status()).toBe(409);
  expect((await r.json()).code).toBe('kunde_har_fakturaer');
});

test('validering', async () => {
  const a = await loginAs('eier-a');
  const r = await a.post('/api/customers', { data: { name: ' ', orgNumber: '123456789', email: 'feil', postalCode: '12' } });
  expect(r.status()).toBe(422);
  expect((await r.json()).errors.map((e: { field: string }) => e.field).sort()).toEqual(['email', 'name', 'orgNumber', 'postalCode']);
});

test('lesetilgang kan se, men ikke endre kunder', async () => {
  const r = await loginAs('regnskap', { orgId: ORG_A });
  expect((await json(await r.get('/api/customers'))).length).toBe(2);
  expect((await r.post('/api/customers', { data: { name: 'X' } })).status()).toBe(403);
  expect((await r.delete(`/api/customers/${customer(1).id}`)).status()).toBe(403);
});

test('kunder i en annen bedrift finnes ikke', async () => {
  const b = await loginAs('eier-b');
  const id = customer(0).id;
  expect((await b.get(`/api/customers/${id}`)).status()).toBe(404);
  expect((await b.put(`/api/customers/${id}`, { data: { name: 'Kapret' } })).status()).toBe(404);
  expect((await b.delete(`/api/customers/${id}`)).status()).toBe(404);
  expect((await json(await b.get('/api/customers'))).map((c: { name: string }) => c.name)).toEqual(['Polarkaffe']);
});
