import { CheckCircle2, Circle, FileText } from 'lucide-react';
import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { requireOrg } from '@/server/page-auth';
import { currentOrganization, missingForInvoicing } from '@/server/org-data';

export const metadata: Metadata = { title: 'Oversikt' };

function Step({ done, children }: { done: boolean; children: React.ReactNode }) {
  const Icon = done ? CheckCircle2 : Circle;
  return (
    <li className="flex items-start gap-3">
      <Icon className={done ? 'mt-0.5 size-6 shrink-0 text-success' : 'mt-0.5 size-6 shrink-0 text-muted'} aria-hidden="true" />
      <span className={done ? 'text-muted' : ''}>
        {done && <span className="sr-only">Fullført: </span>}
        {children}
      </span>
    </li>
  );
}

export default async function Overview() {
  const u = await requireOrg('/app');
  const org = await currentOrganization(u);
  const missing = missingForInvoicing(org);
  const canEdit = u.access.can('firma:endre');
  return (
    <div className="flex flex-col gap-6">
      <h1>Hei{u.session.user.name ? `, ${u.session.user.name}` : ''}!</h1>

      <Card>
        <h2 className="mb-4">Kom i gang</h2>
        <ul className="flex flex-col gap-3">
          <Step done>Bedriften er registrert</Step>
          <Step done>Tofaktor er satt opp</Step>
          <Step done={missing.length === 0}>
            {missing.length === 0 ? 'Firmaopplysningene er komplette' : <>Fyll ut {missing.join(', ')} {canEdit && <>under <a href="/app/firma">Firma</a></>}</>}
          </Step>
          <Step done={false}>
            Inviter regnskapsfører eller kolleger under <a href="/app/brukere">Brukere</a> (valgfritt)
          </Step>
        </ul>
      </Card>

      <Card className="flex items-start gap-4">
        <FileText className="size-8 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h2>Fakturering kommer i neste versjon</h2>
          <p className="mt-1 text-muted">Kunder, fakturaer med mva, PDF og utsending på e-post legges inn i neste leveranse.</p>
        </div>
      </Card>
    </div>
  );
}
