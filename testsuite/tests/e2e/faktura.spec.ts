import { expect, test } from '@playwright/test';
import { resetData } from '../../lib/api';
import { user } from '../../lib/fixture';

test.beforeEach(resetData);

/** Logger inn i nettleseren via testinnlogging (samme cookie som vanlig innlogging). */
async function login(page: import('@playwright/test').Page, key: string) {
  const r = await page.request.post('/api/test/login', { data: { userId: user(key).id } });
  expect(r.status()).toBe(200);
}

test('lage faktura med ny kunde, produkt og flere mva-satser, og se PDF', async ({ page }) => {
  await login(page, 'fakturering-a');
  await page.goto('/app');
  await page.getByRole('link', { name: 'Ny faktura' }).first().click();
  await expect(page.getByRole('heading', { name: 'Ny faktura' })).toBeVisible();

  await page.getByRole('button', { name: 'Ny kunde' }).click();
  await page.getByLabel('Navn').fill('Solstråle Frisør');
  await page.getByLabel('E-post').fill('post@solstraale.example');
  await page.getByRole('button', { name: 'Legg til og velg' }).click();
  await expect(page.getByLabel('Kunde', { exact: true })).toHaveValue(/.+/);

  await page.getByLabel('Produkt på linje 1').selectOption({ label: 'Designtime – 1\u00a0100 kr/timer' });
  await expect(page.getByLabel('Beskrivelse', { exact: true })).toHaveValue('Designtime');
  await page.getByLabel('Antall (timer)').fill('2,5');
  await page.getByRole('button', { name: '+ Legg til linje' }).click();
  await page.getByLabel('Beskrivelse', { exact: true }).nth(1).fill('Hårprodukter');
  await page.getByLabel('Pris eks. mva', { exact: true }).nth(1).fill('200');
  await page.getByLabel('Mva', { exact: true }).nth(1).selectOption('15');

  // 2,5 × 1 100 = 2 750 + 25 % = 3 437,50; 200 + 15 % = 230 → 3 667,50
  await expect(page.getByText('3 667,50 kr').first()).toBeVisible();
  await page.getByRole('button', { name: 'Lagre utkast' }).click();

  await expect(page.getByRole('heading', { name: 'Faktura til Solstråle Frisør' })).toBeVisible();
  await expect(page.getByText('Utkast', { exact: true })).toBeVisible();
  const pdf = await page.request.get(page.url().replace('/app/fakturaer/', '/api/invoices/') + '/pdf');
  expect(pdf.headers()['content-type']).toBe('application/pdf');

  await page.getByRole('link', { name: 'Endre' }).click();
  await page.getByRole('button', { name: 'Fjern linje 2' }).click();
  await page.getByRole('button', { name: 'Lagre endringer' }).click();
  await expect(page.getByText('3 437,50 kr').first()).toBeVisible();
});

test('lesetilgang ser fakturaer, men kan ikke lage nye', async ({ page }) => {
  await login(page, 'regnskap');
  await page.request.post('/api/session/organization', { data: { orgId: '0a000000-0000-4000-8000-000000000001' }, headers: { 'X-CSRF-Token': (await page.context().cookies()).find((c) => c.name === 'faktura_csrf')!.value } });
  await page.goto('/app/fakturaer');
  await expect(page.getByRole('heading', { name: 'Fakturaer' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'Ny faktura' })).toHaveCount(0);
  await page.goto('/app/fakturaer/ny');
  await expect(page).toHaveURL(/\/app\/fakturaer$/);
});
