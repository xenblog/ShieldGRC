import { UserRole } from '@prisma/client';

/**
 * Shape attached to req.user by JwtStrategy.validate(). orgUnitIds is loaded
 * fresh from the DB on every request (not baked into the JWT) so that a
 * membership change by an Admin takes effect immediately, not only after the
 * token expires.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  // Null until an Admin assigns one (JIT-provisioned SSO users start with no
  // role) - RolesGuard denies any @Roles()-guarded endpoint for these users
  // by construction, since `null` never matches a required role.
  role: UserRole | null;
  orgUnitIds: string[];
}
