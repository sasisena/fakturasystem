import type { Metadata } from 'next';
import { asc, eq, sql } from 'drizzle-orm';
import { organizations, products } from '@/db/schema';
import { productDto } from '@/server/invoicing';
import { withOrg } from '@/server/org-data';
import { requireOrg } from '@/server/page-auth';
import { ProductList } from './product-list';

export const metadata: Metadata = { title: 'Produkter' };

export default async function ProductsPage() {
  const u = await requireOrg('/app/produkter');
  const { list, vatRegistered } = await withOrg(u, 'faktura:se', async (tx, orgId) => ({
    list: (await tx.select().from(products).where(eq(products.orgId, orgId)).orderBy(asc(sql`lower(${products.name})`))).map(productDto),
    vatRegistered: (await tx.select({ v: organizations.vatRegistered }).from(organizations).where(eq(organizations.id, orgId)))[0]?.v ?? false,
  }));
  return <ProductList products={list} canEdit={u.access.can('faktura:endre')} vatRegistered={vatRegistered} />;
}
