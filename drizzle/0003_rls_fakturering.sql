-- Skott (RLS) for kunder, produkter og fakturaer – samme regel som i 0001_rls.sql.
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE customers FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY customers_org ON customers USING (app_mode() = 'system' OR org_id = app_org());--> statement-breakpoint

ALTER TABLE products ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE products FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY products_org ON products USING (app_mode() = 'system' OR org_id = app_org());--> statement-breakpoint

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY invoices_org ON invoices USING (app_mode() = 'system' OR org_id = app_org());--> statement-breakpoint

ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE invoice_lines FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY invoice_lines_org ON invoice_lines USING (app_mode() = 'system' OR org_id = app_org());--> statement-breakpoint

-- Fremmednøkler sjekkes av Postgres uten RLS. For at en faktura aldri skal kunne peke på en kunde,
-- et produkt eller en faktura i en annen bedrift, går nøklene også via org_id.
CREATE UNIQUE INDEX customers_org_id_id ON customers (org_id, id);--> statement-breakpoint
CREATE UNIQUE INDEX products_org_id_id ON products (org_id, id);--> statement-breakpoint
CREATE UNIQUE INDEX invoices_org_id_id ON invoices (org_id, id);--> statement-breakpoint
ALTER TABLE invoices ADD CONSTRAINT invoices_same_org_customer FOREIGN KEY (org_id, customer_id) REFERENCES customers (org_id, id);--> statement-breakpoint
ALTER TABLE invoice_lines ADD CONSTRAINT invoice_lines_same_org_invoice FOREIGN KEY (org_id, invoice_id) REFERENCES invoices (org_id, id) ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE invoice_lines ADD CONSTRAINT invoice_lines_same_org_product FOREIGN KEY (org_id, product_id) REFERENCES products (org_id, id) ON DELETE SET NULL (product_id);--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'faktura_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO faktura_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO faktura_app;
  END IF;
END $$;
