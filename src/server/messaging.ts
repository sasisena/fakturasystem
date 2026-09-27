/**
 * Utsending av e-post ligger bak grensesnittet MessageChannel, slik at nye kanaler (SMS, EHF)
 * kan legges til senere. Meldinger legges i utboksen (tabellen outbox) i samme transaksjon
 * som endringen, og sendes av utsendingsjobben. I testmodus sendes ingenting ut.
 */
import { outbox } from '@/db/schema';
import { now } from './clock';
import type { Q } from './db';

export type Message = {
  channel: 'email';
  to: string;
  subject?: string;
  body: string;
  /** Organisasjonen meldingen hører til. Tom for innloggingskoder. */
  orgId?: string | null;
  /** Svar går hit (bedriftens e-post), ikke til systemets avsenderadresse. */
  replyTo?: string | null;
  /** Fakturaen som legges ved som PDF når meldingen sendes. */
  invoiceId?: string | null;
  /** Satt når meldingen ikke kan sendes (f.eks. ugyldig adresse). Utsendingsjobben hopper over den. */
  error?: string | null;
};

export type Attachment = { filename: string; content: Buffer; contentType: string };

export interface MessageChannel {
  readonly name: 'email';
  deliver(m: Message, attachments?: Attachment[]): Promise<void>;
}

/** Legger meldingen i utboksen. */
export async function enqueue(db: Q, m: Message) {
  await db.insert(outbox).values({
    orgId: m.orgId ?? null,
    replyTo: m.replyTo ?? null,
    invoiceId: m.invoiceId ?? null,
    channel: m.channel,
    to: m.to,
    subject: m.subject ?? null,
    body: m.body,
    error: m.error ?? null,
    createdAt: now(),
  });
}
