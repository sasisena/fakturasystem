/** Fakturautkast og PDF. Nummer, KID, utsending og kreditnota kommer i fase 3. */
import { eq } from 'drizzle-orm';
import { organizations } from '@/db/schema';
import { createInvoice, deleteInvoice, invoiceById, listInvoices, updateInvoice } from '../invoicing';
import { invoiceFilename, renderInvoicePdf } from '../pdf';
import { json, route } from '../router';
import { invoiceSchema, parse } from '../validation';

route({
  method: 'GET',
  pattern: '/api/invoices',
  handler: async (c) => listInvoices(c.tx, c.access.require('faktura:se'), { customerId: c.query.get('customerId') }),
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
    const [seller] = await c.tx.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    const pdf = await renderInvoicePdf(inv, seller);
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${invoiceFilename(inv)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  },
});
