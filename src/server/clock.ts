/**
 * Klokke for hele løsningen. I testmodus kan klokken settes med POST /api/test/clock,
 * og tiden går videre fra det tidspunktet. Ellers brukes systemklokken.
 */
import { config } from './env';

export const DEFAULT_TEST_NOW = '2026-09-24T12:00:00+02:00';

const g = globalThis as unknown as { __fakturaClockOffset?: number };
if (config.testMode && g.__fakturaClockOffset === undefined) {
  g.__fakturaClockOffset = Date.parse(DEFAULT_TEST_NOW) - Date.now();
}

export function now(): Date {
  return new Date(Date.now() + (config.testMode ? (g.__fakturaClockOffset ?? 0) : 0));
}

export function setClock(iso: string): void {
  if (!config.testMode) throw new Error('Klokken kan bare settes i testmodus.');
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error('Ugyldig tidspunkt.');
  g.__fakturaClockOffset = t - Date.now();
}

/** Dagens dato i norsk tid (Europe/Oslo) som YYYY-MM-DD. */
export function todayOslo(d: Date = now()): string {
  return osloDate(d);
}

export function osloDate(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Oslo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return parts; // en-CA gir YYYY-MM-DD
}
