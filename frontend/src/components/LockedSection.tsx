import Link from 'next/link';

/**
 * Shared placeholder for nav sections reserved in the information
 * architecture but out of scope for this build (Controls, Control Testing,
 * Compliance, AI Governance, Supplier Risk - see nav-config.ts). The nav
 * itself already renders these as disabled/"Coming later"; this page exists
 * so a direct URL visit also finds no functional route behind them, not
 * just a disabled nav link.
 */
export function LockedSection({ title, phase }: { title: string; phase?: string }) {
  return (
    <div className="card locked-placeholder" style={{ maxWidth: 480, margin: '0 auto' }}>
      <p className="eyebrow">{phase ? `Coming later · ${phase}` : 'Coming later'}</p>
      <h1>{title}</h1>
      <p>This module is reserved in DagrofaShield&apos;s navigation but is not part of this build.</p>
      <Link href="/dashboards" className="btn-secondary" style={{ marginTop: 16, display: 'inline-flex' }}>
        Back to Dashboards
      </Link>
    </div>
  );
}
