/**
 * Miljøvariabler og oppstartskontroller. Hemmeligheter finnes bare i miljøvariabler.
 */
export const config = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  appSecret: process.env.APP_SECRET ?? '',
  appUrl: process.env.APP_URL ?? '',
  testMode: process.env.FAKTURA_TEST_MODE === 'true',
  production: process.env.NODE_ENV === 'production',
  emailFrom: process.env.EMAIL_FROM ?? 'Fakturasystem <ikke-svar@example.no>',
  smtpUrl: process.env.SMTP_URL ?? '',
  /**
   * Passord til testsiden /test/koder (bare i testmiljøet). Tom verdi = siden finnes ikke.
   * Siden viser innloggingskoder og tofaktor-koder for alle brukere, og skal aldri slås på i produksjon.
   */
  testPagePassword: process.env.TEST_PAGE_PASSWORD ?? '',
};

export function assertConfig(): void {
  if (!config.databaseUrl) throw new Error('DATABASE_URL mangler.');
  if (config.appSecret.length < 32) throw new Error('APP_SECRET må være minst 32 tegn.');
  if (config.testPagePassword && config.testPagePassword.length < 12) throw new Error('TEST_PAGE_PASSWORD må være minst 12 tegn.');
}
