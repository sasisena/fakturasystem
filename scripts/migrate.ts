/** Kjører databasemigreringene i drizzle/. Bruker DATABASE_MIGRATION_URL hvis den er satt. */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function main() {
  const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('Sett DATABASE_URL (eller DATABASE_MIGRATION_URL).');
  const pool = new Pool({ connectionString: url });
  await migrate(drizzle(pool), { migrationsFolder: 'drizzle' });
  await pool.end();
  console.log('Migreringene er kjørt.');
}

main().catch((e) => {
  console.error('Migreringen feilet:', e instanceof Error ? e.message : e);
  process.exit(1);
});
