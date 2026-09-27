// Datatyper som deles mellom API og web-app (JSON-formen på API-et).

import type { InvoiceLineInput, InvoiceStatus, InvoiceTotals } from './invoice.ts';

export interface Company {
  name: string;
  orgNumber: string;
  vatRegistered: boolean;
  address: string;
  postalCode: string;
  city: string;
  email: string;
  phone: string;
  accountNumber: string;
  paymentTermsDays: number;
}

export interface Customer {
  id: number;
  name: string;
  orgNumber: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
}

export interface InvoiceLine extends InvoiceLineInput {
  id: number;
}

export interface Invoice {
  id: number;
  kind: 'invoice' | 'credit_note';
  number: number | null;
  creditsInvoiceId: number | null;
  status: InvoiceStatus;
  overdue: boolean;
  issueDate: string | null;
  dueDate: string | null;
  kid: string | null;
  theirReference: string;
  note: string;
  customerId: number;
  /** Kunden slik den var da fakturaen ble sendt (eller slik den er nå, for utkast). */
  customer: Customer;
  /** Selger slik den var da fakturaen ble sendt (null for utkast). */
  seller: Company | null;
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  sentAt: string | null;
  paidAt: string | null;
}

export interface InvoiceSummary {
  id: number;
  kind: 'invoice' | 'credit_note';
  number: number | null;
  status: InvoiceStatus;
  overdue: boolean;
  customerName: string;
  issueDate: string | null;
  dueDate: string | null;
  gross: number;
}

export interface Dashboard {
  outstanding: number;
  outstandingCount: number;
  overdue: number;
  overdueCount: number;
  paidThisMonth: number;
  draftCount: number;
  missingCompanyInfo: string[];
}

export interface BrregEntity {
  orgNumber: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  vatRegistered: boolean;
  organizationForm: string;
}
