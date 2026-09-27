ALTER TABLE "invoices" ADD COLUMN "kind" text DEFAULT 'faktura' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "number" integer;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "credit_of" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "kid" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "issue_date" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "delivery" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "sent_to" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "sent_by" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "paid_date" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "seller" jsonb;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "buyer" jsonb;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "vat_registered" boolean;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "next_invoice_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "reply_to" text;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_org_number" ON "invoices" USING btree ("org_id","number") WHERE number is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_credit_of" ON "invoices" USING btree ("credit_of") WHERE credit_of is not null;--> statement-breakpoint
-- Kreditnotaen må høre til samme bedrift som fakturaen den krediterer.
ALTER TABLE invoices ADD CONSTRAINT invoices_same_org_credit_of FOREIGN KEY (org_id, credit_of) REFERENCES invoices (org_id, id);--> statement-breakpoint

-- Bokføringsloven: en sendt faktura er et regnskapsbilag og skal aldri endres eller slettes – rettes med kreditnota.
-- Sperren ligger i databasen, så den gjelder uansett hva koden gjør. Etter utsending kan bare status
-- (sendt/betalt/kreditert), betalingsdato og utsendingsopplysninger endres.
CREATE OR REPLACE FUNCTION invoices_lock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'utkast' THEN
      RAISE EXCEPTION 'faktura_last: en sendt faktura kan ikke slettes' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'utkast' AND (
    NEW.status = 'utkast'
    OR NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.number IS DISTINCT FROM OLD.number
    OR NEW.credit_of IS DISTINCT FROM OLD.credit_of OR NEW.kid IS DISTINCT FROM OLD.kid
    OR NEW.issue_date IS DISTINCT FROM OLD.issue_date OR NEW.due_date IS DISTINCT FROM OLD.due_date
    OR NEW.seller IS DISTINCT FROM OLD.seller OR NEW.buyer IS DISTINCT FROM OLD.buyer
    OR NEW.vat_registered IS DISTINCT FROM OLD.vat_registered
    OR NEW.their_reference IS DISTINCT FROM OLD.their_reference OR NEW.note IS DISTINCT FROM OLD.note
    OR NEW.net IS DISTINCT FROM OLD.net OR NEW.vat IS DISTINCT FROM OLD.vat OR NEW.gross IS DISTINCT FROM OLD.gross
  ) THEN
    RAISE EXCEPTION 'faktura_last: en sendt faktura kan ikke endres' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER invoices_lock BEFORE UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION invoices_lock();--> statement-breakpoint

CREATE OR REPLACE FUNCTION invoice_lines_lock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  s text;
BEGIN
  SELECT status INTO s FROM invoices WHERE id = CASE WHEN TG_OP = 'INSERT' THEN NEW.invoice_id ELSE OLD.invoice_id END;
  -- s er tom når fakturaen selv er i ferd med å bli slettet (utkast, via ON DELETE CASCADE).
  IF s IS NOT NULL AND s <> 'utkast' THEN
    RAISE EXCEPTION 'faktura_last: linjene på en sendt faktura kan ikke endres' USING ERRCODE = 'P0001';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;--> statement-breakpoint
CREATE TRIGGER invoice_lines_lock BEFORE INSERT OR UPDATE OR DELETE ON invoice_lines FOR EACH ROW EXECUTE FUNCTION invoice_lines_lock();
