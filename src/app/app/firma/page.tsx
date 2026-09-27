import type { Metadata } from 'next';
import { Alert, Card } from '@/components/ui/card';
import { formatAccountNumber } from '@/lib/faktura';
import { requireOrg } from '@/server/page-auth';
import { currentOrganization, orgDto } from '@/server/org-data';
import { CompanyForm } from './company-form';
import { InvoiceNumber } from './invoice-number';

export const metadata: Metadata = { title: 'Firma' };

export default async function CompanyPage() {
  const u = await requireOrg('/app/firma');
  const dto = orgDto(await currentOrganization(u));
  const org = { ...dto, accountNumber: formatAccountNumber(dto.accountNumber) };
  const canEdit = u.access.can('firma:endre');
  return (
    <div className="flex flex-col gap-6">
      <h1>Firmaopplysninger</h1>
      <p className="text-muted">Dette står på fakturaene dine. Organisasjonsnummer, adresse og kontonummer må være fylt ut før du kan sende faktura.</p>
      {!canEdit && <Alert tone="info">Du kan se opplysningene, men bare eiere og administratorer kan endre dem.</Alert>}
      <Card>
        <CompanyForm initial={org} readOnly={!canEdit} />
      </Card>
      <Card>
        <h2 className="mb-3">Fakturanummer</h2>
        <InvoiceNumber next={dto.nextInvoiceNumber} canEdit={canEdit} />
      </Card>
    </div>
  );
}
