import nodemailer from 'nodemailer';

export interface Mail {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  attachments?: { filename: string; content: Buffer }[];
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/**
 * SMTP når SMTP_URL er satt (f.eks. smtps://bruker:passord@smtp.example.com),
 * ellers en utviklingsmailer som bare logger. Utsendelser logges uansett i outbox-tabellen.
 */
export function createMailer(env = process.env): Mailer {
  if (env.SMTP_URL) {
    const transport = nodemailer.createTransport(env.SMTP_URL);
    const from = env.MAIL_FROM ?? 'faktura@localhost';
    return { send: async (mail) => void (await transport.sendMail({ from, ...mail })) };
  }
  return {
    send: async (mail) => console.log(`[dev-mailer] Til: ${mail.to} — ${mail.subject} (${mail.attachments?.length ?? 0} vedlegg)`),
  };
}
