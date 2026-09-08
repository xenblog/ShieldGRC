'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { api, refreshAccessToken, setAccessToken } from './api-client';
import { UserRole } from './types';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  orgUnitIds: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  ssoEnabled: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [ssoEnabled, setSsoEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const config = await api.get<{ ssoEnabled: boolean }>('/auth/config');
        if (!cancelled) setSsoEnabled(config.ssoEnabled);
      } catch {
        // non-fatal - SSO button just won't show
      }

      // Exchanges the httpOnly refresh cookie (if any) for an access token,
      // so a page reload doesn't force a fresh login.
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        try {
          const me = await api.get<AuthUser>('/auth/me');
          if (!cancelled) setUser(me);
        } catch {
          setAccessToken(null);
        }
      }
      if (!cancelled) setLoading(false);
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ accessToken: string; user: AuthUser }>('/auth/local/login', { email, password });
    setAccessToken(res.accessToken);
    setUser(res.user);
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }

  return <AuthContext.Provider value={{ user, loading, ssoEnabled, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
