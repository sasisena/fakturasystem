import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { InvoiceStatus } from '@faktura/core';
import { ApiError } from './api.ts';

export const formatDate = (iso: string | null) => (iso ? iso.split('-').reverse().join('.') : '—');

/** Laster data og gir tilbake [data, feil, last-på-nytt]. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []): [T | undefined, string | null, () => void] {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    load().then(setData, (e: Error) => setError(e.message));
  }, deps);
  useEffect(reload, [reload]);
  return [data, error, reload];
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const e = error instanceof ApiError ? error : error instanceof Error ? new ApiError(error.message) : new ApiError(String(error));
  return (
    <div className="error" role="alert">
      <strong>{e.message}</strong>
      {e.details.length > 0 && (
        <ul>
          {e.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<InvoiceStatus, string> = { draft: 'Utkast', sent: 'Ubetalt', paid: 'Betalt', credited: 'Kreditert' };

export function StatusBadge({ status, overdue, kind }: { status: InvoiceStatus; overdue: boolean; kind?: string }) {
  if (kind === 'credit_note') return <span className="badge credited">Kreditnota</span>;
  return <span className={`badge ${overdue ? 'overdue' : status}`}>{overdue ? 'Forfalt' : STATUS_LABEL[status]}</span>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Loading() {
  return <p className="muted">Laster …</p>;
}
