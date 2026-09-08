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
    <div className="flex min-h-screen items-center justify-center bg-[var(--dgs-bg)] px-4">
      <div className="dgs-card w-full max-w-sm space-y-4 p-8">
        <div>
          <h1 className="text-lg font-bold text-[var(--dgs-primary)]">DagrofaShield</h1>
          <p className="text-sm text-[var(--dgs-text-muted)]">Sign in to continue</p>
        </div>

        {ssoFailed && <p className="text-sm text-red-600">Microsoft Entra ID sign-in failed. Try again or use a local account.</p>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <input
            required
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-[var(--dgs-primary)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--dgs-primary-hover)] disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {ssoEnabled && (
          <>
            <div className="flex items-center gap-2 text-xs text-[var(--dgs-text-muted)]">
              <div className="h-px flex-1 bg-gray-200" />
              or
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <a
              href="/api/auth/entra/login"
              className="block w-full rounded border px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Sign in with Microsoft Entra ID
            </a>
          </>
        )}
      </div>
    </div>
  );
}
