import { User } from '@prisma/client';

/**
 * Common contract for anything that can resolve an inbound login attempt to
 * a DagrofaShield User. AuthService only ever deals with providers through
 * this interface, so a future provider (e.g. an invite/magic-link flow for
 * external supplier users) can be added without touching AuthService's token
 * issuance/refresh/logout logic.
 */
export interface AuthProvider {
  readonly providerKey: string;
}

export interface CredentialsAuthProvider extends AuthProvider {
  validateCredentials(email: string, password: string): Promise<User>;
}

export interface RedirectAuthProvider extends AuthProvider {
  isConfigured(): boolean;
  getAuthorizationUrl(state: string): Promise<string>;
  handleCallback(code: string, state: string, expectedState: string): Promise<User>;
}
