import { expect, test } from 'vitest';
import {
  addDays,
  canTransition,
  formatAccountNumber,
  generateKid,
  invoiceTotals,
  isOverdue,
  isValidAccountNumber,
  isValidKid,
  isValidOrgNumber,
  kidMod10CheckDigit,
  lineTotals,
  formatNok,
  parseKroner,
  validateLines,
} from '@/lib/faktura';

const eq = (a: unknown, b: unknown) => expect(a).toBe(b);
const deq = (a: unknown, b: unknown) => expect(a).toEqual(b);

test('organisasjonsnummer', () => {
  eq(isValidOrgNumber('923609016'), true);
  eq(isValidOrgNumber('923 609 016'), true);
  eq(isValidOrgNumber('923609017'), false);
  eq(isValidOrgNumber('12345'), false);
});

test('kontonummer', () => {
  eq(isValidAccountNumber('86011117947'), true);
  eq(isValidAccountNumber('8601.11.17947'), true);
  eq(isValidAccountNumber('86011117948'), false);
  eq(formatAccountNumber('86011117947'), '8601.11.17947');
});

test('KID MOD10', () => {
  eq(kidMod10CheckDigit('7992739871'), 3);
  const kid = generateKid(12, 1001);
  eq(kid.length, 13);
  eq(kid.slice(0, 12), '000120001001');
  eq(isValidKid(kid), true);
  eq(isValidKid(kid.slice(0, -1) + ((Number(kid.at(-1)) + 1) % 10)), false);
});

test('linjesummer runder til hele øre', () => {
  deq(lineTotals({ description: 'x', quantity: 1.5, unitPrice: 99_999, vatRate: 25 }), {
    net: 149_999,
    vat: 37_500,
    gross: 187_499,
  });
});

test('fakturasum med flere mva-satser', () => {
  const totals = invoiceTotals([
    { description: 'Konsulent', quantity: 10, unitPrice: 100_000, vatRate: 25 },
    { description: 'Mat', quantity: 2, unitPrice: 5_000, vatRate: 15 },
    { description: 'Bok', quantity: 1, unitPrice: 20_000, vatRate: 0 },
  ]);
  eq(totals.net, 1_030_000);
  eq(totals.vat, 251_500);
  eq(totals.gross, 1_281_500);
  deq(totals.vatBreakdown.map((b) => b.rate), [25, 15, 0]);
});

test('ikke mva-registrert gir null mva', () => {
  const totals = invoiceTotals([{ description: 'x', quantity: 1, unitPrice: 10_000, vatRate: 25 }], false);
  eq(totals.vat, 0);
  eq(totals.gross, 10_000);
});

test('validering av linjer', () => {
  deq(validateLines([]), ['Fakturaen må ha minst én linje']);
  eq(validateLines([{ description: '', quantity: 0, unitPrice: 1.5, vatRate: 8 }]).length, 4);
  deq(validateLines([{ description: 'ok', quantity: 1, unitPrice: 100, vatRate: 25 }]), []);
});

test('statusoverganger', () => {
  eq(canTransition('draft', 'sent'), true);
  eq(canTransition('draft', 'paid'), false);
  eq(canTransition('sent', 'paid'), true);
  eq(canTransition('credited', 'paid'), false);
});

test('datoer og forfall', () => {
  eq(addDays('2026-12-20', 14), '2027-01-03');
  eq(isOverdue('sent', '2026-09-01', '2026-09-27'), true);
  eq(isOverdue('paid', '2026-09-01', '2026-09-27'), false);
});

test('parsing av kronebeløp', () => {
  eq(parseKroner('1 234,50'), 123_450);
  eq(parseKroner('1234.5'), 123_450);
  eq(parseKroner('kr 99'), 9_900);
  eq(parseKroner('-10'), -1_000);
  eq(parseKroner('abc'), null);
  eq(parseKroner('1,234'), null);
});

test('formatering av kronebeløp', () => {
  eq(formatNok(120_000).replace(/\s/g, ' '), '1 200 kr');
  eq(formatNok(123_450).replace(/\s/g, ' '), '1 234,50 kr');
});
