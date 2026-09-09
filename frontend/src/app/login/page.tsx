'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const { user, loading, ssoEnabled, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ssoFailed = searchParams.get('error') === 'sso_failed';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboards');
    }
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      router.replace('/dashboards');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">Loading…</div>;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--dgs-salt-tint)', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 360, padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div className="brand-mark" style={{ background: 'var(--dgs-groent)' }} />
          <div>
            <h1 style={{ fontFamily: 'var(--font-content)', fontSize: 18, fontWeight: 'bold', color: 'var(--dgs-red)', margin: 0 }}>
              DagrofaShield
            </h1>
            <p className="helper-note" style={{ margin: 0 }}>
              Sign in to continue
            </p>
          </div>
        </div>

        {ssoFailed && (
          <p className="helper-note" style={{ color: 'var(--dgs-red)', marginBottom: 12 }}>
            Microsoft Entra ID sign-in failed. Try again or use a local account.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              style={{ fontFamily: 'var(--font-chrome)' }}
            />
          </div>
          <div className="field">
            <label className="field-label">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              style={{ fontFamily: 'var(--font-chrome)' }}
            />
          </div>
          {error && (
            <p className="helper-note" style={{ color: 'var(--dgs-red)', marginBottom: 12 }}>
              {error}
            </p>
          )}
          <button type="submit" disabled={submitting} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {ssoEnabled && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0', fontFamily: 'var(--font-chrome)', fontSize: 12, color: 'var(--dgs-umami)' }}>
              <div style={{ height: 1, flex: 1, background: 'var(--dgs-salt)' }} />
              or
              <div style={{ height: 1, flex: 1, background: 'var(--dgs-salt)' }} />
            </div>
            <a href="/api/auth/entra/login" className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
              Sign in with Microsoft Entra ID
            </a>
          </>
        )}
      </div>
    </div>
  );
}
