import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restricts an endpoint to the given roles. Absence of this decorator means
 * "any authenticated user" - further org-unit scoping still applies at the
 * query/service layer via OrgUnitScopeService.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
