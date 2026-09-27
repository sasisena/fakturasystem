import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type Db = DatabaseSync;

// Hver migrering kjøres én gang, i rekkefølge. Legg kun til nye på slutten.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE company (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL DEFAULT '',
    org_number TEXT NOT NULL DEFAULT '',
    vat_registered INTEGER NOT NULL DEFAULT 0,
    address TEXT NOT NULL DEFAULT '',
    postal_code TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    account_number TEXT NOT NULL DEFAULT '',
    payment_terms_days INTEGER NOT NULL DEFAULT 14,
    next_invoice_number INTEGER NOT NULL DEFAULT 1001
  );
  INSERT INTO company (id) VALUES (1);

  CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    org_number TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    postal_code TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL DEFAULT 'invoice' CHECK (kind IN ('invoice', 'credit_note')),
    number INTEGER UNIQUE,
    credits_invoice_id INTEGER REFERENCES invoices(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'credited')),
    issue_date TEXT,
    due_date TEXT,
    kid TEXT,
    their_reference TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    net INTEGER NOT NULL DEFAULT 0,
    vat INTEGER NOT NULL DEFAULT 0,
    gross INTEGER NOT NULL DEFAULT 0,
    seller_snapshot TEXT,
    customer_snapshot TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at TEXT,
    paid_at TEXT
  );

  CREATE TABLE invoice_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price INTEGER NOT NULL,
    vat_rate INTEGER NOT NULL
  );

  CREATE TABLE outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER REFERENCES invoices(id),
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `,
];

export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let i = version; i < MIGRATIONS.length; i++) {
    transaction(db, () => {
      db.exec(MIGRATIONS[i]);
      db.exec(`PRAGMA user_version = ${i + 1}`);
    });
  }
  return db;
}

export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
