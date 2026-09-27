/**
 * API-ruter. Alle kall under /api går gjennom `dispatch`, som tar seg av:
 * innlogging (401), CSRF og fremmed Origin (403), tilgangsbilde og RLS-omfang,
 * én databasetransaksjon per kall, logging av nektede forsøk og feilsvar uten tekniske detaljer.
 */
import { NextResponse } from 'next/server';
import type { Access } from './access';
import { audit } from './audit';
import { loadAccess, scopeFor } from './context';
import { SYSTEM_SCOPE, rootDb, withScope, withSystem, type DbScope, type Tx } from './db';
import { config } from './env';
import { ApiError, badRequest, forbidden, notFound, unauthorized } from './errors';
import { safeEqual } from './crypto';
import { SESSION_COOKIE, loadSession, type SessionUser } from './session';
import { ensureStarted } from './startup';

export type Ctx = {
  req: Request;
  url: URL;
  params: Record<string, string>;
  query: URLSearchParams;
  tx: Tx;
  scope: DbScope;
  session: SessionUser | null;
  /** Satt når ruten krever innlogging. */
  access: Access;
  userId: string;
  secure: boolean;
  origin: string;
  /** Alle adresser som regnes som systemets egne (for Origin-sjekk på offentlige skjemaer). */
  origins: string[];
  body: () => Promise<Record<string, unknown>>;
};

export type Handler = (c: Ctx) => Promise<Response | object | null | undefined>;

type RouteDef = {
  method: string;
  pattern: string;
  handler: Handler;
  /** 'none' = åpen rute (innlogging, testmodus) */
  auth?: 'none' | 'user';
  /** false = krever ikke CSRF-token (bare for ruter uten innlogget bruker) */
  csrf?: boolean;
  /** Finnes bare i testmodus */
  test?: boolean;
  /** Systemmodus for RLS (bare for test- og innloggingsruter) */
  system?: boolean;
};

type Compiled = RouteDef & { re: RegExp; keys: string[] };

const routes: Compiled[] = [];

export function route(def: RouteDef) {
  const keys: string[] = [];
  const re = new RegExp(
    '^' +
      def.pattern.replace(/\/:([a-zA-Z]+)/g, (_m, k: string) => {
        keys.push(k);
        return '/([^/]+)';
      }) +
      '/?$',
  );
  routes.push({ ...def, re, keys });
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  if (status === 204) return new Response(null, { status, headers });
  return NextResponse.json(body, { status, headers });
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isSecure(req: Request, url: URL) {
  return url.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
}

function ownOrigins(req: Request, url: URL): string[] {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? url.host;
  const proto = isSecure(req, url) ? 'https' : 'http';
  const list = [`${proto}://${host}`, url.origin];
  if (config.appUrl) {
    try {
      list.push(new URL(config.appUrl).origin);
    } catch {
      /* ignorer ugyldig APP_URL */
    }
  }
  return list;
}

function cookie(req: Request, name: string): string | undefined {
  const raw = req.headers.get('cookie');
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

function securityHeaders(res: Response, secure: boolean): Response {
  res.headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-Frame-Options', 'DENY');
  if (!res.headers.has('Cache-Control')) res.headers.set('Cache-Control', 'no-store');
  if (secure) res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return res;
}

function errorResponse(e: ApiError): Response {
  return json(e.body, e.status);
}

function match(method: string, path: string): { r: Compiled; params: Record<string, string> } | null | 'method' {
  let pathMatched = false;
  for (const r of routes) {
    const m = path.match(r.re);
    if (!m) continue;
    pathMatched = true;
    if (r.method !== method) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => {
      try {
        params[k] = decodeURIComponent(m[i + 1]);
      } catch {
        params[k] = '';
      }
    });
    return { r, params };
  }
  return pathMatched ? 'method' : null;
}

export async function dispatch(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const secure = isSecure(req, url);
  let session: SessionUser | null = null;
  let deniedLog: { entity: string; entityId: string | null; orgId: string | null } | null = null;
  try {
    await ensureStarted();
    const found = match(req.method, url.pathname);
    if (found === null) throw notFound();
    if (found === 'method') throw new ApiError(405, { code: 'metode_ikke_tillatt', message: 'Metoden er ikke tillatt.' });
    const { r, params } = found;
    if (r.test && !config.testMode) throw notFound();

    session = await loadSession(rootDb(), cookie(req, SESSION_COOKIE));
    const needsUser = r.auth !== 'none';
    if (needsUser && !session) throw unauthorized();

    if (MUTATING.has(req.method) && r.csrf !== false) {
      const origin = req.headers.get('origin');
      if (origin && !ownOrigins(req, url).includes(origin)) throw forbidden('Forespørselen kom fra en annen nettside.');
      const token = req.headers.get('x-csrf-token') ?? '';
      if (!session || !safeEqual(token, session.csrfToken)) throw forbidden('Siden er utløpt. Last inn siden på nytt og prøv igjen.');
    }

    const access = session ? await withSystem((tx) => loadAccess(tx, session!.user.id, session!.orgId, session!.mfa)) : null;
    const scope = r.system ? SYSTEM_SCOPE : scopeFor(access);
    deniedLog = { entity: r.pattern, entityId: params.id ?? null, orgId: access?.orgId ?? null };

    let bodyCache: Record<string, unknown> | undefined;
    const result = await withScope(scope, async (tx) => {
      const ctx: Ctx = {
        req,
        url,
        params,
        query: url.searchParams,
        tx,
        scope,
        session,
        access: access as Access,
        userId: session?.user.id ?? '',
        secure,
        origin: ownOrigins(req, url)[0],
        origins: ownOrigins(req, url),
        body: async () => {
          if (bodyCache) return bodyCache;
          try {
            const text = await req.text();
            const parsed = text ? JSON.parse(text) : {};
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error();
            bodyCache = parsed as Record<string, unknown>;
            return bodyCache;
          } catch {
            throw badRequest('Innholdet i forespørselen er ikke gyldig JSON.');
          }
        },
      };
      return r.handler(ctx);
    });
    const res = result instanceof Response ? result : json(result ?? {}, 200);
    return securityHeaders(res, secure);
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.denied && session) {
        const actorId = session.user.id;
        const log = deniedLog ?? { entity: url.pathname.slice(0, 200), entityId: null, orgId: null };
        await withSystem((tx) =>
          audit(tx, { orgId: log.orgId, actorId, action: 'tilgang_nektet', entity: log.entity, entityId: log.entityId, after: { method: req.method, status: e.status } }),
        ).catch(() => undefined);
      }
      return securityHeaders(errorResponse(e), secure);
    }
    // Ukjente feil: logg type og melding uten persondata, svar generelt.
    console.error('Uventet feil i API:', req.method, url.pathname.replace(/[0-9a-f-]{36}/g, ':id'), e instanceof Error ? e.name : 'ukjent');
    return securityHeaders(
      json({ code: 'intern_feil', message: 'Noe gikk galt hos oss. Prøv igjen om litt.' }, 500),
      secure,
    );
  }
}
