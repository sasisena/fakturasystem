/**
 * Planlagte jobber: rydding og utsending fra utboksen.
 * Kjør hvert kvarter, f.eks. fra cron med kommandoen npm run jobs:run.
 */
import { withSystem } from '../src/server/db';
import { deliverOutbox } from '../src/server/delivery';
import { runJobs } from '../src/server/jobs';

async function main() {
  const r = await withSystem((tx) => runJobs(tx));
  const d = await withSystem((tx) => deliverOutbox(tx));
  console.log(`Ryddet: ${r.expiredSessions} økter, ${r.oldCodes} koder. Sendt: ${d.sent}, feilet: ${d.failed}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Jobbene feilet:', e instanceof Error ? e.message : e);
  process.exit(1);
});
