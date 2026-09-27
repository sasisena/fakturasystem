/**
 * Tilgangsregler. Hver bruker har én rolle per organisasjon. Rollene er faste, og hver rolle gir
 * et sett handlinger. Denne filen er sikkerhetskritisk.
 *
 * - eier:          alt, også å gi eller ta fra andre eierrollen
 * - administrator: alt unntatt å endre eiere
 * - fakturering:   kunder og fakturaer, ser firmaopplysningene
 * - lesetilgang:   ser alt, endrer ingenting (f.eks. regnskapsfører)
 *
 * Alle roller krever tofaktor i økten, fordi alle ser økonomiske opplysninger.
 */
import type { Role } from '@/db/schema';
import { forbidden, mfaRequired } from './errors';

export const ACTIONS = ['firma:se', 'firma:endre', 'team:se', 'team:endre', 'eiere:endre', 'faktura:se', 'faktura:endre', 'logg:se'] as const;
export type Action = (typeof ACTIONS)[number];

const ALL: readonly Action[] = ACTIONS;

export const ROLE_ACTIONS: Record<Role, readonly Action[]> = {
  eier: ALL,
  administrator: ALL.filter((a) => a !== 'eiere:endre'),
  fakturering: ['firma:se', 'team:se', 'faktura:se', 'faktura:endre'],
  lesetilgang: ['firma:se', 'team:se', 'faktura:se', 'logg:se'],
};

export const ROLE_LABELS: Record<Role, string> = {
  eier: 'Eier',
  administrator: 'Administrator',
  fakturering: 'Fakturering',
  lesetilgang: 'Lesetilgang',
};

export type OrgMembership = { orgId: string; orgName: string; role: Role };

export class Access {
  constructor(
    public readonly userId: string,
    /** Alle organisasjoner brukeren er med i. */
    public readonly memberships: OrgMembership[],
    /** Organisasjonen brukeren jobber i nå (null = ikke valgt, eller ikke lenger medlem). */
    public readonly orgId: string | null,
    public readonly mfa: boolean,
  ) {}

  get role(): Role | null {
    return this.memberships.find((m) => m.orgId === this.orgId)?.role ?? null;
  }

  /** Tofaktor kreves så snart brukeren er med i en organisasjon. */
  get requiresMfa(): boolean {
    return this.memberships.length > 0;
  }

  get mfaMissing(): boolean {
    return this.requiresMfa && !this.mfa;
  }

  can(action: Action): boolean {
    const role = this.role;
    return !!role && !this.mfaMissing && ROLE_ACTIONS[role].includes(action);
  }

  /**
   * Krever en valgt organisasjon, fullført tofaktor og at rollen gir handlingen.
   * Uten valgt organisasjon gis 403 med koden ingen_organisasjon.
   */
  require(action: Action): string {
    if (!this.orgId || !this.role) throw forbidden('Velg eller opprett en bedrift først.', 'ingen_organisasjon');
    if (this.mfaMissing) throw mfaRequired();
    if (!ROLE_ACTIONS[this.role].includes(action)) throw forbidden();
    return this.orgId;
  }
}
