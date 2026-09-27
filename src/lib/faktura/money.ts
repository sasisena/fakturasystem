// Formatering og parsing av kronebeløp. Internt lagres alt som heltall i øre.

const nok = new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 123456 → "1 234,56" (med hardt mellomrom som tusenskille). */
export function formatOre(ore: number): string {
  return nok.format(ore / 100);
}

/** 120000 → "1 200 kr", 123450 → "1 234,50 kr" (øre vises bare når de ikke er null). */
export function formatNok(ore: number): string {
  return `${ore % 100 === 0 ? nok.format(ore / 100).replace(/,00$/, '') : formatOre(ore)} kr`;
}

/** Tolker "1 234,50", "1234.5" eller "1234" som øre. Returnerer null ved ugyldig input. */
export function parseKroner(input: string): number | null {
  const cleaned = input.replace(/[\s ]/g, '').replace(/^kr/i, '').replace(',', '.');
  if (!/^-?\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.replace('-', '').split('.');
  const ore = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return cleaned.startsWith('-') ? -ore : ore;
}
