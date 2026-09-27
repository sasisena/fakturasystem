import { expect, test } from '@playwright/test';
import { json, loginAs, loginNewUser, resetData } from '../../lib/api';

test.beforeEach(resetData);

test('validering av firmaopplysninger gir norske feilmeldinger per felt', async () => {
  const ctx = await loginNewUser('ny@eksempel.example');
  const r = await ctx.post('/api/organizations', { data: { name: '', orgNumber: '123456789', accountNumber: '12345678901', email: 'feil', postalCode: '12', paymentTermsDays: 365 } });
  expect(r.status()).toBe(422);
  const fields = (await r.json()).errors.map((e: { field: string }) => e.field).sort();
  expect(fields).toEqual(['accountNumber', 'email', 'name', 'orgNumber', 'paymentTermsDays', 'postalCode']);
});

test('eier endrer firmaopplysninger, og endringen logges', async () => {
  const ctx = await loginAs('eier-a');
  const before = await json(await ctx.get('/api/organizations/current'));
  expect(before.missingForInvoicing).toEqual([]);
  const after = await json(await ctx.put('/api/organizations/current', { data: { ...before, city: 'Bergen', paymentTermsDays: 30 } }));
  expect(after).toMatchObject({ city: 'Bergen', paymentTermsDays: 30 });
  const log = await json(await ctx.get('/api/audit-log'));
  expect(log[0]).toMatchObject({ action: 'firma_endret', before: { city: 'Oslo', paymentTermsDays: 14 }, after: { city: 'Bergen', paymentTermsDays: 30 } });
});

test('fakturering og lesetilgang kan se, men ikke endre firmaopplysninger', async () => {
  for (const key of ['fakturering-a', 'regnskap']) {
    const ctx = await loginAs(key, { orgId: '0a000000-0000-4000-8000-000000000001' });
    const org = await json(await ctx.get('/api/organizations/current'));
    expect((await ctx.put('/api/organizations/current', { data: { ...org, name: 'Kapret' } })).status(), key).toBe(403);
  }
});

test('oppslag i Enhetsregisteret', async () => {
  const ctx = await loginNewUser('ny@eksempel.example');
  expect(await json(await ctx.get('/api/lookup/923 609 016'))).toMatchObject({ name: 'FJELLSNØ DESIGN AS', organizationForm: 'AS', vatRegistered: true });
  expect((await ctx.get('/api/lookup/123456789')).status()).toBe(404);
});

test('en bruker kan være med i flere bedrifter og bytte mellom dem', async () => {
  const ctx = await loginAs('eier-b');
  const created = await json(await ctx.post('/api/organizations', { data: { name: 'Nordlys Catering' } }), 201);
  expect((await json(await ctx.get('/api/organizations/current'))).id).toBe(created.id);
  expect((await json(await ctx.get('/api/organizations'))).map((o: { name: string }) => o.name)).toEqual(['Nordlys Bakeri', 'Nordlys Catering']);
});
