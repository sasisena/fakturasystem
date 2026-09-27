import { expect, test } from '@playwright/test';
import { json, loginAs, outbox, resetData } from '../../lib/api';
import { customer, user } from '../../lib/fixture';

test.beforeEach(resetData);

test('sende utkast på e-post, merke som betalt og kreditere', async ({ page }) => {
  const a = await loginAs('eier-a');
  const draft = await json(await a.post('/api/invoices', { data: { customerId: customer(0).id, lines: [{ description: 'Rådgivning', quantity: 2, unitPrice: 100000, vatRate: 25 }] } }), 201);
  await page.request.post('/api/test/login', { data: { userId: user('fakturering-a').id } });

  await page.goto(`/app/fakturaer/${draft.id}`);
  await expect(page.getByLabel('Send på e-post')).toBeChecked();
  await page.getByRole('button', { name: 'Send på e-post' }).click();
  await expect(page.getByText('Når fakturaen er sendt, kan den ikke endres eller slettes.')).toBeVisible();
  await page.getByRole('button', { name: 'Ja, send fakturaen' }).click();

  await expect(page.getByRole('heading', { name: 'Faktura 1' })).toBeVisible();
  await expect(page.getByText('Ubetalt')).toBeVisible();
  await expect(page.getByText('Sendt på e-post til post@havbris.example')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Endre' })).toHaveCount(0);
  expect((await outbox()).some((m) => m.invoiceId === draft.id && m.hasAttachment)).toBe(true);

  await page.getByRole('button', { name: 'Merk som betalt' }).click();
  await expect(page.getByText(/^Betalt \d\d\.\d\d\.\d{4}$/)).toBeVisible();

  await page.getByRole('button', { name: 'Krediter' }).click();
  await page.getByRole('button', { name: 'Ja, krediter' }).click();
  await expect(page.getByRole('heading', { name: 'Kreditnota 2' })).toBeVisible();
  await page.getByRole('link', { name: 'faktura 1' }).click();
  await expect(page.getByText('Kreditert', { exact: true })).toBeVisible();

  await page.goto('/app/fakturaer?status=kreditert');
  await expect(page.getByText('Nr. 1 · forfall')).toBeVisible();
});

test('bedrift uten kontonummer blir bedt om å fylle det ut før utsending', async ({ page }) => {
  const b = await loginAs('eier-b');
  const draft = await json(await b.post('/api/invoices', { data: { customerId: customer(2).id, lines: [{ description: 'Brød', quantity: 1, unitPrice: 5000, vatRate: 0 }] } }), 201);
  await page.request.post('/api/test/login', { data: { userId: user('eier-b').id } });
  await page.goto(`/app/fakturaer/${draft.id}`);
  await expect(page.getByText('Før du kan sende, må du fylle ut organisasjonsnummer, kontonummer')).toBeVisible();
  await expect(page.getByRole('button', { name: /Send på e-post|Lag ferdig faktura/ })).toHaveCount(0);
});
