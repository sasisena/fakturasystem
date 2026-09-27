/**
 * Oppslag i Enhetsregisteret (Brønnøysundregistrene) – åpne data, krever ingen nøkkel.
 * Lar brukeren fylle ut firmaopplysninger ved å taste bare organisasjonsnummeret.
 * I testmodus brukes faste, oppdiktede svar, slik at testene ikke er avhengige av nettet.
 */
import { isValidOrgNumber } from '@/lib/faktura';
import { config } from './env';

export type BrregEntity = {
  orgNumber: string;
  name: string;
  organizationForm: string;
  address: string;
  postalCode: string;
  city: string;
  vatRegistered: boolean;
};

const TEST_ENTITIES: Record<string, BrregEntity> = {
  '923609016': { orgNumber: '923609016', name: 'FJELLSNØ DESIGN AS', organizationForm: 'AS', address: 'Testveien 1', postalCode: '0150', city: 'OSLO', vatRegistered: true },
};

export async function lookupOrgNumber(input: string, fetchFn: typeof fetch = fetch): Promise<BrregEntity | null> {
  const orgNumber = input.replace(/\s/g, '');
  if (!isValidOrgNumber(orgNumber)) return null;
  if (config.testMode) return TEST_ENTITIES[orgNumber] ?? null;
  const res = await fetchFn(`https://data.brreg.no/enhetsregisteret/api/enheter/${orgNumber}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`Enhetsregisteret svarte ${res.status}`);
  return parseBrreg(await res.json());
}

export function parseBrreg(e: Record<string, unknown>): BrregEntity {
  const addr = (e.forretningsadresse ?? e.postadresse ?? {}) as { adresse?: string[]; postnummer?: string; poststed?: string };
  return {
    orgNumber: String(e.organisasjonsnummer ?? ''),
    name: String(e.navn ?? ''),
    organizationForm: String((e.organisasjonsform as { kode?: string } | undefined)?.kode ?? ''),
    address: (addr.adresse ?? []).join(', '),
    postalCode: addr.postnummer ?? '',
    city: addr.poststed ?? '',
    vatRegistered: e.registrertIMvaregisteret === true,
  };
}
