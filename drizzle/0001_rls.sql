-- Row Level Security: vanntette skott mellom organisasjonene (kundene av systemet).
-- Dette er en ekstra sperre i tillegg til tilgangssjekken i koden (src/server/access.ts).
-- Hver forespørsel kjører i en transaksjon der appen setter:
--   app.mode  'system' (jobber, test, innlogging) eller 'scoped'
--   app.org   organisasjonen brukeren jobber i nå (tom = ingen)
-- FORCE gjør at også eieren av tabellene er underlagt reglene. Bare superbrukere i
-- Postgres og roller med BYPASSRLS slipper forbi, og appen nekter å starte i
-- produksjon med en slik rolle.
-- Nye tabeller med org_id MÅ få samme regel. Testen tests/unit/rls.test.ts sjekker det.
-- Unntak: sessions (brukerens innlogging, ingen bedriftsdata; se testen).

CREATE OR REPLACE FUNCTION app_mode() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT coalesce(current_setting('app.mode', true), '') $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_org() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.org', true), '')::uuid $$;--> statement-breakpoint

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY organizations_org ON organizations USING (app_mode() = 'system' OR id = app_org());--> statement-breakpoint

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY memberships_org ON memberships USING (app_mode() = 'system' OR org_id = app_org());--> statement-breakpoint

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY audit_log_org ON audit_log USING (app_mode() = 'system' OR org_id = app_org());--> statement-breakpoint

ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE outbox FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY outbox_org ON outbox USING (app_mode() = 'system' OR org_id = app_org());--> statement-breakpoint

-- Gi app-rollen tilgang hvis den finnes (når migreringer kjøres som en egen eier-rolle).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'faktura_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO faktura_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO faktura_app;
  END IF;
END $$;
