import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/db/schema';
import { config } from './env';

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type Q = Db | Tx;

const g = globalThis as unknown as { __fakturaPool?: Pool; __fakturaDb?: Db };

function pool(): Pool {
  if (!g.__fakturaPool) {
    g.__fakturaPool = new Pool({ connectionString: config.databaseUrl, max: 10 });
    g.__fakturaPool.on('error', () => {
      // Tilkoblingsfeil logges uten detaljer; pg lager en ny tilkobling ved neste spørring.
      console.error('Databasetilkoblingen feilet.');
    });
  }
  return g.__fakturaPool;
}

export function rootDb(): Db {
  if (!g.__fakturaDb) g.__fakturaDb = drizzle(pool(), { schema });
  return g.__fakturaDb;
}

/** Hva databasen (RLS) skal slippe gjennom i denne forespørselen. */
export type DbScope = {
  mode: 'system' | 'scoped';
  /** Organisasjonen brukeren jobber i, eller null (ser da ingen organisasjonsdata). */
  org: string | null;
};

export const SYSTEM_SCOPE: DbScope = { mode: 'system', org: null };

async function applyScope(tx: Q, s: DbScope) {
  await tx.execute(sql`select set_config('app.mode', ${s.mode}, true), set_config('app.org', ${s.org ?? ''}, true)`);
}

/** Kjører fn i én transaksjon der RLS-omfanget er satt. */
export async function withScope<T>(scope: DbScope, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return rootDb().transaction(async (tx) => {
    await applyScope(tx, scope);
    return fn(tx);
  });
}

/**
 * Kjører fn i systemmodus inne i en eksisterende transaksjon og setter omfanget tilbake etterpå.
 * Brukes der koden selv har sjekket tilgang, f.eks. når en ny organisasjon opprettes.
 */
export async function asSystem<T>(tx: Tx, scope: DbScope, fn: () => Promise<T>): Promise<T> {
  await applyScope(tx, SYSTEM_SCOPE);
  try {
    return await fn();
  } finally {
    await applyScope(tx, scope);
  }
}

export async function withSystem<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withScope(SYSTEM_SCOPE, fn);
}

/** Sjekker at databaserollen ikke kan gå forbi RLS. */
export async function dbRoleBypassesRls(): Promise<boolean> {
  const r = await pool().query('select rolsuper, rolbypassrls from pg_roles where rolname = current_user');
  const row = r.rows[0] as { rolsuper: boolean; rolbypassrls: boolean } | undefined;
  return !!row && (row.rolsuper || row.rolbypassrls);
}

export async function isMarkedTestDatabase(): Promise<boolean> {
  const r = await pool().query("select value from system_meta where key = 'test_database'");
  return r.rows[0]?.value === 'true';
}
