import Link from 'next/link';

/**
 * Shared placeholder for nav sections reserved in the information
 * architecture but out of scope for this build (Controls, Control Testing,
 * Compliance, AI Governance, Supplier Risk - see nav-config.ts). The nav
 * itself already renders these as disabled/"Coming later"; this page exists
 * so a direct URL visit also finds no functional route behind them, not
 * just a disabled nav link.
 */
export function LockedSection({ title }: { title: string }) {
  return (
    <div className="dgs-card mx-auto max-w-lg p-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Coming later</p>
      <h1 className="mt-1 text-xl font-semibold text-gray-700">{title}</h1>
      <p className="mt-2 text-sm text-[var(--dgs-text-muted)]">
        This module is reserved in DagrofaShield&apos;s navigation but is not part of this build.
      </p>
      <Link href="/dashboards" className="mt-4 inline-block text-sm text-[var(--dgs-primary)] hover:underline">
        Back to Dashboards
      </Link>
    </div>
  );
}
