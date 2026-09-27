import Link from 'next/link';

/** Arbeidsnavn og merke. Byttes ut når produktet har fått navn. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold ${className}`}>
      <svg viewBox="0 0 512 512" className="size-8" aria-hidden="true">
        <rect width="512" height="512" rx="96" fill="currentColor" />
        <path d="M160 112h144l72 72v216a24 24 0 0 1-24 24H160a24 24 0 0 1-24-24V136a24 24 0 0 1 24-24z" fill="#f7f6f2" />
        <rect x="176" y="232" width="160" height="20" rx="10" fill="#1f4d3a" />
        <rect x="176" y="280" width="120" height="20" rx="10" fill="#1f4d3a" />
        <rect x="176" y="344" width="80" height="28" rx="14" fill="#e0a526" />
      </svg>
      Fakturasystem
    </span>
  );
}

export function PublicHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-primary no-underline">
          <Logo />
        </Link>
      </div>
    </header>
  );
}
