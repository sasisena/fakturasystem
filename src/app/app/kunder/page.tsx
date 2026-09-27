import type { Metadata } from 'next';
import { asc, eq, sql } from 'drizzle-orm';
import { customers } from '@/db/schema';
import { customerDto } from '@/server/invoicing';
import { withOrg } from '@/server/org-data';
import { requireOrg } from '@/server/page-auth';
import { CustomerList } from './customer-list';

export const metadata: Metadata = { title: 'Kunder' };

export default async function CustomersPage() {
  const u = await requireOrg('/app/kunder');
  const list = await withOrg(u, 'faktura:se', async (tx, orgId) =>
    (await tx.select().from(customers).where(eq(customers.orgId, orgId)).orderBy(asc(sql`lower(${customers.name})`))).map(customerDto),
  );
  return <CustomerList customers={list} canEdit={u.access.can('faktura:endre')} />;
}
