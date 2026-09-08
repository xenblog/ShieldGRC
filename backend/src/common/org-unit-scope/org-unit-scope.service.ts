import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Central place implementing the confirmed RBAC-by-org-unit model:
 *  - ADMIN: full read/write access across all org units.
 *  - EXECUTIVE: read-only, but aggregated across ALL org units (group-level),
 *    regardless of explicit org-unit membership.
 *  - RISK_OWNER: full CRUD, scoped to their assigned org unit(s).
 *  - AUDITOR: read-only, scoped to their assigned org unit(s).
 *
 * Role is a single global attribute on the user; org-unit membership is a
 * separate many-to-many relation (UserOrgUnit) that only matters for
 * RISK_OWNER/AUDITOR scoping.
 */
@Injectable()
export class OrgUnitScopeService {
  /**
   * Returns the set of org unit ids a user may *read* within, or null to mean
   * "no restriction, all org units" (ADMIN and EXECUTIVE).
   */
  getReadableOrgUnitIds(user: AuthenticatedUser): string[] | null {
    if (user.role === UserRole.ADMIN || user.role === UserRole.EXECUTIVE) {
      return null;
    }
    return user.orgUnitIds;
  }

  /**
   * Prisma `where` fragment to intersect with a query's existing filters.
   * Spread this into a query's `where` object, e.g.:
   *   this.prisma.risk.findMany({ where: { ...scope.readWhere(user), status: 'IDENTIFIED' } })
   *
   * Typed `any` on purpose: this fragment is spread into many different
   * models' WhereInput types (Risk, Control, Framework, RiskAssessment, and
   * relation filters like `risk: {...}`/`control: {...}`), which don't share
   * a common structural type in Prisma's generated types.
   */
  readWhere(user: AuthenticatedUser): any {
    const orgUnitIds = this.getReadableOrgUnitIds(user);
    if (orgUnitIds === null) {
      return {};
    }
    return { orgUnitId: { in: orgUnitIds } };
  }

  /**
   * Safely combines the user's org-unit scope with an optional explicit
   * orgUnitId filter (e.g. from a query param) via AND, so the two can never
   * clobber each other - a naive `{ ...readWhere(user), orgUnitId: explicit }`
   * would silently drop the scope's `{ in: [...] }` restriction whenever
   * `explicit` is undefined (the later key always wins), and would let a
   * caller widen access by passing an orgUnitId outside their scope when it
   * is defined. Spread the result into a model's `where` object.
   */
  orgUnitWhere(user: AuthenticatedUser, explicitOrgUnitId?: string): any {
    const scoped = this.readWhere(user);
    if (!explicitOrgUnitId) {
      return scoped;
    }
    return { ...scoped, AND: [{ orgUnitId: explicitOrgUnitId }] };
  }

  /** Whether the user may write (create/update/delete) at all, independent of org unit. */
  canWrite(user: AuthenticatedUser): boolean {
    return user.role === UserRole.ADMIN || user.role === UserRole.RISK_OWNER;
  }

  /**
   * Throws unless the user may write to the given org unit. Call this before
   * creating a row scoped to orgUnitId, or before updating/deleting an
   * existing row (pass the row's current orgUnitId).
   */
  assertCanWriteOrgUnit(user: AuthenticatedUser, orgUnitId: string): void {
    if (!this.canWrite(user)) {
      throw new ForbiddenException('Your role does not allow write access');
    }
    if (user.role === UserRole.ADMIN) {
      return;
    }
    if (!user.orgUnitIds.includes(orgUnitId)) {
      throw new ForbiddenException('You are not assigned to this org unit');
    }
  }

  /** Throws unless the user may read within the given org unit. */
  assertCanReadOrgUnit(user: AuthenticatedUser, orgUnitId: string): void {
    const orgUnitIds = this.getReadableOrgUnitIds(user);
    if (orgUnitIds === null) {
      return;
    }
    if (!orgUnitIds.includes(orgUnitId)) {
      throw new ForbiddenException('You are not assigned to this org unit');
    }
  }
}
