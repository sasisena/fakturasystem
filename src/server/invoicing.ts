/**
 * Kunder, produkter og fakturautkast. Alle spørringer kjører i forespørselens transaksjon med
 * RLS-omfanget til bedriften; filtrene på org_id i koden er i tillegg, ikke i stedet.
 */
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { customers, invoiceLines, invoices, organizations, products } from '@/db/schema';
import { invoiceTotals, lineTotals, type InvoiceTotals, type VatRate } from '@/lib/faktura';
import type { Tx } from './db';
import { invalid, notFound, type FieldError } from './errors';
import { isUuid } from './util';
import type { InvoiceInput } from './validation';

type CustomerRow = typeof customers.$inferSelect;
type ProductRow = typeof products.$inferSelect;
type InvoiceRow = typeof invoices.$inferSelect;

export const customerDto = (c: CustomerRow) => ({
  id: c.id,
  customerNumber: c.customerNumber,
  name: c.name,
  orgNumber: c.orgNumber,
  email: c.email,
  phone: c.phone,
  address: c.address,
  postalCode: c.postalCode,
  city: c.city,
});
export type CustomerDto = ReturnType<typeof customerDto>;

export const productDto = (p: ProductRow) => ({ id: p.id, name: p.name, unit: p.unit, unitPrice: p.unitPrice, vatRate: p.vatRate });
export type ProductDto = ReturnType<typeof productDto>;

export async function customerById(tx: Tx, orgId: string, id: string): Promise<CustomerRow> {
  if (!isUuid(id)) throw notFound();
  const row = (await tx.select().from(customers).where(and(eq(customers.orgId, orgId), eq(customers.id, id))).limit(1))[0];
  if (!row) throw notFound(true);
  return row;
}

export async function productById(tx: Tx, orgId: string, id: string): Promise<ProductRow> {
  if (!isUuid(id)) throw notFound();
  const row = (await tx.select().from(products).where(and(eq(products.orgId, orgId), eq(products.id, id))).limit(1))[0];
  if (!row) throw notFound(true);
  return row;
}

/** Tildeler neste kundenummer. Oppdateringen låser bedriftsraden til transaksjonen er ferdig, så to samtidige kunder får ulike numre. */
export async function takeCustomerNumber(tx: Tx, orgId: string): Promise<number> {
  const [row] = await tx
    .update(organizations)
    .set({ nextCustomerNumber: sql`${organizations.nextCustomerNumber} + 1` })
    .where(eq(organizations.id, orgId))
    .returning({ next: organizations.nextCustomerNumber });
  return row.next - 1;
}

// ---------------------------------------------------------------------------
// Fakturaer
// ---------------------------------------------------------------------------

export type InvoiceLineDto = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: VatRate;
  productId: string | null;
  net: number;
};

export type InvoiceDto = {
  id: string;
  status: InvoiceRow['status'];
  customer: CustomerDto;
  theirReference: string;
  note: string;
  lines: InvoiceLineDto[];
  totals: InvoiceTotals;
  vatRegistered: boolean;
  createdAt: Date;
  updatedAt: Date;
};

async function vatRegistered(tx: Tx, orgId: string): Promise<boolean> {
  const row = (await tx.select({ v: organizations.vatRegistered }).from(organizations).where(eq(organizations.id, orgId)).limit(1))[0];
  return !!row?.v;
}

export async function invoiceById(tx: Tx, orgId: string, id: string): Promise<InvoiceDto> {
  if (!isUuid(id)) throw notFound();
  const row = (
    await tx
      .select({ i: invoices, c: customers })
      .from(invoices)
      .innerJoin(customers, eq(customers.id, invoices.customerId))
      .where(and(eq(invoices.orgId, orgId), eq(invoices.id, id)))
      .limit(1)
  )[0];
  if (!row) throw notFound(true);
  const lineRows = await tx.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, id)).orderBy(asc(invoiceLines.position));
  const lines: InvoiceLineDto[] = lineRows.map((l) => ({
    id: l.id,
    description: l.description,
    quantity: Number(l.quantity),
    unit: l.unit,
    unitPrice: l.unitPrice,
    vatRate: l.vatRate as VatRate,
    productId: l.productId,
    net: lineTotals({ description: l.description, quantity: Number(l.quantity), unitPrice: l.unitPrice, vatRate: l.vatRate as VatRate }).net,
  }));
  const vat = await vatRegistered(tx, orgId);
  return {
    id: row.i.id,
    status: row.i.status,
    customer: customerDto(row.c),
    theirReference: row.i.theirReference,
    note: row.i.note,
    lines,
    totals: invoiceTotals(lines, vat),
    vatRegistered: vat,
    createdAt: row.i.createdAt,
    updatedAt: row.i.updatedAt,
  };
}

