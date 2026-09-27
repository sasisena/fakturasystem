import { expect, test } from '@playwright/test';
import { json, loginAs, outbox, resetData } from '../../lib/api';
import { ORG_A, ORG_B, user } from '../../lib/fixture';

test.beforeEach(resetData);

test('en bruker ser bare sin egen bedrift', async () => {
  const b = await loginAs('eier-b');
  const org = await json(await b.get('/api/organizations/current'));
  expect(org.id).toBe(ORG_B);
  expect(await json(await b.get('/api/organizations'))).toEqual([{ id: ORG_B, name: 'Nordlys Bakeri', role: 'eier', current: true }]);
  const team = await json(await b.get('/api/team'));
  expect(team.map((m: { email: string }) => m.email).sort()).toEqual(['nina@nordlys.example', 'rita@regnskap.example']);
});

test('kan ikke bytte til en bedrift man ikke er med i', async () => {
  const b = await loginAs('eier-b');
  expect((await b.post('/api/session/organization', { data: { orgId: ORG_A } })).status()).toBe(404);
  expect((await json(await b.get('/api/organizations/current'))).id).toBe(ORG_B);
});

test('kan ikke endre eller fjerne brukere i en annen bedrift', async () => {
  const b = await loginAs('eier-b');
  const kari = user('eier-a').id;
  expect((await b.patch(`/api/team/${kari}`, { data: { role: 'lesetilgang' } })).status()).toBe(404);
  expect((await b.delete(`/api/team/${kari}`)).status()).toBe(404);
  const a = await loginAs('eier-a');
  expect((await json(await a.get('/api/team'))).find((m: { userId: string }) => m.userId === kari).role).toBe('eier');
});

test('regnskapsfører med tilgang til to bedrifter ser én om gangen', async () => {
  const r = await loginAs('regnskap', { orgId: ORG_A });
  expect((await json(await r.get('/api/organizations'))).length).toBe(2);
  expect((await json(await r.get('/api/organizations/current'))).id).toBe(ORG_A);
  await json(await r.post('/api/session/organization', { data: { orgId: ORG_B } }));
  const b = await json(await r.get('/api/organizations/current'));
  expect(b.id).toBe(ORG_B);
  expect(b.name).toBe('Nordlys Bakeri');
});

test('revisjonsloggen og utboksen viser bare egen bedrift', async () => {
  const a = await loginAs('eier-a');
  await json(await a.put('/api/organizations/current', { data: { ...(await json(await a.get('/api/organizations/current'))), phone: '400 00 000' } }));
  await json(await a.post('/api/team', { data: { email: 'ny@fjellsno.example', role: 'fakturering' } }), 201);
  const b = await loginAs('eier-b');
  const log = await json(await b.get('/api/audit-log'));
  expect(log.filter((e: { action: string }) => e.action === 'firma_endret')).toEqual([]);
  expect((await json(await a.get('/api/audit-log'))).map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(['firma_endret', 'medlem_invitert']));
  expect((await outbox()).find((m) => m.to === 'ny@fjellsno.example').orgId).toBe(ORG_A);
});
