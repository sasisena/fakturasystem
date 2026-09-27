/**
 * Datamodell for fakturasystemet.
 *
 * - Hver kunde av systemet er en organisasjon (bedrift). Alle data som tilhører en organisasjon har
 *   kolonnen `org_id` og Row Level Security (se drizzle/0001_rls.sql) i tillegg til tilgangssjekken i koden.
 * - Brukere er felles: én person kan være med i flere organisasjoner (f.eks. en regnskapsfører).
 * - Primærnøklene er tekniske UUID-er.
 */
import { sql } from 'drizzle-orm';
import { bigint, bigserial, boolean, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

// ---------------------------------------------------------------------------
// Organisasjoner og medlemskap
// ---------------------------------------------------------------------------

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  orgNumber: text('org_number').notNull().default(''),
  /** Organisasjonsform fra Enhetsregisteret, f.eks. ENK eller AS. */
  organizationForm: text('organization_form').notNull().default(''),
  vatRegistered: boolean('vat_registered').notNull().default(false),
  address: text('address').notNull().default(''),
  postalCode: text('postal_code').notNull().default(''),
  city: text('city').notNull().default(''),
  email: text('email').notNull().default(''),
  phone: text('phone').notNull().default(''),
  accountNumber: text('account_number').notNull().default(''),
  paymentTermsDays: integer('payment_terms_days').notNull().default(14),
  /** Neste kundenummer i bedriften. Tildeles i samme transaksjon som kunden opprettes. */
  nextCustomerNumber: integer('next_customer_number').notNull().default(1),
  /**
   * Neste fakturanummer. Fakturaer og kreditnotaer deler serien. Tildeles i samme transaksjon som
   * utsendingen, så serien får aldri hull eller dubletter. Kan bare økes (f.eks. for å fortsette
   * nummerserien fra et tidligere system).
   */
  nextInvoiceNumber: integer('next_invoice_number').notNull().default(1),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const ROLES = ['eier', 'administrator', 'fakturering', 'lesetilgang'] as const;
export type Role = (typeof ROLES)[number];

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<Role>().notNull(),
    invitedBy: uuid('invited_by'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('memberships_org_user').on(t.orgId, t.userId), index('memberships_user').on(t.userId)],
);

// ---------------------------------------------------------------------------
// Kunder, produkter og fakturaer (alle med org_id og RLS)
// Beløp lagres som heltall i øre for å unngå avrundingsfeil.
// ---------------------------------------------------------------------------

/** Øre som JavaScript-tall (trygt opp til 90 billioner kroner). */
const ore = (name: string) => bigint(name, { mode: 'number' });

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    /** Fortløpende kundenummer per bedrift (brukes også i KID). */
    customerNumber: integer('customer_number').notNull(),
    name: text('name').notNull(),
    orgNumber: text('org_number').notNull().default(''),
    email: text('email').notNull().default(''),
    phone: text('phone').notNull().default(''),
    address: text('address').notNull().default(''),
    postalCode: text('postal_code').notNull().default(''),
    city: text('city').notNull().default(''),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('customers_org_number').on(t.orgId, t.customerNumber), index('customers_org_name').on(t.orgId, t.name)],
);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    unit: text('unit').notNull().default('stk'),
    /** Pris eks. mva i øre. */
    unitPrice: ore('unit_price').notNull(),
    vatRate: integer('vat_rate').notNull().default(25),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('products_org_name').on(t.orgId, t.name)],
);

