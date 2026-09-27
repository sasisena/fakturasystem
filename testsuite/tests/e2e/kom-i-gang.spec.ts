import { expect, test } from '@playwright/test';
import { lastCode, resetData, totp } from '../../lib/api';

test.beforeEach(resetData);

test('ny bruker registrerer bedrift, setter opp tofaktor og gir regnskapsfører tilgang', async ({ page }, info) => {
  const email = `ny-${info.project.name}@eksempel.example`;
  await page.goto('/');
  await page.getByRole('link', { name: 'Kom i gang gratis' }).click();

  await page.getByLabel('E-post').fill(email);
  await page.getByRole('button', { name: 'Send kode' }).click();
  await page.getByLabel('Kode fra e-posten').fill(await lastCode(email));
  await page.getByRole('button', { name: 'Logg inn' }).click();

  await expect(page.getByRole('heading', { name: 'Registrer bedriften din' })).toBeVisible();
  await page.getByLabel('Organisasjonsnummer').fill('923 609 016');
  await expect(page.getByLabel('Navn på bedriften')).toHaveValue('FJELLSNØ DESIGN AS');
  await expect(page.getByLabel('Registrert i Merverdiavgiftsregisteret (mva)')).toBeChecked();
  await page.getByLabel('Kontonummer').fill('1234.56.78901');
  await page.getByRole('button', { name: 'Registrer bedriften' }).click();
  await expect(page.getByText('Kontonummeret må ha 11 siffer og være gyldig').first()).toBeVisible();
  await page.getByLabel('Kontonummer').fill('8601.11.17947');
  await page.getByRole('button', { name: 'Registrer bedriften' }).click();

  await expect(page.getByRole('heading', { name: 'Sett opp tofaktor' })).toBeVisible();
  await expect(page.getByAltText('QR-kode for autentiseringsappen')).toBeVisible();
  const secret = (await page.locator('p.font-mono').textContent())!.replace(/\s/g, '');
  await page.getByLabel('Kode fra appen').fill(totp(secret));
  await page.getByRole('button', { name: 'Bekreft' }).click();

  await expect(page.getByRole('heading', { name: 'Kom i gang' })).toBeVisible();
  await expect(page.getByText('Firmaopplysningene er komplette')).toBeVisible();

  // På mobil ligger «Brukere» under «Mer» i bunnmenyen (fra fase 2).
  const menu = page.getByRole('navigation', { name: 'Hovedmeny' });
  if (info.project.name === 'mobil') await menu.getByRole('link', { name: 'Mer' }).click();
  await page.getByRole('link', { name: 'Brukere' }).first().click();
  await page.getByLabel('E-post').fill('regnskap@eksempel.example');
  await page.getByLabel('Rolle', { exact: true }).selectOption('lesetilgang');
  await page.getByRole('button', { name: 'Gi tilgang' }).click();
  await expect(page.getByText('regnskap@eksempel.example har fått tilgang')).toBeVisible();
  await expect(page.getByText('Invitert')).toBeVisible();
});

test('sidene i appen krever innlogging', async ({ page }) => {
  await page.goto('/app/firma');
  await expect(page).toHaveURL(/\/logg-inn\?neste=/);
});
