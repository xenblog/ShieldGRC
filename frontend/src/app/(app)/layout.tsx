'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/layout/AppShell';

function PendingSetupScreen() {
  const { logout } = useAuth();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--dgs-salt-tint)', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 380, padding: 32, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <div className="brand-mark" style={{ background: 'var(--dgs-groent)' }} />
        </div>
        <h1 style={{ fontFamily: 'var(--font-content)', fontSize: 18, fontWeight: 'bold', color: 'var(--dgs-black)', margin: '0 0 10px 0' }}>
          Your account is being set up
        </h1>
        <p className="helper-note" style={{ margin: '0 0 22px 0' }}>
          Contact your administrator to have a role and organizational unit assigned before you can use DagrofaShield.
        </p>
        <button type="button" onClick={() => logout()} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
          Log ud
        </button>
      </div>
    </div>
  );
}

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">Loading…</div>;
  }
  if (!user) {
    return null;
  }

  // JIT-provisioned SSO user awaiting an Admin to assign a role and org
  // unit(s) - authenticated, but with no functional nav or data to show.
  if (!user.role) {
    return <PendingSetupScreen />;
  }

  return <AppShell>{children}</AppShell>;
}
