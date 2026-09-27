/**
 * Sender meldinger fra utboksen. E-post via SMTP (SMTP_URL). I testmodus sendes ingenting.
 */
import { and, asc, isNull, eq } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { outbox } from '@/db/schema';
import type { Tx } from './db';
import { config } from './env';
import { invoiceById } from './invoicing';
import type { Attachment, Message, MessageChannel } from './messaging';
import { invoiceFilename, renderInvoicePdf } from './pdf';

const email: MessageChannel = {
  name: 'email',
  async deliver(m: Message, attachments: Attachment[] = []) {
    const transport = nodemailer.createTransport(config.smtpUrl);
    await transport.sendMail({ from: config.emailFrom, to: m.to, replyTo: m.replyTo ?? undefined, subject: m.subject ?? 'Fakturasystem', text: m.body, attachments });
  },
};

/** `channels` brukes bare av testene; da sendes det også i testmodus, men bare til den oppgitte kanalen. */
export async function deliverOutbox(tx: Tx, limit = 200, channels?: Partial<Record<string, MessageChannel>>): Promise<{ sent: number; failed: number }> {
  if (!channels) {
    if (config.testMode) return { sent: 0, failed: 0 };
    channels = config.smtpUrl ? { email } : {};
  }
  const pending = await tx.select().from(outbox).where(and(isNull(outbox.sentAt), isNull(outbox.error))).orderBy(asc(outbox.seq)).limit(limit);
  let sent = 0;
  let failed = 0;
  for (const m of pending) {
    const ch = channels[m.channel];
    if (!ch) continue;
    try {
      // PDF-en lages fra fakturaens frosne opplysninger, så den er lik den brukeren ser i appen.
      const attachments: Attachment[] = [];
      if (m.invoiceId && m.orgId) {
        const inv = await invoiceById(tx, m.orgId, m.invoiceId);
        attachments.push({ filename: invoiceFilename(inv), content: await renderInvoicePdf(inv, inv.seller!), contentType: 'application/pdf' });
      }
      await ch.deliver({ channel: 'email', to: m.to, replyTo: m.replyTo, subject: m.subject ?? undefined, body: m.body }, attachments);
      await tx.update(outbox).set({ sentAt: new Date() }).where(eq(outbox.seq, m.seq));
      sent++;
    } catch (e) {
      await tx.update(outbox).set({ error: e instanceof Error ? e.message.slice(0, 200) : 'ukjent feil' }).where(eq(outbox.seq, m.seq));
      failed++;
    }
  }
  return { sent, failed };
}
