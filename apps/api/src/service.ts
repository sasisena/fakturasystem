import {
  addDays,
  canTransition,
  generateKid,
  invoiceTotals,
  isOverdue,
  isValidAccountNumber,
  isValidOrgNumber,
  validateLines,
  type InvoiceLineInput,
  type InvoiceStatus,
  type InvoiceTotals,
  type VatRate,
  type Company,
  type Customer,
  type Dashboard,
  type Invoice,
  type InvoiceLine,
  type InvoiceSummary,
} from '@faktura/core';
import { transaction, type Db } from './db.ts';

export class HttpError extends Error {
  statusCode: number;
  details?: string[];
  constructor(statusCode: number, message: string, details?: string[]) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

const today = (): string => new Date().toISOString().slice(0, 10);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const digits = (v: unknown): string => str(v).replace(/[\s.]/g, '');

// ---------- Firma ----------

export function getCompany(db: Db): Company {
  const r = db.prepare('SELECT * FROM company WHERE id = 1').get() as Record<string, any>;
  return {
    name: r.name,
    orgNumber: r.org_number,
    vatRegistered: r.vat_registered === 1,
    address: r.address,
    postalCode: r.postal_code,
    city: r.city,
    email: r.email,
    phone: r.phone,
    accountNumber: r.account_number,
    paymentTermsDays: r.payment_terms_days,
  };
}

export function updateCompany(db: Db, input: Record<string, unknown>): Company {
  const c: Company = {
    name: str(input.name),
    orgNumber: digits(input.orgNumber),
    vatRegistered: input.vatRegistered === true,
    address: str(input.address),
    postalCode: str(input.postalCode),
    city: str(input.city),
    email: str(input.email),
    phone: str(input.phone),
    accountNumber: digits(input.accountNumber),
    paymentTermsDays: Number(input.paymentTermsDays ?? 14),
  };
  const errors: string[] = [];
  if (!c.name) errors.push('Firmanavn mangler');
  if (c.orgNumber && !isValidOrgNumber(c.orgNumber)) errors.push('Ugyldig organisasjonsnummer');
  if (c.accountNumber && !isValidAccountNumber(c.accountNumber)) errors.push('Ugyldig kontonummer');
  if (!Number.isInteger(c.paymentTermsDays) || c.paymentTermsDays < 0 || c.paymentTermsDays > 120) {
    errors.push('Betalingsfrist må være mellom 0 og 120 dager');
  }
  if (errors.length) throw new HttpError(400, 'Ugyldige firmaopplysninger', errors);
  db.prepare(
    `UPDATE company SET name = ?, org_number = ?, vat_registered = ?, address = ?, postal_code = ?, city = ?,
       email = ?, phone = ?, account_number = ?, payment_terms_days = ? WHERE id = 1`,
  ).run(c.name, c.orgNumber, c.vatRegistered ? 1 : 0, c.address, c.postalCode, c.city, c.email, c.phone, c.accountNumber, c.paymentTermsDays);
  return c;
}

/** Hva som mangler før firmaet kan sende en lovlig faktura. */
export function companyReadiness(c: Company): string[] {
  const missing: string[] = [];
  if (!c.name) missing.push('Firmanavn');
  if (!isValidOrgNumber(c.orgNumber)) missing.push('Organisasjonsnummer');
  if (!c.address || !c.postalCode || !c.city) missing.push('Adresse');
  if (!isValidAccountNumber(c.accountNumber)) missing.push('Kontonummer');
  return missing;
}

// ---------- Kunder ----------

const toCustomer = (r: Record<string, any>): Customer => ({
  id: r.id,
  name: r.name,
  orgNumber: r.org_number,
  email: r.email,
  address: r.address,
  postalCode: r.postal_code,
  city: r.city,
});

function parseCustomer(input: Record<string, unknown>): Omit<Customer, 'id'> {
  const c = {
    name: str(input.name),
    orgNumber: digits(input.orgNumber),
    email: str(input.email),
    address: str(input.address),
    postalCode: str(input.postalCode),
    city: str(input.city),
  };
  const errors: string[] = [];
  if (!c.name) errors.push('Navn mangler');
  if (c.orgNumber && !isValidOrgNumber(c.orgNumber)) errors.push('Ugyldig organisasjonsnummer');
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) errors.push('Ugyldig e-postadresse');
  if (errors.length) throw new HttpError(400, 'Ugyldig kunde', errors);
  return c;
}

