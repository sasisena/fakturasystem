import { AlertTriangle, CheckCircle2, Circle, Contact, FilePen, FileText, Plus, Wallet } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { InvoiceRows } from '@/components/invoice-rows';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { formatNok } from '@/lib/faktura';
import { listInvoices } from '@/server/invoicing';
import { dashboard } from '@/server/sending';
import { requireOrg } from '@/server/page-auth';
import { currentOrganization, missingForInvoicing, withOrg } from '@/server/org-data';

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
  const { invoices, stats } = await withOrg(u, 'faktura:se', async (tx, orgId) => ({ invoices: await listInvoices(tx, orgId, {}), stats: await dashboard(tx, orgId) }));
  const count = (n: number) => `${n} ${n === 1 ? 'faktura' : 'fakturaer'}`;
  const firstName = u.session.user.name?.trim().split(/\s+/)[0];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1>{firstName ? `Velkommen tilbake, ${firstName}` : 'Velkommen'}</h1>
        <p className="mt-1 text-sm text-muted">Her er oversikten over faktureringen din.</p>
      </div>

      {(missing.length > 0 || invoices.length === 0) && (
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
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/app/fakturaer?status=ubetalt" className="text-ink no-underline"><StatCard tone="blue" icon={Wallet} label="Utestående" value={formatNok(stats.outstanding)} hint={count(stats.outstandingCount)} /></Link>
        <Link href="/app/fakturaer?status=forfalt" className="text-ink no-underline"><StatCard tone={stats.overdueCount ? 'red' : 'green'} icon={AlertTriangle} label="Forfalt" value={formatNok(stats.overdue)} hint={count(stats.overdueCount)} /></Link>
        <Link href="/app/fakturaer?status=betalt" className="text-ink no-underline"><StatCard tone="green" icon={CheckCircle2} label="Betalt denne måneden" value={formatNok(stats.paidThisMonth)} hint="Registrert som betalt" /></Link>
        <Link href="/app/fakturaer?status=utkast" className="text-ink no-underline"><StatCard tone="purple" icon={FilePen} label="Utkast" value={stats.draftCount} hint="Ikke sendt ennå" /></Link>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2>Siste fakturaer</h2>
          {invoices.length > 5 && <Link href="/app/fakturaer" className="text-sm font-semibold">Se alle</Link>}
        </div>
        {invoices.length ? <InvoiceRows invoices={invoices.slice(0, 5)} /> : <p className="text-muted">Ingen fakturaer ennå. Lag din første – det tar under et minutt.</p>}
      </section>

      <div className="hidden flex-wrap gap-3 md:flex">
        {u.access.can('faktura:endre') && (
          <Link href="/app/fakturaer/ny" className={buttonVariants()}><Plus className="size-5" aria-hidden="true" /> Ny faktura</Link>
        )}
        <Link href="/app/fakturaer" className={buttonVariants({ variant: 'secondary' })}><FileText className="size-5" aria-hidden="true" /> Se fakturaer</Link>
        <Link href="/app/kunder" className={buttonVariants({ variant: 'secondary' })}><Contact className="size-5" aria-hidden="true" /> Se kunder</Link>
      </div>
    </div>
  );
}
