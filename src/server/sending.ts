/**
 * Utsending av fakturaer, betaling og kreditnota.
 *
 * Fakturanummeret tildeles i samme transaksjon som utsendingen: UPDATE … RETURNING på bedriftsraden
 * låser raden til transaksjonen er ferdig, så samtidige utsendinger får hvert sitt nummer, og
 * nummeret rulles tilbake sammen med resten hvis noe feiler. Serien får aldri hull eller dubletter.
 */
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { customers, invoiceLines, invoices, organizations, type PartySnapshot } from '@/db/schema';
import { addDays, canTransition, formatAccountNumber, formatNok, generateKid, invoiceTotals, type InvoiceStatus, type VatRate } from '@/lib/faktura';
import { audit } from './audit';
import { todayOslo } from './clock';
import type { Tx } from './db';
import { conflict, invalid } from './errors';
import { alreadySent, invoiceById, isOverdueRow, type InvoiceDto } from './invoicing';
import { enqueue } from './messaging';
import { missingForInvoicing, type OrgRow } from './org-data';

export type Delivery = 'epost' | 'manuell';

const formatDate = (iso: string) => iso.split('-').reverse().join('.');

export function sellerSnapshot(o: OrgRow): PartySnapshot {
  return {
    name: o.name,
    orgNumber: o.orgNumber,
    organizationForm: o.organizationForm,
    vatRegistered: o.vatRegistered,
    address: o.address,
    postalCode: o.postalCode,
    city: o.city,
    email: o.email,
    phone: o.phone,
    accountNumber: o.accountNumber,
  };
}

function buyerSnapshot(c: typeof customers.$inferSelect): PartySnapshot {
  return { name: c.name, orgNumber: c.orgNumber, address: c.address, postalCode: c.postalCode, city: c.city, email: c.email, phone: c.phone, customerNumber: c.customerNumber };
}

async function orgRow(tx: Tx, orgId: string): Promise<OrgRow> {
  return (await tx.select().from(organizations).where(eq(organizations.id, orgId)).limit(1))[0];
}

async function takeInvoiceNumber(tx: Tx, orgId: string): Promise<number> {
  const [row] = await tx
    .update(organizations)
    .set({ nextInvoiceNumber: sql`${organizations.nextInvoiceNumber} + 1` })
    .where(eq(organizations.id, orgId))
    .returning({ next: organizations.nextInvoiceNumber });
  return row.next - 1;
}

function checkDelivery(delivery: unknown): Delivery {
  if (delivery !== 'epost' && delivery !== 'manuell') {
    throw invalid([{ field: 'delivery', message: 'Velg om fakturaen skal sendes på e-post eller om du sender den selv.' }]);
  }
  return delivery;
}

/** E-posten til kunden. PDF-en legges ved av utsendingsjobben (outbox.invoice_id). */
async function queueEmail(tx: Tx, orgId: string, inv: InvoiceDto) {
  const seller = inv.seller!;
  const isCredit = inv.kind === 'kreditnota';
  const title = `${isCredit ? 'Kreditnota' : 'Faktura'} ${inv.number}`;
  const body = isCredit
    ? [
        'Hei!',
        '',
        `Vedlagt er ${title.toLowerCase()} fra ${seller.name} på ${formatNok(Math.abs(inv.totals.gross))}.`,
        'Den krediterer (nuller ut) en tidligere faktura. Du trenger ikke betale noe for den.',
        '',
        'Med vennlig hilsen',
        seller.name,
      ]
    : [
        'Hei!',
        '',
        `Vedlagt er ${title.toLowerCase()} fra ${seller.name} på ${formatNok(inv.totals.gross)}.`,
        '',
        `Forfallsdato: ${formatDate(inv.dueDate!)}`,
        `Kontonummer: ${formatAccountNumber(seller.accountNumber ?? '')}`,
        `KID: ${inv.kid}`,
        '',
        'Husk å bruke KID når du betaler.',
        '',
        'Med vennlig hilsen',
        seller.name,
      ];
  await enqueue(tx, {
    channel: 'email',
    orgId,
    to: inv.customer.email,
    replyTo: seller.email || null,
    invoiceId: inv.id,
    subject: `${title} fra ${seller.name}`,
    body: body.join('\n'),
  });
}

