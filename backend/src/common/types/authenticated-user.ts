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
  role: UserRole;
  orgUnitIds: string[];
}
