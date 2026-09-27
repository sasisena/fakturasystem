import { test } from 'node:test';
import assert from 'node:assert/strict';
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
} from '../src/index.ts';

test('organisasjonsnummer', () => {
  assert.equal(isValidOrgNumber('923609016'), true);
  assert.equal(isValidOrgNumber('923 609 016'), true);
  assert.equal(isValidOrgNumber('923609017'), false);
  assert.equal(isValidOrgNumber('12345'), false);
});

test('kontonummer', () => {
  assert.equal(isValidAccountNumber('86011117947'), true);
  assert.equal(isValidAccountNumber('8601.11.17947'), true);
  assert.equal(isValidAccountNumber('86011117948'), false);
  assert.equal(formatAccountNumber('86011117947'), '8601.11.17947');
});

test('KID MOD10', () => {
  assert.equal(kidMod10CheckDigit('7992739871'), 3);
  const kid = generateKid(12, 1001);
  assert.equal(kid.length, 13);
  assert.equal(kid.slice(0, 12), '000120001001');
  assert.equal(isValidKid(kid), true);
  assert.equal(isValidKid(kid.slice(0, -1) + ((Number(kid.at(-1)) + 1) % 10)), false);
});

test('linjesummer runder til hele øre', () => {
  assert.deepEqual(lineTotals({ description: 'x', quantity: 1.5, unitPrice: 99_999, vatRate: 25 }), {
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
  assert.equal(totals.net, 1_030_000);
  assert.equal(totals.vat, 251_500);
  assert.equal(totals.gross, 1_281_500);
  assert.deepEqual(totals.vatBreakdown.map((b) => b.rate), [25, 15, 0]);
});

test('ikke mva-registrert gir null mva', () => {
  const totals = invoiceTotals([{ description: 'x', quantity: 1, unitPrice: 10_000, vatRate: 25 }], false);
  assert.equal(totals.vat, 0);
  assert.equal(totals.gross, 10_000);
});

test('validering av linjer', () => {
  assert.deepEqual(validateLines([]), ['Fakturaen må ha minst én linje']);
  assert.equal(validateLines([{ description: '', quantity: 0, unitPrice: 1.5, vatRate: 8 }]).length, 4);
  assert.deepEqual(validateLines([{ description: 'ok', quantity: 1, unitPrice: 100, vatRate: 25 }]), []);
});

test('statusoverganger', () => {
  assert.equal(canTransition('draft', 'sent'), true);
  assert.equal(canTransition('draft', 'paid'), false);
  assert.equal(canTransition('sent', 'paid'), true);
  assert.equal(canTransition('credited', 'paid'), false);
});

test('datoer og forfall', () => {
  assert.equal(addDays('2026-12-20', 14), '2027-01-03');
  assert.equal(isOverdue('sent', '2026-09-01', '2026-09-27'), true);
  assert.equal(isOverdue('paid', '2026-09-01', '2026-09-27'), false);
});

test('parsing av kronebeløp', () => {
  assert.equal(parseKroner('1 234,50'), 123_450);
  assert.equal(parseKroner('1234.5'), 123_450);
  assert.equal(parseKroner('kr 99'), 9_900);
  assert.equal(parseKroner('-10'), -1_000);
  assert.equal(parseKroner('abc'), null);
  assert.equal(parseKroner('1,234'), null);
});

test('formatering av kronebeløp', () => {
  assert.equal(formatNok(120_000).replace(/\s/g, ' '), '1 200 kr');
  assert.equal(formatNok(123_450).replace(/\s/g, ' '), '1 234,50 kr');
});
