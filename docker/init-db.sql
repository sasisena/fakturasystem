-- Kjøres første gang Postgres-containeren starter (og i CI).
-- Eier-rollen (faktura_owner) kjører migreringene. App-rollen (faktura_app) har bare lese- og skrivetilgang
-- og er underlagt Row Level Security (ingen SUPERUSER eller BYPASSRLS).
CREATE ROLE faktura_owner LOGIN PASSWORD 'faktura_owner' NOSUPERUSER NOBYPASSRLS;
CREATE ROLE faktura_app LOGIN PASSWORD 'faktura_app' NOSUPERUSER NOBYPASSRLS;
CREATE DATABASE faktura OWNER faktura_owner;
CREATE DATABASE faktura_test OWNER faktura_owner;
\connect faktura
GRANT USAGE ON SCHEMA public TO faktura_app;
ALTER DEFAULT PRIVILEGES FOR ROLE faktura_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO faktura_app;
ALTER DEFAULT PRIVILEGES FOR ROLE faktura_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO faktura_app;
\connect faktura_test
GRANT USAGE ON SCHEMA public TO faktura_app;
-- TRUNCATE trengs bare i testdatabasen (POST /api/test/reset).
ALTER DEFAULT PRIVILEGES FOR ROLE faktura_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO faktura_app;
ALTER DEFAULT PRIVILEGES FOR ROLE faktura_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO faktura_app;
