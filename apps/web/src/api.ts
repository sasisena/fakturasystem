import type { BrregEntity, Company, Customer, Dashboard, Invoice, InvoiceLineInput, InvoiceSummary } from '@faktura/core';

export class ApiError extends Error {
  details: string[];
  constructor(message: string, details: string[] = []) {
    super(message);
    this.details = details;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Feil ${res.status}`, data.details ?? []);
  return data as T;
}

export interface DraftInput {
  customerId: number;
  lines: InvoiceLineInput[];
  theirReference: string;
  note: string;
}

export type CustomerInput = Omit<Customer, 'id'>;

export const api = {
  dashboard: () => request<Dashboard>('GET', '/dashboard'),
  company: () => request<Company>('GET', '/company'),
  saveCompany: (c: Company) => request<Company>('PUT', '/company', c),
  lookup: (orgNumber: string) => request<BrregEntity>('GET', `/lookup/${orgNumber.replace(/\s/g, '')}`),

  customers: () => request<Customer[]>('GET', '/customers'),
  customer: (id: number) => request<Customer>('GET', `/customers/${id}`),
  createCustomer: (c: CustomerInput) => request<Customer>('POST', '/customers', c),
  updateCustomer: (id: number, c: CustomerInput) => request<Customer>('PUT', `/customers/${id}`, c),
  deleteCustomer: (id: number) => request<void>('DELETE', `/customers/${id}`),

  invoices: (status?: string) => request<InvoiceSummary[]>('GET', `/invoices${status ? `?status=${status}` : ''}`),
  invoice: (id: number) => request<Invoice>('GET', `/invoices/${id}`),
  createDraft: (d: DraftInput) => request<Invoice>('POST', '/invoices', d),
  updateDraft: (id: number, d: DraftInput) => request<Invoice>('PUT', `/invoices/${id}`, d),
  deleteDraft: (id: number) => request<void>('DELETE', `/invoices/${id}`),
  send: (id: number, delivery: 'email' | 'none') => request<Invoice>('POST', `/invoices/${id}/send`, { delivery }),
  markPaid: (id: number) => request<Invoice>('POST', `/invoices/${id}/mark-paid`, {}),
  markUnpaid: (id: number) => request<Invoice>('POST', `/invoices/${id}/mark-unpaid`, {}),
  credit: (id: number) => request<Invoice>('POST', `/invoices/${id}/credit`, {}),
  pdfUrl: (id: number) => `/api/invoices/${id}/pdf`,
};
