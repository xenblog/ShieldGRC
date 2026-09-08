const REQUIRED_IN_ALL_ENVS = ['DATABASE_URL', 'JWT_ACCESS_SECRET'];

/**
 * Fails fast at boot if required configuration is missing, rather than
 * surfacing a confusing runtime error the first time a route touches it.
 * Entra ID variables are intentionally NOT required here - the app must
 * boot without them so local dev can run against the seeded local admin
 * only (see EntraAuthProvider.isConfigured()).
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED_IN_ALL_ENVS.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const accessSecret = String(config.JWT_ACCESS_SECRET ?? '');
  if (accessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be at least 32 characters long');
  }

  return config;
}
