import seedJson from '../fixtures/seed.json' with { type: 'json' };

export const seed = seedJson;
export const ORG_A = seed.organizations[0].id;
export const ORG_B = seed.organizations[1].id;

export function user(key: string) {
  const u = seed.users.find((x) => x.key === key);
  if (!u) throw new Error(`Ukjent bruker i fixturen: ${key}`);
  return u;
}

export const customer = (i: number) => seed.customers[i];
export const product = (i: number) => seed.products[i];
