// Norske kontrollsiffer-algoritmer: organisasjonsnummer, kontonummer og KID.

const digitsOnly = (value: string): string => value.replace(/[\s.]/g, '');

/** MOD11 med vekter lest fra høyre. Returnerer null når kontrollsiffer blir 10 (ugyldig). */
function mod11CheckDigit(digits: string, weights: number[]): number | null {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += Number(digits[digits.length - 1 - i]) * weights[weights.length - 1 - i];
  }
  const rest = sum % 11;
  if (rest === 0) return 0;
  if (rest === 1) return null;
  return 11 - rest;
}

/** Organisasjonsnummer: 9 siffer, MOD11 med vekter 3,2,7,6,5,4,3,2. */
export function isValidOrgNumber(value: string): boolean {
  const d = digitsOnly(value);
  if (!/^\d{9}$/.test(d)) return false;
  return mod11CheckDigit(d.slice(0, 8), [3, 2, 7, 6, 5, 4, 3, 2]) === Number(d[8]);
}

/** Norsk bankkontonummer: 11 siffer, MOD11 med vekter 5,4,3,2,7,6,5,4,3,2. */
export function isValidAccountNumber(value: string): boolean {
  const d = digitsOnly(value);
  if (!/^\d{11}$/.test(d)) return false;
  return mod11CheckDigit(d.slice(0, 10), [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]) === Number(d[10]);
}

/** Formaterer kontonummer som 1234.56.78903. */
export function formatAccountNumber(value: string): string {
  const d = digitsOnly(value);
  return d.length === 11 ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}` : value;
}

/** MOD10 (Luhn) kontrollsiffer for KID. */
export function kidMod10CheckDigit(base: string): number {
  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    let n = Number(base[base.length - 1 - i]);
    if (i % 2 === 0) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidKid(value: string): boolean {
  const d = digitsOnly(value);
  if (!/^\d{2,25}$/.test(d)) return false;
  return kidMod10CheckDigit(d.slice(0, -1)) === Number(d[d.length - 1]);
}

/**
 * Lager KID av kundenummer (5 siffer) + fakturanummer (7 siffer) + MOD10-kontrollsiffer.
 * Fast lengde gjør det enkelt å sette opp KID-avtale i banken senere.
 */
export function generateKid(customerNumber: number, invoiceNumber: number): string {
  const base = String(customerNumber).padStart(5, '0') + String(invoiceNumber).padStart(7, '0');
  return base + kidMod10CheckDigit(base);
}
