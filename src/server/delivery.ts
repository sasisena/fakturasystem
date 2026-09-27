/**
 * Sender meldinger fra utboksen. E-post via SMTP (SMTP_URL). I testmodus sendes ingenting.
 */
import { and, asc, isNull, eq } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { outbox } from '@/db/schema';
import type { Tx } from './db';
import { config } from './env';
import type { Message, MessageChannel } from './messaging';

const email: MessageChannel = {
  name: 'email',
  async deliver(m: Message) {
    const transport = nodemailer.createTransport(config.smtpUrl);
    await transport.sendMail({ from: config.emailFrom, to: m.to, subject: m.subject ?? 'Fakturasystem', text: m.body });
  },
};

export async function deliverOutbox(tx: Tx, limit = 200): Promise<{ sent: number; failed: number }> {
  if (config.testMode) return { sent: 0, failed: 0 };
  const channels: Partial<Record<string, MessageChannel>> = config.smtpUrl ? { email } : {};
  const pending = await tx.select().from(outbox).where(and(isNull(outbox.sentAt), isNull(outbox.error))).orderBy(asc(outbox.seq)).limit(limit);
  let sent = 0;
  let failed = 0;
  for (const m of pending) {
    const ch = channels[m.channel];
    if (!ch) continue;
    try {
      await ch.deliver({ channel: 'email', to: m.to, subject: m.subject ?? undefined, body: m.body });
      await tx.update(outbox).set({ sentAt: new Date() }).where(eq(outbox.seq, m.seq));
      sent++;
    } catch (e) {
      await tx.update(outbox).set({ error: e instanceof Error ? e.message.slice(0, 200) : 'ukjent feil' }).where(eq(outbox.seq, m.seq));
      failed++;
    }
  }
  return { sent, failed };
}
