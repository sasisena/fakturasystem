/** Produkter: faste varer og tjenester som kan velges på fakturalinjer. */
import { and, asc, eq, sql } from 'drizzle-orm';
import { products } from '@/db/schema';
import { productById, productDto } from '../invoicing';
import { json, route } from '../router';
import { parse, productSchema } from '../validation';

route({
  method: 'GET',
  pattern: '/api/products',
  handler: async (c) => {
    const orgId = c.access.require('faktura:se');
    const rows = await c.tx.select().from(products).where(eq(products.orgId, orgId)).orderBy(asc(sql`lower(${products.name})`)).limit(1000);
    return rows.map(productDto);
  },
});

route({
  method: 'POST',
  pattern: '/api/products',
  handler: async (c) => {
    const orgId = c.access.require('faktura:endre');
    const input = parse(productSchema, await c.body());
    const [row] = await c.tx.insert(products).values({ ...input, orgId }).returning();
    return json(productDto(row), 201);
  },
});

route({
  method: 'PUT',
  pattern: '/api/products/:id',
  handler: async (c) => {
    const orgId = c.access.require('faktura:endre');
    await productById(c.tx, orgId, c.params.id);
    const input = parse(productSchema, await c.body());
    const [row] = await c.tx.update(products).set(input).where(and(eq(products.orgId, orgId), eq(products.id, c.params.id))).returning();
    return productDto(row);
  },
});

route({
  method: 'DELETE',
  pattern: '/api/products/:id',
  handler: async (c) => {
    const orgId = c.access.require('faktura:endre');
    await productById(c.tx, orgId, c.params.id);
    await c.tx.delete(products).where(and(eq(products.orgId, orgId), eq(products.id, c.params.id)));
    return json(null, 204);
  },
});