export async function sendInvoice(tx: Tx, orgId: string, userId: string, id: string, deliveryInput: unknown): Promise<InvoiceDto> {
  const delivery = checkDelivery(deliveryInput);
  const draft = await invoiceById(tx, orgId, id);
  if (draft.status !== 'utkast') throw alreadySent();
  const org = await orgRow(tx, orgId);
  const missing = missingForInvoicing(org);
  if (missing.length) {
    throw conflict('mangler_firmaopplysninger', `Fyll ut ${missing.join(', ')} under Firma før du sender fakturaen.`, { missing });
  }
  const customer = (await tx.select().from(customers).where(and(eq(customers.orgId, orgId), eq(customers.id, draft.customer.id))).limit(1))[0];
  if (delivery === 'epost' && !customer.email) {
    throw conflict('kunde_mangler_epost', 'Kunden har ingen e-postadresse. Legg den til på kunden, eller send fakturaen selv.');
  }

  // Mva-status og summer fryses slik de er nå, også om bedriften endrer mva-registrering senere.
  const lines = draft.lines.map((l) => ({ ...l, vatRate: (org.vatRegistered ? l.vatRate : 0) as VatRate }));
  const totals = invoiceTotals(lines, org.vatRegistered);
  if (!org.vatRegistered && draft.lines.some((l) => l.vatRate !== 0)) {
    for (const l of draft.lines) await tx.update(invoiceLines).set({ vatRate: 0 }).where(eq(invoiceLines.id, l.id));
  }

  const number = await takeInvoiceNumber(tx, orgId);
  const issueDate = todayOslo();
  await tx
    .update(invoices)
    .set({
      status: 'sendt',
      number,
      kid: generateKid(customer.customerNumber, number),
      issueDate,
      dueDate: addDays(issueDate, org.paymentTermsDays),
      delivery,
      sentTo: delivery === 'epost' ? customer.email : null,
      sentAt: new Date(),
      sentBy: userId,
      seller: sellerSnapshot(org),
      buyer: buyerSnapshot(customer),
      vatRegistered: org.vatRegistered,
      net: totals.net,
      vat: totals.vat,
      gross: totals.gross,
      updatedAt: new Date(),
    })
    .where(and(eq(invoices.orgId, orgId), eq(invoices.id, id)));
  const inv = await invoiceById(tx, orgId, id);
  if (delivery === 'epost') await queueEmail(tx, orgId, inv);
  await audit(tx, { orgId, actorId: userId, action: 'faktura_sendt', entity: 'invoice', entityId: id, after: { number, delivery, gross: totals.gross } });
  return inv;
}

async function setStatus(tx: Tx, orgId: string, id: string, status: InvoiceStatus, paidDate: string | null) {
  await tx.update(invoices).set({ status, paidDate, updatedAt: new Date() }).where(and(eq(invoices.orgId, orgId), eq(invoices.id, id)));
}

export async function markPaid(tx: Tx, orgId: string, userId: string, id: string, paidDateInput: unknown): Promise<InvoiceDto> {
  const inv = await invoiceById(tx, orgId, id);
  if (inv.kind !== 'faktura' || inv.status !== 'sendt') throw conflict('ikke_sendt', 'Bare sendte, ubetalte fakturaer kan merkes som betalt.');
  let paidDate = todayOslo();
  if (paidDateInput !== undefined && paidDateInput !== null && paidDateInput !== '') {
    if (typeof paidDateInput !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(paidDateInput) || paidDateInput > todayOslo()) {
      throw invalid([{ field: 'paidDate', message: 'Betalingsdatoen må være en gyldig dato, og ikke i fremtiden.' }]);
    }
    paidDate = paidDateInput;
  }
  await setStatus(tx, orgId, id, 'betalt', paidDate);
  await audit(tx, { orgId, actorId: userId, action: 'faktura_betalt', entity: 'invoice', entityId: id, after: { paidDate } });
  return invoiceById(tx, orgId, id);
}

export async function markUnpaid(tx: Tx, orgId: string, userId: string, id: string): Promise<InvoiceDto> {
  const inv = await invoiceById(tx, orgId, id);
  if (inv.status !== 'betalt') throw conflict('ikke_betalt', 'Fakturaen er ikke merket som betalt.');
  await setStatus(tx, orgId, id, 'sendt', null);
  await audit(tx, { orgId, actorId: userId, action: 'faktura_ubetalt', entity: 'invoice', entityId: id, before: { paidDate: inv.paidDate } });
  return invoiceById(tx, orgId, id);
}

