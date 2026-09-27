/** Fakturautkast og PDF. Nummer, KID, utsending og kreditnota kommer i fase 3. */
import { and, eq } from 'drizzle-orm';
import { invoices, organizations } from '@/db/schema';
import { createInvoice, deleteInvoice, invoiceById, listInvoices, updateInvoice } from '../invoicing';
import { creditInvoice, dashboard, markPaid, markUnpaid, sellerSnapshot, sendInvoice, setNextInvoiceNumber } from '../sending';
import { invoiceFilename, renderInvoicePdf } from '../pdf';
import { json, route } from '../router';
import { invoiceSchema, parse } from '../validation';

route({
  method: 'GET',
  pattern: '/api/invoices',
  handler: async (c) => listInvoices(c.tx, c.access.require('faktura:se'), { customerId: c.query.get('customerId'), status: c.query.get('status') }),
});

route({
  method: 'POST',
  pattern: '/api/invoices',
  handler: async (c) => {
    const orgId = c.access.require('faktura:endre');
    return json(await createInvoice(c.tx, orgId, c.userId, parse(invoiceSchema, await c.body())), 201);
  },
});

route({
  method: 'GET',
  pattern: '/api/invoices/:id',
  handler: async (c) => invoiceById(c.tx, c.access.require('faktura:se'), c.params.id),
});

route({
  method: 'PUT',
  pattern: '/api/invoices/:id',
  handler: async (c) => {
    const orgId = c.access.require('faktura:endre');
    return updateInvoice(c.tx, orgId, c.params.id, parse(invoiceSchema, await c.body()));
  },
});

route({
  method: 'DELETE',
  pattern: '/api/invoices/:id',
  handler: async (c) => {
    await deleteInvoice(c.tx, c.access.require('faktura:endre'), c.params.id);
    return json(null, 204);
  },
});

route({
  method: 'GET',
  pattern: '/api/invoices/:id/pdf',
  handler: async (c) => {
    const orgId = c.access.require('faktura:se');
    const inv = await invoiceById(c.tx, orgId, c.params.id);
    // Utkast tegnes med dagens firmaopplysninger; sendte med dem som ble frosset ved utsending.
    const seller = inv.seller ?? sellerSnapshot((await c.tx.select().from(organizations).where(eq(organizations.id, orgId)).limit(1))[0]);
    const credited = inv.creditOf
      ? (await c.tx.select({ number: invoices.number }).from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, inv.creditOf))).limit(1))[0]
      : undefined;
    const pdf = await renderInvoicePdf(inv, seller, credited);
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${invoiceFilename(inv)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  },
});

route({
  method: 'POST',
  pattern: '/api/invoices/:id/send',
  handler: async (c) => sendInvoice(c.tx, c.access.require('faktura:endre'), c.userId, c.params.id, (await c.body()).delivery),
});

route({
  method: 'POST',
  pattern: '/api/invoices/:id/mark-paid',
  handler: async (c) => markPaid(c.tx, c.access.require('faktura:endre'), c.userId, c.params.id, (await c.body()).paidDate),
});

route({
  method: 'POST',
  pattern: '/api/invoices/:id/mark-unpaid',
  handler: async (c) => markUnpaid(c.tx, c.access.require('faktura:endre'), c.userId, c.params.id),
});

route({
  method: 'POST',
  pattern: '/api/invoices/:id/credit',
  handler: async (c) => json(await creditInvoice(c.tx, c.access.require('faktura:endre'), c.userId, c.params.id, (await c.body()).delivery), 201),
});

route({
  method: 'GET',
  pattern: '/api/dashboard',
  handler: async (c) => dashboard(c.tx, c.access.require('faktura:se')),
});

route({
  method: 'PUT',
  pattern: '/api/organizations/current/invoice-number',
  handler: async (c) => setNextInvoiceNumber(c.tx, c.access.require('firma:endre'), c.userId, await c.body()),
});
