// Oppslag i Enhetsregisteret (Brønnøysundregistrene) — åpne data, krever ingen nøkkel.
// Lar brukeren fylle ut kunde/firma ved å taste bare organisasjonsnummeret.

import { isValidOrgNumber, type BrregEntity } from '@faktura/core';

export async function lookupOrgNumber(orgNumber: string, fetchFn: typeof fetch = fetch): Promise<BrregEntity | null> {
  if (!isValidOrgNumber(orgNumber)) return null;
  const res = await fetchFn(`https://data.brreg.no/enhetsregisteret/api/enheter/${orgNumber}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`Enhetsregisteret svarte ${res.status}`);
  const e = (await res.json()) as any;
  const addr = e.forretningsadresse ?? e.postadresse ?? {};
  return {
    orgNumber: e.organisasjonsnummer,
    name: e.navn,
    address: (addr.adresse ?? []).join(', '),
    postalCode: addr.postnummer ?? '',
    city: addr.poststed ?? '',
    vatRegistered: e.registrertIMvaregisteret === true,
    organizationForm: e.organisasjonsform?.kode ?? '',
  };
}
