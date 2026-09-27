import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/600.css';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Fakturasystem', template: '%s – Fakturasystem' },
  description: 'Lag, send og få betalt fakturaer – på mobil og web.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F6F2' },
    { media: '(prefers-color-scheme: dark)', color: '#121513' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nb">
      <body className="bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