/** Lager en kreditnota som nuller ut hele fakturaen. Returnerer kreditnotaen. */
export async function creditInvoice(tx: Tx, orgId: string, userId: string, id: string, deliveryInput: unknown): Promise<InvoiceDto> {
  const inv = await invoiceById(tx, orgId, id);
  if (inv.kind !== 'faktura') throw conflict('kan_ikke_krediteres', 'En kreditnota kan ikke krediteres.');
  if (inv.status === 'kreditert') throw conflict('allerede_kreditert', 'Fakturaen er allerede kreditert.');
  if (!canTransition(inv.status, 'kreditert')) throw conflict('ikke_sendt', 'Bare sendte fakturaer kan krediteres. Et utkast kan du slette.');
  const delivery = deliveryInput === undefined ? (inv.customer.email ? 'epost' : 'manuell') : checkDelivery(deliveryInput);
  if (delivery === 'epost' && !inv.customer.email) throw conflict('kunde_mangler_epost', 'Kunden har ingen e-postadresse.');

  const row = (await tx.select().from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, id))).limit(1))[0];
  const lines = inv.lines.map((l) => ({ ...l, quantity: -l.quantity }));
  const totals = invoiceTotals(lines, inv.vatRegistered);
  // Kreditnotaen lages som utkast, får linjene, og sendes så – samme rekkefølge som en vanlig faktura,
  // så sperren i databasen mot endring av sendte fakturaer gjelder fra første stund.
  const [cn] = await tx
    .insert(invoices)
    .values({
      orgId,
      customerId: row.customerId,
      kind: 'kreditnota',
      creditOf: id,
      theirReference: inv.theirReference,
      note: `Krediterer faktura ${inv.number}.`,
      createdBy: userId,
    })
    .returning({ id: invoices.id });
  await tx.insert(invoiceLines).values(
    lines.map((l, position) => ({ orgId, invoiceId: cn.id, position, productId: l.productId, description: l.description, quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice, vatRate: l.vatRate })),
  );
  const number = await takeInvoiceNumber(tx, orgId);
  await tx
    .update(invoices)
    .set({
      status: 'sendt',
      number,
      issueDate: todayOslo(),
      delivery,
      sentTo: delivery === 'epost' ? inv.customer.email : null,
      sentAt: new Date(),
      sentBy: userId,
      seller: row.seller,
      buyer: row.buyer,
      vatRegistered: inv.vatRegistered,
      net: totals.net,
      vat: totals.vat,
      gross: totals.gross,
    })
    .where(eq(invoices.id, cn.id));
  await setStatus(tx, orgId, id, 'kreditert', inv.paidDate);
  const credit = await invoiceById(tx, orgId, cn.id);
  if (delivery === 'epost') await queueEmail(tx, orgId, credit);
  await audit(tx, { orgId, actorId: userId, action: 'faktura_kreditert', entity: 'invoice', entityId: id, after: { creditNote: cn.id, number } });
  return credit;
}

export async function setNextInvoiceNumber(tx: Tx, orgId: string, userId: string, body: Record<string, unknown>) {
  const next = body.nextInvoiceNumber;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const org = await orgRow(tx, orgId);
  const errors = [];
  if (typeof next !== 'number' || !Number.isInteger(next) || next < 1 || next > 9_999_999) {
    errors.push({ field: 'nextInvoiceNumber', message: 'Skriv et helt tall mellom 1 og 9 999 999.' });
  } else if (next < org.nextInvoiceNumber) {
    errors.push({ field: 'nextInvoiceNumber', message: `Nummeret kan bare økes. Neste nummer er ${org.nextInvoiceNumber} nå.` });
  }
  if (!reason) errors.push({ field: 'reason', message: 'Skriv hvorfor nummeret endres, for eksempel at du fortsetter serien fra et annet system.' });
  if (errors.length) throw invalid(errors);
  await tx.update(organizations).set({ nextInvoiceNumber: next as number }).where(eq(organizations.id, orgId));
  await audit(tx, { orgId, actorId: userId, action: 'fakturaserie_endret', entity: 'organization', entityId: orgId, before: { nextInvoiceNumber: org.nextInvoiceNumber }, after: { nextInvoiceNumber: next, reason } });
  return { nextInvoiceNumber: next };
}

/** Nøkkeltall på oversikten. Bare fakturaer (ikke kreditnotaer). */
export async function dashboard(tx: Tx, orgId: string) {
  const today = todayOslo();
  const monthStart = `${today.slice(0, 7)}-01`;
  const open = await tx
    .select({ kind: invoices.kind, status: invoices.status, dueDate: invoices.dueDate, gross: invoices.gross })
    .from(invoices)
    .where(and(eq(invoices.orgId, orgId), eq(invoices.kind, 'faktura'), eq(invoices.status, 'sendt')));
  const overdue = open.filter((r) => isOverdueRow(r, today));
  const [paid] = await tx
    .select({ sum: sql<string>`coalesce(sum(${invoices.gross}), 0)` })
    .from(invoices)
    .where(and(eq(invoices.orgId, orgId), eq(invoices.kind, 'faktura'), eq(invoices.status, 'betalt'), gte(invoices.paidDate, monthStart), lt(invoices.paidDate, addDays(monthStart, 32).slice(0, 8) + '01')));
  const [drafts] = await tx.select({ n: sql<number>`count(*)::int` }).from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.status, 'utkast')));
  const sum = (rows: { gross: number }[]) => rows.reduce((s, r) => s + r.gross, 0);
  return {
    outstanding: sum(open),
    outstandingCount: open.length,
    overdue: sum(overdue),
    overdueCount: overdue.length,
    paidThisMonth: Number(paid.sum),
    draftCount: drafts.n,
  };
}
