/** Kall fra nettleseren til API-et. Sender CSRF-tokenet fra cookien på alle endrende kall. */
export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: ApiErrorBody };
export type ApiErrorBody = { code?: string; message?: string; errors?: { field: string; message: string }[]; [k: string]: unknown };

function csrfToken(): string {
  const m = document.cookie.match(/(?:^|;\s*)faktura_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<ApiResult<T>> {
  const method = init.method ?? (init.body !== undefined || init.form ? 'POST' : 'GET');
  const headers: Record<string, string> = {};
  if (method !== 'GET') headers['X-CSRF-Token'] = csrfToken();
  let body: BodyInit | undefined;
  if (init.form) body = init.form;
  else if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.body);
  }
  try {
    const res = await fetch(path, { method, headers, body, credentials: 'same-origin' });
    const text = await res.text();
    const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
    if (res.ok) return { ok: true, status: res.status, data: data as T };
    return { ok: false, status: res.status, error: (typeof data === 'object' && data) || { message: String(data ?? '') } };
  } catch {
    return { ok: false, status: 0, error: { message: 'Får ikke kontakt med serveren. Sjekk nettforbindelsen og prøv igjen.' } };
  }
}

export function errorText(e: ApiErrorBody): string {
  if (e.errors?.length) return e.errors.map((x) => x.message).join(' ');
  return e.message ?? 'Noe gikk galt. Prøv igjen om litt.';
}
