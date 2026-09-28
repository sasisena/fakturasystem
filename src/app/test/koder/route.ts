/**
 * Testside for testmiljøet: viser innloggingskoder og e-post fra utboksen, gjeldende tofaktor-kode
 * for hver bruker, og PDF-en til fakturaer som er «sendt». Slik kan man prøve systemet uten at
 * e-post faktisk kommer frem.
 *
 * Finnes bare når TEST_PAGE_PASSWORD er satt, og er beskyttet med det passordet (HTTP Basic).
 * Alle andre får 404. Siden gir innlogging som hvilken som helst bruker, så den skal aldri slås på
 * i produksjon. Testmiljøet skal bare ha oppdiktede data.
 */
import { asc, desc, eq, gt } from 'drizzle-orm';
import { outbox, users } from '@/db/schema';
import { now } from '@/server/clock';
import { decrypt, safeEqual } from '@/server/crypto';
import { withSystem } from '@/server/db';
import { config } from '@/server/env';
import { invoiceById } from '@/server/invoicing';
import { invoiceFilename, renderInvoicePdf } from '@/server/pdf';
import { hotp } from '@/server/totp';

export const dynamic = 'force-dynamic';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function notFound() {
  return new Response('Fant ikke siden.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

function authorized(req: Request): boolean {
  const h = req.headers.get('authorization') ?? '';
  if (!h.startsWith('Basic ')) return false;
  const decoded = Buffer.from(h.slice(6), 'base64').toString('utf8');
  return safeEqual(decoded.slice(decoded.indexOf(':') + 1), config.testPagePassword);
}

function guard(req: Request): Response | null {
  if (!config.testPagePassword) return notFound();
  if (!authorized(req)) {
    return new Response('Skriv passordet for testsiden (brukernavn kan være hva som helst).', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Fakturasystem testside", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  return null;
}

const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const time = (d: Date) => d.toLocaleString('nb-NO', { timeZone: 'Europe/Oslo', dateStyle: 'short', timeStyle: 'medium' });

export async function GET(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  const url = new URL(req.url);

  // PDF-en til en faktura-e-post fra utboksen: /test/koder?pdf=<nr>
  const pdfSeq = Number(url.searchParams.get('pdf'));
  if (pdfSeq) {
    const pdf = await withSystem(async (tx) => {
      const m = (await tx.select().from(outbox).where(eq(outbox.seq, pdfSeq)).limit(1))[0];
      if (!m?.invoiceId || !m.orgId) return null;
      const inv = await invoiceById(tx, m.orgId, m.invoiceId);
      return { name: invoiceFilename(inv), body: await renderInvoicePdf(inv, inv.seller!) };
    });
    if (!pdf) return notFound();
    return new Response(new Uint8Array(pdf.body), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${pdf.name}"`, 'Cache-Control': 'no-store' },
    });
  }

  const data = await withSystem(async (tx) => {
    // Utboksen bruker systemklokken (testklokken i testmodus), så «siste døgn» regnes etter den.
    const since = new Date(now().getTime() - 24 * 60 * 60 * 1000);
    const mails = await tx.select().from(outbox).where(gt(outbox.createdAt, since)).orderBy(desc(outbox.seq)).limit(50);
    const us = await tx.select().from(users).orderBy(asc(users.email)).limit(200);
    return { mails, us };
  });

  const step = Math.floor(Date.now() / 1000 / 30);
  const secondsLeft = 30 - (Math.floor(Date.now() / 1000) % 30);
  const codeOf = (body: string) => body.match(/\b(\d{6})\b/)?.[1] ?? '';
  const loginCodes = data.mails.filter((m) => /Innloggingskode/.test(m.subject ?? '')).slice(0, 15);
  const otherMails = data.mails.filter((m) => !loginCodes.includes(m) && !/Innloggingskode/.test(m.subject ?? ''));
  const status = (m: (typeof data.mails)[number]) =>
    m.error ? `<span class="feil">Feilet: ${esc(m.error)}</span>` : m.sentAt ? 'Sendt' : config.smtpUrl ? 'Venter på utsending' : 'Ikke sendt (e-post er slått av)';

  const userRows = data.us
    .map((u) => {
      let totp = '';
      if (u.totpSecret) {
        try {
          totp = hotp(decrypt(u.totpSecret), step);
        } catch {
          totp = '–';
        }
      }
      return `<tr><td>${esc(u.email)}</td><td>${u.totpEnabled ? 'Ja' : u.totpSecret ? 'Under oppsett' : 'Nei'}</td><td class="kode">${esc(totp)}</td></tr>`;
    })
    .join('');

  const html = `<!doctype html><html lang="nb"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="15"><title>Testside – Fakturasystem</title>
<style>
body{font-family:system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem;color:#1B1F1D;background:#F7F6F2;line-height:1.5}
h1{margin-bottom:.25rem}.varsel{background:#FFEFB8;border-left:4px solid #6B4E00;padding:.75rem 1rem}
table{border-collapse:collapse;width:100%;background:#fff;margin:.5rem 0 1.5rem}th,td{border-bottom:1px solid #D6D3CA;padding:.4rem .6rem;text-align:left;vertical-align:top}
th{background:#F0EFEA}.kode{font:700 1.4rem ui-monospace,monospace;letter-spacing:.12em}.feil{color:#A61D13;font-weight:600}
a{color:#1F4D3A}
</style></head><body>
<h1>Testside</h1>
<p class="varsel"><strong>Bare for testmiljøet.</strong> Bruk bare oppdiktede data. Siden oppdateres av seg selv hvert 15. sekund.</p>
<p>Versjon: <strong>${esc(process.env.APP_VERSION ?? 'lokal')}</strong> · E-post: <strong>${config.smtpUrl ? 'slått på (sendes også ut)' : 'slått av (vises bare her)'}</strong></p>

<h2>Slik logger du inn</h2>
<ol><li>Gå til <a href="/logg-inn" target="_blank">innloggingssiden</a>, skriv en e-postadresse og trykk «Send kode».</li>
<li>Kom tilbake hit og les av innloggingskoden.</li>
<li>Tofaktor: skann QR-koden med en app, eller les av koden i brukerlisten under når oppsettet er startet.</li></ol>

<h2>Innloggingskoder (siste døgn)</h2>
${loginCodes.length === 0 ? '<p>Ingen koder ennå.</p>' : `<table><thead><tr><th>Tid</th><th>E-post</th><th>Kode</th></tr></thead><tbody>${loginCodes
    .map((m) => `<tr><td>${esc(time(m.createdAt))}</td><td>${esc(m.to)}</td><td class="kode">${esc(codeOf(m.body))}</td></tr>`)
    .join('')}</tbody></table>`}
<p>En kode gjelder i 10 minutter og kan bare brukes én gang.</p>

<h2>Brukere og tofaktor-kode nå</h2>
<p>Koden gjelder i ${secondsLeft} sekunder til.</p>
<table><thead><tr><th>E-post</th><th>Tofaktor på</th><th>Kode nå</th></tr></thead><tbody>${userRows || '<tr><td colspan="3">Ingen brukere ennå.</td></tr>'}</tbody></table>

<h2>Fakturaer og andre e-poster (siste døgn)</h2>
${otherMails.length === 0 ? '<p>Ingen.</p>' : `<table><thead><tr><th>Tid</th><th>Til</th><th>Emne</th><th>Status</th><th>PDF</th></tr></thead><tbody>${otherMails
    .map((m) => `<tr><td>${esc(time(m.createdAt))}</td><td>${esc(m.to)}</td><td>${esc(m.subject)}<details><summary>Tekst</summary><div style="white-space:pre-wrap">${esc(m.body)}</div></details></td><td>${status(m)}</td><td>${m.invoiceId ? `<a href="/test/koder?pdf=${m.seq}" target="_blank">Åpne</a>` : ''}</td></tr>`)
    .join('')}</tbody></table>`}
</body></html>`;
  return new Response(html, { headers });
}
