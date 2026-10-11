import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/inter';
import './globals.css';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: { default: BRAND.full, template: `%s – ${BRAND.name}` },
  description: 'Lag, send og få betalt fakturaer – på mobil og web.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8F7F6' },
    { media: '(prefers-color-scheme: dark)', color: '#151216' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nb">
      <body className="bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
