/**
 * Validering av input med Zod. Feilmeldingene er på norsk og sier hvordan feilen rettes.
 */
import { z } from 'zod';
import { ROLES } from '@/db/schema';
import { isValidAccountNumber, isValidOrgNumber, isVatRate, type VatRate } from '@/lib/faktura';
import { invalid, type FieldError } from './errors';

export const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;
export const isEmail = (s: unknown): s is string => typeof s === 'string' && s.length <= 254 && EMAIL_RE.test(s.trim());

const MSG = {
  name: 'Skriv navnet på bedriften.',
  orgNumber: 'Organisasjonsnummeret må ha 9 siffer og være gyldig. Du finner det på brreg.no.',
  accountNumber: 'Kontonummeret må ha 11 siffer og være gyldig, for eksempel 1234.56.78903.',
  email: 'Skriv en gyldig e-postadresse, for eksempel navn@eksempel.no.',
  postalCode: 'Postnummeret må ha fire siffer, for eksempel 0150.',
  paymentTerms: 'Betalingsfristen må være mellom 0 og 120 dager.',
  role: 'Velg en rolle fra listen.',
};

const digits = (v: unknown) => (typeof v === 'string' ? v.replace(/[\s.]/g, '') : v);
const text = (max = 200) => z.string().trim().max(max, { error: `Høyst ${max} tegn.` });
const optionalText = (max = 200) => z.preprocess((v) => (v == null ? '' : v), text(max));

export const organizationSchema = z.object({
  name: z.string({ error: MSG.name }).trim().min(1, { error: MSG.name }).max(200, { error: 'Navnet er for langt (høyst 200 tegn).' }),
  orgNumber: z.preprocess(
    (v) => digits(v ?? ''),
    z.string().refine((v) => v === '' || isValidOrgNumber(v), { error: MSG.orgNumber }),
  ),
  organizationForm: optionalText(10),
  vatRegistered: z.boolean().default(false),
  address: optionalText(),
  postalCode: z.preprocess((v) => (v == null ? '' : String(v).trim()), z.string().regex(/^(\d{4})?$/, { error: MSG.postalCode })),
  city: optionalText(100),
  email: z.preprocess((v) => (v == null ? '' : String(v).trim().toLowerCase()), z.string().refine((v) => v === '' || isEmail(v), { error: MSG.email })),
  phone: optionalText(30),
  accountNumber: z.preprocess(
    (v) => digits(v ?? ''),
    z.string().refine((v) => v === '' || isValidAccountNumber(v), { error: MSG.accountNumber }),
  ),
  paymentTermsDays: z.coerce.number({ error: MSG.paymentTerms }).int({ error: MSG.paymentTerms }).min(0, { error: MSG.paymentTerms }).max(120, { error: MSG.paymentTerms }).default(14),
});
export type OrganizationInput = z.infer<typeof organizationSchema>;

export const inviteSchema = z.object({
  email: z.string({ error: MSG.email }).trim().toLowerCase().refine(isEmail, { error: MSG.email }),
  role: z.enum(ROLES, { error: MSG.role }),
});

const postalCode = z.preprocess((v) => (v == null ? '' : String(v).trim()), z.string().regex(/^(\d{4})?$/, { error: MSG.postalCode }));
const optionalOrgNumber = z.preprocess((v) => digits(v ?? ''), z.string().refine((v) => v === '' || isValidOrgNumber(v), { error: MSG.orgNumber }));
const optionalEmail = z.preprocess((v) => (v == null ? '' : String(v).trim().toLowerCase()), z.string().refine((v) => v === '' || isEmail(v), { error: MSG.email }));

export const customerSchema = z.object({
  name: z.string({ error: 'Skriv navnet på kunden.' }).trim().min(1, { error: 'Skriv navnet på kunden.' }).max(200, { error: 'Navnet er for langt (høyst 200 tegn).' }),
  orgNumber: optionalOrgNumber,
  email: optionalEmail,
  phone: optionalText(30),
  address: optionalText(),
  postalCode,
  city: optionalText(100),
});

const VAT_MSG = 'Velg mva-sats: 25, 15, 12 eller 0 %.';
const vatRate = z.number({ error: VAT_MSG }).refine((r): r is VatRate => isVatRate(r), { error: VAT_MSG });
const unit = z.preprocess((v) => (v == null || v === '' ? 'stk' : v), text(20));
const MAX_ORE = 1_000_000_000_00; // 1 milliard kroner

export const productSchema = z.object({
  name: z.string({ error: 'Skriv navnet på produktet.' }).trim().min(1, { error: 'Skriv navnet på produktet.' }).max(200, { error: 'Høyst 200 tegn.' }),
  unit,
  unitPrice: z.number({ error: 'Prisen må være et beløp.' }).int({ error: 'Prisen må oppgis i hele øre.' }).min(0, { error: 'Prisen kan ikke være negativ.' }).max(MAX_ORE, { error: 'Prisen er for høy.' }),
  vatRate,
});

const quantity = z
  .number({ error: 'Skriv antall.' })
  .gt(0, { error: 'Antall må være større enn 0.' })
  .max(1_000_000, { error: 'Antallet er for stort.' })
  .refine((q) => Math.abs(Math.round(q * 1000) - q * 1000) < 1e-6, { error: 'Antall kan ha høyst tre desimaler.' });

export const invoiceLineSchema = z.object({
  productId: z.preprocess((v) => (v === '' ? null : v), z.uuid({ error: 'Ukjent produkt.' }).nullish()),
  description: z.string({ error: 'Skriv hva linjen gjelder.' }).trim().min(1, { error: 'Skriv hva linjen gjelder.' }).max(500, { error: 'Høyst 500 tegn.' }),
  quantity,
  unit,
  unitPrice: z.number({ error: 'Prisen må være et beløp.' }).int({ error: 'Prisen må oppgis i hele øre.' }).min(-MAX_ORE).max(MAX_ORE, { error: 'Prisen er for høy.' }),
  vatRate,
});

export const invoiceSchema = z.object({
  customerId: z.uuid({ error: 'Velg en kunde.' }),
  theirReference: optionalText(100),
  note: optionalText(2000),
  lines: z.array(invoiceLineSchema, { error: 'Legg til minst én linje.' }).min(1, { error: 'Legg til minst én linje.' }).max(200, { error: 'Høyst 200 linjer.' }),
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const roleSchema = z.object({ role: z.enum(ROLES, { error: MSG.role }) });

/** Validerer og gir 422 med feltvise, norske feilmeldinger. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  const errors: FieldError[] = r.error.issues.map((i) => ({ field: i.path.join('.') || '_', message: i.message }));
  throw invalid(errors);
}
