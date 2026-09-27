import { fileURLToPath } from 'node:url';
import { buildApp } from './app.ts';
import { openDb } from './db.ts';
import { createMailer } from './mailer.ts';

const db = openDb(process.env.DATABASE_PATH ?? fileURLToPath(new URL('../../../data/faktura.db', import.meta.url)));
const app = buildApp({
  db,
  mailer: createMailer(),
  webDist: fileURLToPath(new URL('../../web/dist', import.meta.url)),
  logger: true,
});

await app.listen({ port: Number(process.env.PORT ?? 3000), host: process.env.HOST ?? '127.0.0.1' });