export function listCustomers(db: Db): Customer[] {
  return (db.prepare('SELECT * FROM customers ORDER BY name COLLATE NOCASE').all() as Record<string, any>[]).map(toCustomer);
}

export function getCustomer(db: Db, id: number): Customer {
  const r = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Record<string, any> | undefined;
  if (!r) throw new HttpError(404, 'Fant ikke kunden');
  return toCustomer(r);
}

export function createCustomer(db: Db, input: Record<string, unknown>): Customer {
  const c = parseCustomer(input);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO customers (name, org_number, email, address, postal_code, city) VALUES (?, ?, ?, ?, ?, ?)')
    .run(c.name, c.orgNumber, c.email, c.address, c.postalCode, c.city);
  return getCustomer(db, Number(lastInsertRowid));
}

export function updateCustomer(db: Db, id: number, input: Record<string, unknown>): Customer {
  getCustomer(db, id);
  const c = parseCustomer(input);
  db.prepare('UPDATE customers SET name = ?, org_number = ?, email = ?, address = ?, postal_code = ?, city = ? WHERE id = ?').run(
    c.name, c.orgNumber, c.email, c.address, c.postalCode, c.city, id,
  );
  return getCustomer(db, id);
}

export function deleteCustomer(db: Db, id: number): void {
  getCustomer(db, id);
  const used = db.prepare('SELECT 1 FROM invoices WHERE customer_id = ? LIMIT 1').get(id);
  if (used) throw new HttpError(409, 'Kunden har fakturaer og kan ikke slettes');
  db.prepare('DELETE FROM customers WHERE id = ?').run(id);
}

// ---------- Fakturaer ----------



function loadLines(db: Db, invoiceId: number): InvoiceLine[] {
  const rows = db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY position').all(invoiceId) as Record<string, any>[];
  return rows.map((r) => ({ id: r.id, description: r.description, quantity: r.quantity, unitPrice: r.unit_price, vatRate: r.vat_rate as VatRate }));
}

export function getInvoice(db: Db, id: number): Invoice {
  const r = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as Record<string, any> | undefined;
  if (!r) throw new HttpError(404, 'Fant ikke fakturaen');
  const lines = loadLines(db, id);
  const seller: Company | null = r.seller_snapshot ? JSON.parse(r.seller_snapshot) : null;
  const vatRegistered = seller ? seller.vatRegistered : getCompany(db).vatRegistered;
  return {
    id: r.id,
    kind: r.kind,
    number: r.number,
    creditsInvoiceId: r.credits_invoice_id,
    status: r.status,
    overdue: r.kind === 'invoice' && isOverdue(r.status, r.due_date ?? '', today()),
    issueDate: r.issue_date,
    dueDate: r.due_date,
    kid: r.kid,
    theirReference: r.their_reference,
    note: r.note,
    customerId: r.customer_id,
    customer: r.customer_snapshot ? JSON.parse(r.customer_snapshot) : getCustomer(db, r.customer_id),
    seller,
    lines,
    totals: invoiceTotals(lines, vatRegistered),
    sentAt: r.sent_at,
    paidAt: r.paid_at,
  };
}

export function listInvoices(db: Db, filter: { status?: string } = {}): InvoiceSummary[] {
  const rows = db
    .prepare(
      `SELECT i.*, COALESCE(json_extract(i.customer_snapshot, '$.name'), c.name) AS customer_name
       FROM invoices i JOIN customers c ON c.id = i.customer_id
       ORDER BY (i.number IS NULL) DESC, i.number DESC, i.id DESC`,
    )
    .all() as Record<string, any>[];
  const t = today();
  return rows
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      number: r.number,
      status: r.status as InvoiceStatus,
      overdue: r.kind === 'invoice' && isOverdue(r.status, r.due_date ?? '', t),
      customerName: r.customer_name,
      issueDate: r.issue_date,
      dueDate: r.due_date,
      gross: r.gross,
    }))
    .filter((i) => !filter.status || (filter.status === 'overdue' ? i.overdue : i.status === filter.status));
}

