/**
 * Merker databasen som testdatabase. Testmodus (ATAK_TEST_MODE=true) nekter å starte
 * med NODE_ENV=production hvis databasen ikke er merket. Kjør aldri mot produksjon.
 */
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(
    `INSERT INTO system_meta (key, value) VALUES ('test_database', 'true')
     ON CONFLICT (key) DO UPDATE SET value = 'true'`,
  );
  await pool.end();
  console.log('Databasen er merket som testdatabase.');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
