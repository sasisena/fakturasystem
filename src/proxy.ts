import { NextResponse, type NextRequest } from 'next/server';

/**
 * Sikkerhetshoder for sidene: Content-Security-Policy med nonce per forespørsel, slik at bare
 * Next.js sine egne skript kan kjøres. API-svarene får sine hoder i src/server/router.ts.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const https = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Stilattributter (f.eks. husfarge) krever 'unsafe-inline' for stiler; skript er fortsatt låst.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', csp);
  if (https) res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return res;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