interface DraftInput {
  customerId: number;
  lines: InvoiceLineInput[];
  theirReference: string;
  note: string;
}

function parseDraft(db: Db, input: Record<string, unknown>): DraftInput {
  const customerId = Number(input.customerId);
  const errors = validateLines(input.lines);
  if (!Number.isInteger(customerId) || !db.prepare('SELECT 1 FROM customers WHERE id = ?').get(customerId)) {
    errors.unshift('Velg en kunde');
  }
  if (errors.length) throw new HttpError(400, 'Ugyldig faktura', errors);
  const lines = (input.lines as InvoiceLineInput[]).map((l) => ({
    description: l.description.trim(),
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    vatRate: l.vatRate,
  }));
  return { customerId, lines, theirReference: str(input.theirReference), note: str(input.note) };
}

function writeLines(db: Db, invoiceId: number, lines: InvoiceLineInput[]): void {
  db.prepare('DELETE FROM invoice_lines WHERE invoice_id = ?').run(invoiceId);
  const insert = db.prepare('INSERT INTO invoice_lines (invoice_id, position, description, quantity, unit_price, vat_rate) VALUES (?, ?, ?, ?, ?, ?)');
  lines.forEach((l, i) => insert.run(invoiceId, i, l.description, l.quantity, l.unitPrice, l.vatRate));
}

function storeTotals(db: Db, invoiceId: number, totals: InvoiceTotals): void {
  db.prepare('UPDATE invoices SET net = ?, vat = ?, gross = ? WHERE id = ?').run(totals.net, totals.vat, totals.gross, invoiceId);
}

export function createDraft(db: Db, input: Record<string, unknown>): Invoice {
  const d = parseDraft(db, input);
  const id = transaction(db, () => {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO invoices (customer_id, their_reference, note) VALUES (?, ?, ?)')
      .run(d.customerId, d.theirReference, d.note);
    const id = Number(lastInsertRowid);
    writeLines(db, id, d.lines);
    storeTotals(db, id, invoiceTotals(d.lines, getCompany(db).vatRegistered));
    return id;
  });
  return getInvoice(db, id);
}

function requireDraft(inv: Invoice): void {
  if (inv.status !== 'draft') throw new HttpError(409, 'Sendte fakturaer kan ikke endres eller slettes — krediter dem i stedet');
}

export function updateDraft(db: Db, id: number, input: Record<string, unknown>): Invoice {
  requireDraft(getInvoice(db, id));
  const d = parseDraft(db, input);
  transaction(db, () => {
    db.prepare('UPDATE invoices SET customer_id = ?, their_reference = ?, note = ? WHERE id = ?').run(d.customerId, d.theirReference, d.note, id);
    writeLines(db, id, d.lines);
    storeTotals(db, id, invoiceTotals(d.lines, getCompany(db).vatRegistered));
  });
  return getInvoice(db, id);
}

export function deleteDraft(db: Db, id: number): void {
  requireDraft(getInvoice(db, id));
  db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
}

/** Tildeler neste fakturanummer uten hull i nummerserien. Må kalles inne i en transaksjon. */
function takeInvoiceNumber(db: Db): number {
  const { next_invoice_number: n } = db.prepare('SELECT next_invoice_number FROM company WHERE id = 1').get() as { next_invoice_number: number };
  db.prepare('UPDATE company SET next_invoice_number = ? WHERE id = 1').run(n + 1);
  return n;
}

/**
 * Utsteder en faktura: tildeler fakturanummer og KID, fryser selger- og kundeopplysninger
 * og låser fakturaen for endringer. Selve utsendelsen (e-post/PDF) skjer etterpå.
 */
