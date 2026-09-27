#!/bin/sh
# Starter appen i containeren.
# RUN_MIGRATIONS=true  kjører databasemigreringene først (DATABASE_MIGRATION_URL eller DATABASE_URL).
# MARK_TEST_DB=true    merker databasen som testdatabase (bare i testmiljøet, sammen med FAKTURA_TEST_MODE=true).
set -e
if [ "$RUN_MIGRATIONS" = "true" ]; then
  npx tsx scripts/migrate.ts
fi
if [ "$MARK_TEST_DB" = "true" ] && [ "$FAKTURA_TEST_MODE" = "true" ]; then
  DATABASE_URL="${DATABASE_MIGRATION_URL:-$DATABASE_URL}" npx tsx scripts/mark-test-db.ts
fi
exec node server.js
