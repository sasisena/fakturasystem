import { redirect } from 'next/navigation';
import { PublicHeader } from '@/components/logo';
import { buttonVariants } from '@/components/ui/button';
import { currentUser } from '@/server/page-auth';

export default async function Home() {
  if (await currentUser()) redirect('/app');
  return (
    <>
      <PublicHeader />
      <main id="innhold" className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
        <h1 className="text-4xl">Fakturaer som blir betalt</h1>
        <p className="text-lg text-muted">
          Lag og send en faktura på under et minutt – fra telefonen eller datamaskinen. Med mva, KID og alt det norske regelverket krever.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="/logg-inn?neste=/kom-i-gang" className={buttonVariants()}>Kom i gang gratis</a>
          <a href="/logg-inn" className={buttonVariants({ variant: 'secondary' })}>Logg inn</a>
        </div>
      </main>
    </>
  );
}
