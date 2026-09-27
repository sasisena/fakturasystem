import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { formatAccountNumber, formatNok } from '@faktura/core';
import type { Db } from './db.ts';
import { lookupOrgNumber } from './brreg.ts';
import type { Mailer } from './mailer.ts';
import { invoiceFilename, renderInvoicePdf } from './pdf.ts';
import * as s from './service.ts';

export interface AppOptions {
  db: Db;
  mailer: Mailer;
  /** Mappe med bygget web-app som serveres fra samme server i produksjon. */
  webDist?: string;
  fetchFn?: typeof fetch;
  logger?: boolean;
}

type IdParams = { Params: { id: string } };
type Body = Record<string, unknown>;

export function buildApp({ db, mailer, webDist, fetchFn = fetch, logger = false }: AppOptions): FastifyInstance {
  const app = Fastify({ logger });

  app.setErrorHandler((err: Error & { statusCode?: number; details?: string[] }, _req, reply) => {
    const status = err.statusCode ?? 500;
    if (status >= 500) app.log.error(err);
    reply.status(status).send({ error: status >= 500 ? 'Noe gikk galt' : err.message, details: err.details });
  });

  const id = (req: { params: { id: string } }) => Number(req.params.id);
  const body = (req: { body: unknown }) => (req.body ?? {}) as Body;

  app.get('/api/health', async () => ({ ok: true }));
  app.get('/api/dashboard', async () => s.dashboard(db));

  app.get('/api/company', async () => s.getCompany(db));
  app.put('/api/company', async (req) => s.updateCompany(db, body(req)));

  app.get<{ Params: { orgNumber: string } }>('/api/lookup/:orgNumber', async (req, reply) => {
    const entity = await lookupOrgNumber(req.params.orgNumber.replace(/\s/g, ''), fetchFn);
    if (!entity) return reply.status(404).send({ error: 'Fant ikke organisasjonsnummeret' });
    return entity;
  });

  app.get('/api/customers', async () => s.listCustomers(db));
  app.post('/api/customers', async (req, reply) => reply.status(201).send(s.createCustomer(db, body(req))));
  app.get<IdParams>('/api/customers/:id', async (req) => s.getCustomer(db, id(req)));
  app.put<IdParams>('/api/customers/:id', async (req) => s.updateCustomer(db, id(req), body(req)));
  app.delete<IdParams>('/api/customers/:id', async (req, reply) => {
    s.deleteCustomer(db, id(req));
    return reply.status(204).send();
  });

  app.get<{ Querystring: { status?: string } }>('/api/invoices', async (req) => s.listInvoices(db, { status: req.query.status }));
  app.post('/api/invoices', async (req, reply) => reply.status(201).send(s.createDraft(db, body(req))));
  app.get<IdParams>('/api/invoices/:id', async (req) => s.getInvoice(db, id(req)));
  app.put<IdParams>('/api/invoices/:id', async (req) => s.updateDraft(db, id(req), body(req)));
  app.delete<IdParams>('/api/invoices/:id', async (req, reply) => {
    s.deleteDraft(db, id(req));
    return reply.status(204).send();
  });

  app.get<IdParams>('/api/invoices/:id/pdf', async (req, reply) => {
    const inv = s.getInvoice(db, id(req));
    const pdf = await renderInvoicePdf(inv, s.getCompany(db));
    return reply
      .type('application/pdf')
      .header('Content-Disposition', `inline; filename="${invoiceFilename(inv)}"`)
      .send(pdf);
  });

  /**
   * Utsteder fakturaen og sender den. delivery = "email" sender PDF til kundens e-post;
   * "none" bare låser og nummererer den, f.eks. når brukeren deler PDF-en selv fra telefonen.
   */
  app.post<IdParams>('/api/invoices/:id/send', async (req) => {
    const delivery = body(req).delivery === 'none' ? 'none' : 'email';
    const draft = s.getInvoice(db, id(req));
    if (delivery === 'email' && !draft.customer.email) {
      throw new s.HttpError(400, 'Kunden mangler e-postadresse');
    }
    const inv = s.issueInvoice(db, id(req));
    if (delivery === 'email') {
      const seller = inv.seller!;
      const subject = `Faktura ${inv.number} fra ${seller.name}`;
      const pdf = await renderInvoicePdf(inv, seller);
      await mailer.send({
        to: inv.customer.email,
        replyTo: seller.email || undefined,
        subject,
        text: [
          `Hei,`,
          ``,
          `Vedlagt er faktura ${inv.number} på ${formatNok(inv.totals.gross)} med forfall ${inv.dueDate!.split('-').reverse().join('.')}.`,
          `Betal til konto ${formatAccountNumber(seller.accountNumber)} og merk betalingen med KID ${inv.kid}.`,
          ``,
          `Med vennlig hilsen`,
          seller.name,
        ].join('\n'),
        attachments: [{ filename: invoiceFilename(inv), content: pdf }],
      });
      s.recordOutbox(db, inv.id, inv.customer.email, subject);
    }
    return inv;
  });

  app.post<IdParams>('/api/invoices/:id/mark-paid', async (req) => s.markPaid(db, id(req), (body(req).paidDate as string) || undefined));
  app.post<IdParams>('/api/invoices/:id/mark-unpaid', async (req) => s.markUnpaid(db, id(req)));
  app.post<IdParams>('/api/invoices/:id/credit', async (req, reply) => reply.status(201).send(s.creditInvoice(db, id(req))));

  if (webDist && existsSync(webDist)) {
    app.register(fastifyStatic, { root: webDist });
    // SPA-fallback: ukjente ikke-API-stier går til index.html
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith('/api/') ? reply.status(404).send({ error: 'Ikke funnet' }) : reply.sendFile('index.html'),
    );
  }

  return app;
}
