#!/bin/sh
# Kjøres første gang databasen starter. Som docker/init-db.sql, men med passord fra miljøet.
# faktura_app er underlagt Row Level Security (ingen SUPERUSER eller BYPASSRLS).
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -v owner_pw="$OWNER_DB_PASSWORD" -v app_pw="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE faktura_owner LOGIN PASSWORD :'owner_pw' NOSUPERUSER NOBYPASSRLS;
CREATE ROLE faktura_app LOGIN PASSWORD :'app_pw' NOSUPERUSER NOBYPASSRLS;
CREATE DATABASE faktura OWNER faktura_owner;
\connect faktura
GRANT USAGE ON SCHEMA public TO faktura_app;
ALTER DEFAULT PRIVILEGES FOR ROLE faktura_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO faktura_app;
ALTER DEFAULT PRIVILEGES FOR ROLE faktura_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO faktura_app;
SQL
