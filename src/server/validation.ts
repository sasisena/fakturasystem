/**
 * Validering av input med Zod. Feilmeldingene er på norsk og sier hvordan feilen rettes.
 */
import { z } from 'zod';
import { ROLES } from '@/db/schema';
import { isValidAccountNumber, isValidOrgNumber } from '@/lib/faktura';
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

export const roleSchema = z.object({ role: z.enum(ROLES, { error: MSG.role }) });

/** Validerer og gir 422 med feltvise, norske feilmeldinger. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  const errors: FieldError[] = r.error.issues.map((i) => ({ field: i.path.join('.') || '_', message: i.message }));
  throw invalid(errors);
}
