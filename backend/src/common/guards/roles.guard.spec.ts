import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { AuthenticatedUser } from '../types/authenticated-user';

function buildContext(user?: AuthenticatedUser): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeUser(role: UserRole): AuthenticatedUser {
  return { id: 'u1', email: 'u1@dagrofa.dk', name: 'Test User', role, orgUnitIds: [] };
}

describe('RolesGuard', () => {
  it('allows any authenticated user when no @Roles metadata is present', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext(makeUser(UserRole.AUDITOR)))).toBe(true);
  });

  it('allows access when the user role is in the required list', () => {
    const reflector = {
      getAllAndOverride: () => [UserRole.ADMIN, UserRole.RISK_OWNER],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext(makeUser(UserRole.RISK_OWNER)))).toBe(true);
  });

  it('denies access when the user role is not in the required list', () => {
    const reflector = {
      getAllAndOverride: () => [UserRole.ADMIN],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(buildContext(makeUser(UserRole.AUDITOR)))).toThrow(
      ForbiddenException,
    );
  });

  it('denies access when there is no authenticated user but roles are required', () => {
    const reflector = {
      getAllAndOverride: () => [UserRole.ADMIN],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });

  it('denies EXECUTIVE from a write-only endpoint restricted to ADMIN/RISK_OWNER', () => {
    const reflector = {
      getAllAndOverride: () => [UserRole.ADMIN, UserRole.RISK_OWNER],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(buildContext(makeUser(UserRole.EXECUTIVE)))).toThrow(
      ForbiddenException,
    );
  });
});
