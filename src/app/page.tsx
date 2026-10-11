import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { buttonVariants } from '@/components/ui/button';
import { currentUser } from '@/server/page-auth';

export default async function Home() {
  if (await currentUser()) redirect('/app');
  return (
    <AuthShell>
      <h1 className="text-3xl">Fakturaer som blir betalt</h1>
      <p className="mt-3 text-lg text-muted">
        Lag og send en faktura på under et minutt – fra telefonen eller datamaskinen. Med mva, KID og alt det norske regelverket krever.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <a href="/logg-inn?neste=/kom-i-gang" className={buttonVariants()}>Kom i gang gratis</a>
        <a href="/logg-inn" className={buttonVariants({ variant: 'secondary' })}>Logg inn</a>
      </div>
    </AuthShell>
  );
}
