/**
 * Skottene mellom bedriftene, testet direkte mot databasen (uten om koden i API-et).
 * Kjøres når DATABASE_URL peker på en migrert database med app-rollen (som i CI), ellers hoppes de over.
 * Alt skjer i én transaksjon som rulles tilbake.
 */
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const url = process.env.DATABASE_URL;
const A = '0a000000-0000-4000-8000-0000000000aa';
const B = '0b000000-0000-4000-8000-0000000000bb';
const U = '1a000000-0000-4000-8000-0000000000aa';

/**
 * Tabeller med org_id som bevisst står uten RLS. `sessions` er brukerens innlogging (org_id er bare
 * hvilken bedrift brukeren har valgt), leses før tilgangen er kjent og inneholder ingen bedriftsdata.
 */
const NO_RLS = ['sessions'];

describe.skipIf(!url)('Row Level Security', () => {
  const db = new Client({ connectionString: url });
  const scope = (mode: string, org: string) => db.query("select set_config('app.mode', $1, true), set_config('app.org', $2, true)", [mode, org]);

  beforeAll(async () => {
    await db.connect();
    await db.query('begin');
    await scope('system', '');
    await db.query("insert into organizations (id, name) values ($1, 'A'), ($2, 'B')", [A, B]);
    await db.query("insert into users (id, email) values ($1, 'rls-test@example.invalid')", [U]);
    await db.query("insert into memberships (org_id, user_id, role) values ($1, $3, 'eier'), ($2, $3, 'eier')", [A, B, U]);
    await db.query("insert into audit_log (org_id, action, entity) values ($1, 'firma_endret', 'organization'), ($2, 'firma_endret', 'organization')", [A, B]);
    await db.query("insert into outbox (org_id, channel, \"to\", body) values ($1, 'email', 'a@example.invalid', 'x'), ($2, 'email', 'b@example.invalid', 'y')", [A, B]);
  });

  afterAll(async () => {
    await db.query('rollback');
    await db.end();
  });

  test('app-rollen kan ikke gå forbi RLS', async () => {
    const r = await db.query('select rolsuper, rolbypassrls from pg_roles where rolname = current_user');
    expect(r.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  test('alle tabeller med org_id har tvungen RLS og en regel', async () => {
    const r = await db.query(`
      select c.relname, c.relrowsecurity, c.relforcerowsecurity, count(p.polname)::int as policies
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      left join pg_policy p on p.polrelid = c.oid
      where c.relkind = 'r' and (c.relname = 'organizations' or exists (
        select 1 from information_schema.columns col where col.table_schema = 'public' and col.table_name = c.relname and col.column_name = 'org_id'))
      group by c.relname, c.relrowsecurity, c.relforcerowsecurity`);
    r.rows = r.rows.filter((t) => !NO_RLS.includes(t.relname));
    expect(r.rows.length).toBeGreaterThanOrEqual(4);
    for (const t of r.rows) expect({ table: t.relname, rls: t.relrowsecurity, force: t.relforcerowsecurity, policy: t.policies > 0 }).toEqual({ table: t.relname, rls: true, force: true, policy: true });
  });

  test.each(['organizations', 'memberships', 'audit_log', 'outbox'])('%s: ser bare egen bedrift, også uten filter i spørringen', async (table) => {
    const col = table === 'organizations' ? 'id' : 'org_id';
    await scope('scoped', A);
    const rows = (await db.query(`select distinct ${col} as org from ${table} where ${col} in ($1, $2)`, [A, B])).rows.map((x) => x.org);
    expect(rows).toEqual([A]);
    await scope('scoped', '');
    expect((await db.query(`select 1 from ${table} where ${col} in ($1, $2)`, [A, B])).rowCount).toBe(0);
  });

  test('kan ikke skrive eller endre data i en annen bedrift', async () => {
    await scope('scoped', A);
    await db.query('savepoint s');
    await expect(db.query("insert into memberships (org_id, user_id, role) values ($1, $2, 'eier')", [B, U])).rejects.toThrow(/row-level security/);
    await db.query('rollback to savepoint s');
    const upd = await db.query("update organizations set name = 'Kapret' where id = $1", [B]);
    expect(upd.rowCount).toBe(0);
    const del = await db.query('delete from memberships where org_id = $1', [B]);
    expect(del.rowCount).toBe(0);
    await scope('system', '');
    expect((await db.query('select name from organizations where id = $1', [B])).rows[0].name).toBe('B');
  });
});
