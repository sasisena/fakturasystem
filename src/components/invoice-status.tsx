import { Badge } from '@/components/ui/card';

type S = { kind: string; status: string; overdue: boolean };

/** Status med tekst (ikke bare farge): Utkast, Ubetalt, Forfalt, Betalt, Kreditert, Kreditnota. */
export function statusLabel(i: S): { text: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' } {
  if (i.kind === 'kreditnota') return { text: 'Kreditnota', tone: 'neutral' };
  if (i.status === 'utkast') return { text: 'Utkast', tone: 'neutral' };
  if (i.status === 'betalt') return { text: 'Betalt', tone: 'success' };
  if (i.status === 'kreditert') return { text: 'Kreditert', tone: 'neutral' };
  return i.overdue ? { text: 'Forfalt', tone: 'danger' } : { text: 'Ubetalt', tone: 'info' };
}

export function InvoiceStatus(i: S) {
  const l = statusLabel(i);
  return <Badge tone={l.tone}>{l.text}</Badge>;
}
