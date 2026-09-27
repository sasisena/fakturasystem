/**
 * Kontroller som kjøres før første API-kall:
 * - testmodus kan ikke slås på i produksjon med mindre databasen er merket som testdatabase
 * - i produksjon må databaserollen være underlagt RLS
 */
import { dbRoleBypassesRls, isMarkedTestDatabase } from './db';
import { assertConfig, config } from './env';

const g = globalThis as unknown as { __fakturaStarted?: Promise<void> };

export function ensureStarted(): Promise<void> {
  if (!g.__fakturaStarted) {
    g.__fakturaStarted = (async () => {
      assertConfig();
      if (config.testMode && config.production && !(await isMarkedTestDatabase())) {
        throw new Error('FAKTURA_TEST_MODE=true er ikke tillatt i produksjon uten en database merket som testdatabase.');
      }
      if (config.production && !config.testMode && (await dbRoleBypassesRls())) {
        throw new Error('Databaserollen kan gå forbi Row Level Security. Bruk en rolle uten SUPERUSER og BYPASSRLS.');
      }
      if (!config.production && (await dbRoleBypassesRls())) {
        console.warn('Advarsel: databaserollen går forbi RLS. Bruk en egen app-rolle.');
      }
    })().catch((e) => {
      g.__fakturaStarted = undefined;
      console.error(e instanceof Error ? e.message : 'Oppstarten feilet.');
      throw e;
    });
  }
  return g.__fakturaStarted;
}
