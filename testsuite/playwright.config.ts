import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './lib/env';

/**
 * Testene deler én database som tilbakestilles før hver test, derfor kjøres de én og én (workers: 1).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  globalSetup: './lib/global-setup.ts',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'resultater/html' }]],
  use: {
    baseURL: BASE_URL,
    locale: 'nb-NO',
    timezoneId: 'Europe/Oslo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'api', testDir: './tests/api' },
    { name: 'mobil', testDir: './tests/e2e', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', testDir: './tests/e2e', use: { ...devices['Desktop Chrome'] } },
  ],
});
