import { expect, test } from '@playwright/test';
import { json, loginAs, outbox, resetData } from '../../lib/api';
import { ORG_A, user } from '../../lib/fixture';

test.beforeEach(resetData);

test('administrator gir en ny person tilgang, og personen får e-post', async () => {
  const ctx = await loginAs('admin-a');
  const r = await json(await ctx.post('/api/team', { data: { email: 'Ny.Kollega@Fjellsno.example', role: 'fakturering' } }), 201);
  expect(r).toMatchObject({ email: 'ny.kollega@fjellsno.example', role: 'fakturering' });
  const mail = (await outbox()).find((m) => m.to === 'ny.kollega@fjellsno.example');
  expect(mail.subject).toContain('Fjellsnø Design AS');
  const team = await json(await ctx.get('/api/team'));
  expect(team.find((m: { email: string }) => m.email === 'ny.kollega@fjellsno.example')).toMatchObject({ role: 'fakturering', invited: true });
  expect((await ctx.post('/api/team', { data: { email: 'ny.kollega@fjellsno.example', role: 'lesetilgang' } })).status()).toBe(409);
});

test('invitert person kan logge inn og ser bedriften', async () => {
  const a = await loginAs('eier-a');
  await json(await a.post('/api/team', { data: { email: 'nina@nordlys.example', role: 'lesetilgang' } }), 201);
  const nina = await loginAs('eier-b', { orgId: ORG_A });
  expect((await json(await nina.get('/api/organizations/current'))).name).toBe('Fjellsnø Design AS');
  expect((await nina.put('/api/organizations/current', { data: { name: 'X' } })).status()).toBe(403);
});

test('bare eier kan gi eller ta fra eierrollen', async () => {
  const admin = await loginAs('admin-a');
  expect((await admin.post('/api/team', { data: { email: 'x@fjellsno.example', role: 'eier' } })).status()).toBe(403);
  expect((await admin.patch(`/api/team/${user('fakturering-a').id}`, { data: { role: 'eier' } })).status()).toBe(403);
  expect((await admin.patch(`/api/team/${user('eier-a').id}`, { data: { role: 'lesetilgang' } })).status()).toBe(403);
  const owner = await loginAs('eier-a');
  await json(await owner.patch(`/api/team/${user('admin-a').id}`, { data: { role: 'eier' } }));
});

test('bedriften har alltid minst én eier', async () => {
  const owner = await loginAs('eier-a');
  const me = user('eier-a').id;
  const r = await owner.patch(`/api/team/${me}`, { data: { role: 'administrator' } });
  expect(r.status()).toBe(409);
  expect((await r.json()).code).toBe('siste_eier');
  expect((await owner.delete(`/api/team/${me}`)).status()).toBe(409);
});

test('fakturering og lesetilgang kan ikke endre brukere, men kan fjerne seg selv', async () => {
  const per = await loginAs('fakturering-a');
  expect((await per.post('/api/team', { data: { email: 'x@fjellsno.example', role: 'lesetilgang' } })).status()).toBe(403);
  expect((await per.delete(`/api/team/${user('admin-a').id}`)).status()).toBe(403);
  expect((await per.get('/api/audit-log')).status()).toBe(403);
  await json(await per.delete(`/api/team/${user('fakturering-a').id}`), 204);
  const owner = await loginAs('eier-a');
  expect((await json(await owner.get('/api/team'))).some((m: { email: string }) => m.email === 'per@fjellsno.example')).toBe(false);
});

test('ugyldig rolle eller e-post gir 422', async () => {
  const ctx = await loginAs('eier-a');
  expect((await ctx.post('/api/team', { data: { email: 'ikke-epost', role: 'fakturering' } })).status()).toBe(422);
  expect((await ctx.post('/api/team', { data: { email: 'a@b.no', role: 'sjef' } })).status()).toBe(422);
});