export const INVOICE_STATUSES = ['utkast', 'sendt', 'betalt', 'kreditert'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const INVOICE_KINDS = ['faktura', 'kreditnota'] as const;
export type InvoiceKind = (typeof INVOICE_KINDS)[number];

/** Selger og kunde slik de var da fakturaen ble sendt. Fakturaen skal ikke endre seg om kunden eller firmaet endres senere. */
export type PartySnapshot = {
  name: string;
  orgNumber: string;
  organizationForm?: string;
  vatRegistered?: boolean;
  address: string;
  postalCode: string;
  city: string;
  email: string;
  phone: string;
  accountNumber?: string;
  customerNumber?: number;
};

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').notNull().references(() => customers.id),
    kind: text('kind').$type<InvoiceKind>().notNull().default('faktura'),
    status: text('status').$type<InvoiceStatus>().notNull().default('utkast'),
    /** Fakturanummer. Tomt for utkast; settes når fakturaen sendes. */
    number: integer('number'),
    /** Kreditnotaen krediterer denne fakturaen. */
    creditOf: uuid('credit_of'),
    kid: text('kid'),
    issueDate: date('issue_date', { mode: 'string' }),
    dueDate: date('due_date', { mode: 'string' }),
    /** 'epost' = sendt fra systemet, 'manuell' = brukeren sender PDF-en selv. */
    delivery: text('delivery'),
    sentTo: text('sent_to'),
    sentAt: ts('sent_at'),
    sentBy: uuid('sent_by'),
    paidDate: date('paid_date', { mode: 'string' }),
    seller: jsonb('seller').$type<PartySnapshot>(),
    buyer: jsonb('buyer').$type<PartySnapshot>(),
    vatRegistered: boolean('vat_registered'),
    theirReference: text('their_reference').notNull().default(''),
    note: text('note').notNull().default(''),
    /** Summer lagres for lister og rapporter; regnes alltid ut på nytt fra linjene ved endring. */
    net: ore('net').notNull().default(0),
    vat: ore('vat').notNull().default(0),
    gross: ore('gross').notNull().default(0),
    createdBy: uuid('created_by'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('invoices_org_created').on(t.orgId, t.createdAt),
    index('invoices_customer').on(t.customerId),
    // Aldri to fakturaer med samme nummer i en bedrift.
    uniqueIndex('invoices_org_number').on(t.orgId, t.number).where(sql`number is not null`),
    // En faktura krediteres høyst én gang.
    uniqueIndex('invoices_credit_of').on(t.creditOf).where(sql`credit_of is not null`),
  ],
);

export const invoiceLines = pgTable(
  'invoice_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    /** Produktet linjen ble laget fra, hvis noe. Teksten og prisen er kopiert, så linjen står seg om produktet endres. */
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 12, scale: 3, mode: 'number' }).notNull(),
    unit: text('unit').notNull().default('stk'),
    unitPrice: ore('unit_price').notNull(),
    vatRate: integer('vat_rate').notNull(),
  },
  (t) => [index('invoice_lines_invoice').on(t.invoiceId, t.position)],
);

// ---------------------------------------------------------------------------
// Brukere og innlogging (felles for alle organisasjoner, uten RLS – brukes bare i systemmodus)
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().default(''),
  email: text('email').notNull().unique(),
  /** TOTP-hemmelighet, kryptert med APP_SECRET (AES-256-GCM). */
  totpSecret: text('totp_secret'),
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  createdAt: ts('created_at').notNull().defaultNow(),
  lastLoginAt: ts('last_login_at'),
});

export const sessions = pgTable('sessions', {
  /** SHA-256 av session-token. Selve tokenet finnes bare i cookien. */
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** Organisasjonen brukeren jobber i nå. Tom før brukeren har valgt eller opprettet en. */
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'set null' }),
  csrfToken: text('csrf_token').notNull(),
  mfa: boolean('mfa').notNull().default(false),
  createdAt: ts('created_at').notNull().defaultNow(),
  expiresAt: ts('expires_at').notNull(),
});

export const otpCodes = pgTable('otp_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  codeHash: text('code_hash').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
});

export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    key: text('key').notNull(), // e-post (små bokstaver) eller 'mfa:<userId>'
    success: boolean('success').notNull(),
    at: ts('at').notNull().defaultNow(),
  },
  (t) => [index('login_attempts_key_at').on(t.key, t.at)],
);

// ---------------------------------------------------------------------------
// Revisjonslogg, utsending og drift
// ---------------------------------------------------------------------------

export const auditLog = pgTable(
  'audit_log',
  {
    seq: bigserial('seq', { mode: 'number' }).primaryKey(),
    at: ts('at').notNull().defaultNow(),
    /** Tom for hendelser som ikke hører til en organisasjon (f.eks. innlogging). */
    orgId: uuid('org_id'),
    actorId: uuid('actor_id'),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
  },
  (t) => [index('audit_org_at').on(t.orgId, t.at), index('audit_entity').on(t.entityId)],
);

/** Utboks: e-post legges her i samme transaksjon som endringen og sendes av utsendingsjobben. */
export const outbox = pgTable('outbox', {
  seq: bigserial('seq', { mode: 'number' }).primaryKey(),
  orgId: uuid('org_id'),
  /** Fakturaen som skal ligge ved som PDF. PDF-en lages ved utsending, fra fakturaens frosne opplysninger. */
  invoiceId: uuid('invoice_id'),
  replyTo: text('reply_to'),
  channel: text('channel').notNull(), // email
  to: text('to').notNull(),
  subject: text('subject'),
  body: text('body').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  sentAt: ts('sent_at'),
  error: text('error'),
});

/** Merking av databasen, f.eks. `test_database = true`. */
export const systemMeta = pgTable('system_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
