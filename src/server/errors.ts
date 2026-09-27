/** Feil som sendes til klienten. Meldinger er på norsk og uten tekniske detaljer. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
    /** true = forsøket logges som tilgang_nektet */
    public denied = false,
  ) {
    super(String(body.message ?? body.code ?? status));
  }
}

export type FieldError = { field: string; message: string };

export const notFound = (denied = false) =>
  new ApiError(404, { code: 'ikke_funnet', message: 'Fant ikke det du lette etter.' }, denied);
export const forbidden = (message = 'Du har ikke tilgang til dette.', code = 'ingen_tilgang') =>
  new ApiError(403, { code, message }, true);
export const unauthorized = () =>
  new ApiError(401, { code: 'ikke_innlogget', message: 'Du må logge inn først.' });
export const mfaRequired = () =>
  new ApiError(
    403,
    { code: 'mfa_kreves', message: 'Du må bekrefte innloggingen med tofaktor først.' },
    true,
  );
export const conflict = (code: string, message: string, extra: Record<string, unknown> = {}) =>
  new ApiError(409, { code, message, ...extra });
export const invalid = (errors: FieldError[]) =>
  new ApiError(422, { code: 'ugyldig', message: 'Noen felt må rettes.', errors });
export const badRequest = (message: string) => new ApiError(400, { code: 'ugyldig_forespørsel', message });
