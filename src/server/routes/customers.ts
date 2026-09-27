/** Kunder: liste med søk, opprette, se, endre og slette. */
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { customers, invoices } from '@/db/schema';
import { conflict } from '../errors';
import { customerById, customerDto, takeCustomerNumber } from '../invoicing';
import { json, route } from '../router';
import { customerSchema, parse } from '../validation';

route({
  method: 'GET',
  pattern: '/api/customers',
  handler: async (c) => {
    const orgId = c.access.require('faktura:se');
    const q = (c.query.get('q') ?? '').trim().slice(0, 100);
    const conds = [eq(customers.orgId, orgId)];
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      conds.push(or(ilike(customers.name, like), ilike(customers.orgNumber, like), sql`${customers.customerNumber}::text = ${q}`)!);
    }
    const rows = await c.tx.select().from(customers).where(and(...conds)).orderBy(asc(sql`lower(${customers.name})`)).limit(500);
    return rows.map(customerDto);
  },
});

route({
  method: 'POST',
  pattern: '/api/customers',
  handler: async (c) => {
    const orgId = c.access.require('faktura:endre');
    const input = parse(customerSchema, await c.body());
    const customerNumber = await takeCustomerNumber(c.tx, orgId);
    const [row] = await c.tx.insert(customers).values({ ...input, orgId, customerNumber }).returning();
    return json(customerDto(row), 201);
  },
});

route({
  method: 'GET',
  pattern: '/api/customers/:id',
  handler: async (c) => customerDto(await customerById(c.tx, c.access.require('faktura:se'), c.params.id)),
});

route({
  method: 'PUT',
  pattern: '/api/customers/:id',
  handler: async (c) => {
    const orgId = c.access.require('faktura:endre');
    await customerById(c.tx, orgId, c.params.id);
    const input = parse(customerSchema, await c.body());
    const [row] = await c.tx.update(customers).set(input).where(and(eq(customers.orgId, orgId), eq(customers.id, c.params.id))).returning();
    return customerDto(row);
  },
});

route({
  method: 'DELETE',
  pattern: '/api/customers/:id',
  handler: async (c) => {
    const orgId = c.access.require('faktura:endre');
    await customerById(c.tx, orgId, c.params.id);
    const used = await c.tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.customerId, c.params.id)).limit(1);
    if (used.length) throw conflict('kunde_har_fakturaer', 'Kunden har fakturaer og kan ikke slettes.');
    await c.tx.delete(customers).where(and(eq(customers.orgId, orgId), eq(customers.id, c.params.id)));
    return json(null, 204);
  },
});
