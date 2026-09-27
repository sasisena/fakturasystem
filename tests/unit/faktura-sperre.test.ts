/**
 * Sperren i databasen mot å endre eller slette sendte fakturaer (bokføringsloven), og at e-post med
 * faktura får PDF-en som vedlegg. Kjøres mot databasen når DATABASE_URL er satt (som i CI).
 * Alt skjer i én transaksjon som rulles tilbake.
 */
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const url = process.env.DATABASE_URL;
const ORG = '0a000000-0000-4000-8000-0000000000cc';
const CUST = '2a000000-0000-4000-8000-0000000000cc';
const DRAFT = '4a000000-0000-4000-8000-0000000000c1';
const SENT = '4a000000-0000-4000-8000-0000000000c2';

describe.skipIf(!url)('sendte fakturaer er låst', async () => {
  const { rootDb } = await import('@/server/db');
  const db = rootDb();
  let rollback: () => void;
  let tx: Parameters<Parameters<typeof db.transaction>[0]>[0];
  const done = new Promise<void>((resolve) => (rollback = resolve));
  let finished: Promise<unknown>;

  beforeAll(async () => {
    await new Promise<void>((ready) => {
      finished = db
        .transaction(async (t) => {
          tx = t;
          await t.execute(sql`select set_config('app.mode', 'system', true)`);
          await t.execute(sql`insert into organizations (id, name, org_number, address, postal_code, city, account_number) values (${ORG}, 'Sperre AS', '923609016', 'Vei 1', '0150', 'Oslo', '86011117947')`);
          await t.execute(sql`insert into customers (id, org_id, customer_number, name, email) values (${CUST}, ${ORG}, 1, 'Kunde', 'k@example.invalid')`);
          for (const id of [DRAFT, SENT]) {
            await t.execute(sql`insert into invoices (id, org_id, customer_id) values (${id}, ${ORG}, ${CUST})`);
            await t.execute(sql`insert into invoice_lines (org_id, invoice_id, position, description, quantity, unit_price, vat_rate) values (${ORG}, ${id}, 0, 'Arbeid', 1, 100000, 25)`);
          }
          await t.execute(sql`update invoices set status = 'sendt', number = 7, kid = '0000100000075', issue_date = '2026-09-24', due_date = '2026-10-08',
            seller = '{"name":"Sperre AS","orgNumber":"923609016","address":"Vei 1","postalCode":"0150","city":"Oslo","email":"","phone":"","accountNumber":"86011117947","vatRegistered":true}',
            buyer = '{"name":"Kunde","orgNumber":"","address":"","postalCode":"","city":"","email":"k@example.invalid","phone":"","customerNumber":1}',
            vat_registered = true, net = 100000, vat = 25000, gross = 125000 where id = ${SENT}`);
          ready();
          await done;
          throw new Error('rull tilbake');
        })
        .catch(() => undefined);
    });
  });

  afterAll(async () => {
    rollback();
    await finished;
  });

  const rejects = async (q: ReturnType<typeof sql>) => {
    await tx.execute(sql`savepoint s`);
    // drizzle pakker feilen fra Postgres inn i `cause`.
    const err = await tx.execute(q).then(() => null, (e: Error & { cause?: Error }) => e);
    expect(err?.cause?.message ?? err?.message ?? 'ingen feil').toMatch(/faktura_last/);
    await tx.execute(sql`rollback to savepoint s`);
  };

  test('et utkast kan endres', async () => {
    await tx.execute(sql`update invoices set note = 'endret' where id = ${DRAFT}`);
    await tx.execute(sql`update invoice_lines set description = 'Endret' where invoice_id = ${DRAFT}`);
  });

  test('en sendt faktura og linjene kan ikke endres eller slettes, heller ikke i systemmodus', async () => {
    await rejects(sql`update invoices set gross = 1 where id = ${SENT}`);
    await rejects(sql`update invoices set number = 8 where id = ${SENT}`);
    await rejects(sql`update invoices set buyer = '{}' where id = ${SENT}`);
    await rejects(sql`update invoices set status = 'utkast' where id = ${SENT}`);
    await rejects(sql`delete from invoices where id = ${SENT}`);
    await rejects(sql`update invoice_lines set unit_price = 1 where invoice_id = ${SENT}`);
    await rejects(sql`delete from invoice_lines where invoice_id = ${SENT}`);
    await rejects(sql`insert into invoice_lines (org_id, invoice_id, position, description, quantity, unit_price, vat_rate) values (${ORG}, ${SENT}, 1, 'Snik', 1, 1, 25)`);
  });

  test('status og betalingsdato kan endres', async () => {
    await tx.execute(sql`update invoices set status = 'betalt', paid_date = '2026-09-30' where id = ${SENT}`);
    await tx.execute(sql`update invoices set status = 'sendt', paid_date = null where id = ${SENT}`);
  });

  test('e-post med faktura får PDF-en som vedlegg', async () => {
    const { deliverOutbox } = await import('@/server/delivery');
    await tx.execute(sql`insert into outbox (org_id, invoice_id, channel, "to", subject, body) values (${ORG}, ${SENT}, 'email', 'k@example.invalid', 'Faktura 7', 'Hei')`);
    const sent: { to: string; files: { filename: string; head: string }[] }[] = [];
    const r = await deliverOutbox(tx, 10, {
      email: { name: 'email', deliver: async (m, att = []) => void sent.push({ to: m.to, files: att.map((a) => ({ filename: a.filename, head: a.content.subarray(0, 5).toString() })) }) },
    });
    expect(r.sent).toBeGreaterThanOrEqual(1);
    expect(sent.find((m) => m.to === 'k@example.invalid')?.files).toEqual([{ filename: 'faktura-7.pdf', head: '%PDF-' }]);
  });
});