export function issueInvoice(db: Db, id: number, issueDate = today()): Invoice {
  const inv = getInvoice(db, id);
  if (!canTransition(inv.status, 'sent')) throw new HttpError(409, 'Fakturaen er allerede sendt');
  const company = getCompany(db);
  const missing = companyReadiness(company);
  if (missing.length) throw new HttpError(409, 'Fyll ut firmaopplysninger før du sender faktura', missing.map((m) => `Mangler: ${m}`));
  transaction(db, () => {
    const number = takeInvoiceNumber(db);
    db.prepare(
      `UPDATE invoices SET status = 'sent', number = ?, kid = ?, issue_date = ?, due_date = ?, seller_snapshot = ?,
         customer_snapshot = ?, sent_at = datetime('now') WHERE id = ?`,
    ).run(
      number,
      generateKid(inv.customerId, number),
      issueDate,
      addDays(issueDate, company.paymentTermsDays),
      JSON.stringify(company),
      JSON.stringify(inv.customer),
      id,
    );
    storeTotals(db, id, invoiceTotals(inv.lines, company.vatRegistered));
  });
  return getInvoice(db, id);
}

export function markPaid(db: Db, id: number, paidDate = today()): Invoice {
  const inv = getInvoice(db, id);
  if (inv.kind !== 'invoice' || !canTransition(inv.status, 'paid')) throw new HttpError(409, 'Kun sendte fakturaer kan merkes som betalt');
  db.prepare("UPDATE invoices SET status = 'paid', paid_at = ? WHERE id = ?").run(paidDate, id);
  return getInvoice(db, id);
}

export function markUnpaid(db: Db, id: number): Invoice {
  const inv = getInvoice(db, id);
  if (inv.status !== 'paid') throw new HttpError(409, 'Fakturaen er ikke merket som betalt');
  db.prepare("UPDATE invoices SET status = 'sent', paid_at = NULL WHERE id = ?").run(id);
  return getInvoice(db, id);
}

/** Lager en kreditnota som nuller ut hele fakturaen. Returnerer kreditnotaen. */
export function creditInvoice(db: Db, id: number, issueDate = today()): Invoice {
  const inv = getInvoice(db, id);
  if (inv.kind !== 'invoice' || !canTransition(inv.status, 'credited')) throw new HttpError(409, 'Kun sendte fakturaer kan krediteres');
  const seller = inv.seller!;
  const lines = inv.lines.map((l) => ({ ...l, quantity: -l.quantity }));
  const creditId = transaction(db, () => {
    const number = takeInvoiceNumber(db);
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO invoices (kind, number, credits_invoice_id, customer_id, status, issue_date, due_date, their_reference, note,
           seller_snapshot, customer_snapshot, sent_at)
         VALUES ('credit_note', ?, ?, ?, 'sent', ?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .run(number, id, inv.customerId, issueDate, issueDate, inv.theirReference, `Kreditering av faktura ${inv.number}`,
        JSON.stringify(seller), JSON.stringify(inv.customer));
    const creditId = Number(lastInsertRowid);
    writeLines(db, creditId, lines);
    storeTotals(db, creditId, invoiceTotals(lines, seller.vatRegistered));
    db.prepare("UPDATE invoices SET status = 'credited' WHERE id = ?").run(id);
    return creditId;
  });
  return getInvoice(db, creditId);
}

export function recordOutbox(db: Db, invoiceId: number, recipient: string, subject: string): void {
  db.prepare('INSERT INTO outbox (invoice_id, recipient, subject) VALUES (?, ?, ?)').run(invoiceId, recipient, subject);
}

export function dashboard(db: Db): Dashboard {
  const t = today();
  const month = t.slice(0, 7);
  const one = (sql: string, ...args: string[]) => db.prepare(sql).get(...args) as { n: number; s: number };
  const out = one("SELECT COUNT(*) n, COALESCE(SUM(gross), 0) s FROM invoices WHERE status = 'sent' AND kind = 'invoice'");
  const due = one("SELECT COUNT(*) n, COALESCE(SUM(gross), 0) s FROM invoices WHERE status = 'sent' AND kind = 'invoice' AND due_date < ?", t);
  const paid = one("SELECT COUNT(*) n, COALESCE(SUM(gross), 0) s FROM invoices WHERE status = 'paid' AND substr(paid_at, 1, 7) = ?", month);
  const drafts = one("SELECT COUNT(*) n, 0 s FROM invoices WHERE status = 'draft'");
  return {
    outstanding: out.s,
    outstandingCount: out.n,
    overdue: due.s,
    overdueCount: due.n,
    paidThisMonth: paid.s,
    draftCount: drafts.n,
    missingCompanyInfo: companyReadiness(getCompany(db)),
  };
}