export async function listInvoices(tx: Tx, orgId: string, filter: { customerId?: string | null }) {
  const conds = [eq(invoices.orgId, orgId)];
  if (filter.customerId) {
    if (!isUuid(filter.customerId)) return [];
    conds.push(eq(invoices.customerId, filter.customerId));
  }
  const rows = await tx
    .select({
      id: invoices.id,
      status: invoices.status,
      customerId: invoices.customerId,
      customerName: customers.name,
      customerNumber: customers.customerNumber,
      gross: invoices.gross,
      createdAt: invoices.createdAt,
      updatedAt: invoices.updatedAt,
    })
    .from(invoices)
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .where(and(...conds))
    .orderBy(desc(invoices.createdAt));
  return rows;
}

/**
 * Sjekker kunde og produkter mot bedriften og regner ut summene. Gir feltvise 422-feil,
 * uten å avsløre om en id finnes i en annen bedrift.
 */
async function prepare(tx: Tx, orgId: string, input: InvoiceInput) {
  const errors: FieldError[] = [];
  const customer = (await tx.select({ id: customers.id }).from(customers).where(and(eq(customers.orgId, orgId), eq(customers.id, input.customerId))).limit(1))[0];
  if (!customer) errors.push({ field: 'customerId', message: 'Velg en kunde.' });

  const productIds = [...new Set(input.lines.map((l) => l.productId).filter((p): p is string => !!p))];
  const known = productIds.length
    ? new Set((await tx.select({ id: products.id }).from(products).where(and(eq(products.orgId, orgId), inArray(products.id, productIds)))).map((p) => p.id))
    : new Set<string>();
  input.lines.forEach((l, i) => {
    if (l.productId && !known.has(l.productId)) errors.push({ field: `lines.${i}.productId`, message: 'Produktet finnes ikke lenger. Velg et annet eller skriv linjen selv.' });
  });

  // Uten mva-registrering lagres alle linjer med sats 0.
  const vat = await vatRegistered(tx, orgId);
  const lines = input.lines.map((l) => ({ ...l, vatRate: (vat ? l.vatRate : 0) as VatRate, productId: l.productId ?? null }));
  const totals = invoiceTotals(lines, vat);
  if (totals.gross < 0) errors.push({ field: 'lines', message: 'Summen av fakturaen kan ikke være negativ.' });
  if (errors.length) throw invalid(errors);
  return { lines, totals };
}

async function writeLines(tx: Tx, orgId: string, invoiceId: string, lines: Awaited<ReturnType<typeof prepare>>['lines']) {
  await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId));
  await tx.insert(invoiceLines).values(
    lines.map((l, position) => ({
      orgId,
      invoiceId,
      position,
      productId: l.productId,
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      vatRate: l.vatRate,
    })),
  );
}

export async function createInvoice(tx: Tx, orgId: string, userId: string, input: InvoiceInput): Promise<InvoiceDto> {
  const { lines, totals } = await prepare(tx, orgId, input);
  const [row] = await tx
    .insert(invoices)
    .values({ orgId, customerId: input.customerId, theirReference: input.theirReference, note: input.note, net: totals.net, vat: totals.vat, gross: totals.gross, createdBy: userId })
    .returning({ id: invoices.id });
  await writeLines(tx, orgId, row.id, lines);
  return invoiceById(tx, orgId, row.id);
}

export async function updateInvoice(tx: Tx, orgId: string, id: string, input: InvoiceInput): Promise<InvoiceDto> {
  await invoiceById(tx, orgId, id);
  const { lines, totals } = await prepare(tx, orgId, input);
  await tx
    .update(invoices)
    .set({ customerId: input.customerId, theirReference: input.theirReference, note: input.note, net: totals.net, vat: totals.vat, gross: totals.gross, updatedAt: new Date() })
    .where(and(eq(invoices.orgId, orgId), eq(invoices.id, id)));
  await writeLines(tx, orgId, id, lines);
  return invoiceById(tx, orgId, id);
}

export async function deleteInvoice(tx: Tx, orgId: string, id: string): Promise<void> {
  await invoiceById(tx, orgId, id);
  await tx.delete(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, id)));
}

/** Det fakturaskjemaet trenger: kunder, produkter og om bedriften er mva-registrert. */
export async function editorData(tx: Tx, orgId: string) {
  const [customerRows, productRows, vat] = await Promise.all([
    tx.select().from(customers).where(eq(customers.orgId, orgId)).orderBy(asc(sql`lower(${customers.name})`)),
    tx.select().from(products).where(eq(products.orgId, orgId)).orderBy(asc(sql`lower(${products.name})`)),
    vatRegistered(tx, orgId),
  ]);
  return { customers: customerRows.map(customerDto), products: productRows.map(productDto), vatRegistered: vat };
}
