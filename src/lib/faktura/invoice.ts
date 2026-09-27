// Fakturaberegning. Alle beløp er heltall i øre for å unngå flyttallsfeil.

/** Gyldige norske mva-satser (prosent): alminnelig, næringsmidler, persontransport/overnatting m.m., fritatt. */
export const VAT_RATES = [25, 15, 12, 0] as const;
export type VatRate = (typeof VAT_RATES)[number];

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'credited';

export interface InvoiceLineInput {
  description: string;
  /** Antall, kan være desimal (f.eks. 1,5 timer). */
  quantity: number;
  /** Enhetspris eks. mva, i øre. */
  unitPrice: number;
  vatRate: VatRate;
}

export interface LineTotals {
  net: number;
  vat: number;
  gross: number;
}

export interface VatBreakdown {
  rate: VatRate;
  base: number;
  vat: number;
}

export interface InvoiceTotals {
  net: number;
  vat: number;
  gross: number;
  vatBreakdown: VatBreakdown[];
}

export function isVatRate(value: unknown): value is VatRate {
  return (VAT_RATES as readonly unknown[]).includes(value);
}

/** Avrunder halve øre bort fra null, også for negative beløp (kreditnota). */
function roundOre(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

export function lineTotals(line: InvoiceLineInput): LineTotals {
  const net = roundOre(line.quantity * line.unitPrice);
  const vat = roundOre((net * line.vatRate) / 100);
  return { net, vat, gross: net + vat };
}

/**
 * Summerer linjer. Mva beregnes per sats på summert grunnlag (slik det rapporteres i
 * mva-meldingen), ikke per linje, så totalen stemmer med mva-spesifikasjonen på fakturaen.
 * Når selger ikke er mva-registrert settes all mva til 0.
 */
export function invoiceTotals(lines: InvoiceLineInput[], vatRegistered = true): InvoiceTotals {
  const bases = new Map<VatRate, number>();
  for (const line of lines) {
    const rate = vatRegistered ? line.vatRate : 0;
    bases.set(rate, (bases.get(rate) ?? 0) + lineTotals({ ...line, vatRate: rate }).net);
  }
  const vatBreakdown = [...bases.entries()]
    .sort(([a], [b]) => b - a)
    .map(([rate, base]) => ({ rate, base, vat: roundOre((base * rate) / 100) }));
  const net = vatBreakdown.reduce((s, b) => s + b.base, 0);
  const vat = vatBreakdown.reduce((s, b) => s + b.vat, 0);
  return { net, vat, gross: net + vat, vatBreakdown };
}

export function validateLines(lines: unknown): string[] {
  if (!Array.isArray(lines) || lines.length === 0) return ['Fakturaen må ha minst én linje'];
  const errors: string[] = [];
  lines.forEach((l, i) => {
    const n = i + 1;
    if (typeof l?.description !== 'string' || l.description.trim() === '') errors.push(`Linje ${n}: beskrivelse mangler`);
    if (typeof l?.quantity !== 'number' || !Number.isFinite(l.quantity) || l.quantity <= 0) errors.push(`Linje ${n}: antall må være større enn 0`);
    if (!Number.isInteger(l?.unitPrice)) errors.push(`Linje ${n}: pris må være et heltall i øre`);
    if (!isVatRate(l?.vatRate)) errors.push(`Linje ${n}: ugyldig mva-sats`);
  });
  return errors;
}

/** Lovlige statusoverganger. Sendte fakturaer rettes aldri, de krediteres (bokføringsloven). */
const TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent'],
  sent: ['paid', 'credited'],
  paid: ['sent', 'credited'],
  credited: [],
};

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Legger til dager på en ISO-dato (YYYY-MM-DD). */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isOverdue(status: InvoiceStatus, dueDate: string, today: string): boolean {
  return status === 'sent' && dueDate < today;
}
