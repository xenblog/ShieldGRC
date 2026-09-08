import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OrgUnitScopeService } from './org-unit-scope.service';
import { AuthenticatedUser } from '../types/authenticated-user';

function makeUser(role: UserRole, orgUnitIds: string[] = []): AuthenticatedUser {
  return { id: 'u1', email: 'u1@dagrofa.dk', name: 'Test User', role, orgUnitIds };
}

describe('OrgUnitScopeService', () => {
  const service = new OrgUnitScopeService();

  describe('getReadableOrgUnitIds', () => {
    it('returns null (unrestricted) for ADMIN', () => {
      expect(service.getReadableOrgUnitIds(makeUser(UserRole.ADMIN, ['a']))).toBeNull();
    });

    it('returns null (unrestricted, group-level) for EXECUTIVE even with no memberships', () => {
      expect(service.getReadableOrgUnitIds(makeUser(UserRole.EXECUTIVE, []))).toBeNull();
    });

    it('returns the assigned org units for RISK_OWNER', () => {
      expect(service.getReadableOrgUnitIds(makeUser(UserRole.RISK_OWNER, ['a', 'b']))).toEqual([
        'a',
        'b',
      ]);
    });

    it('returns the assigned org units for AUDITOR', () => {
      expect(service.getReadableOrgUnitIds(makeUser(UserRole.AUDITOR, ['c']))).toEqual(['c']);
    });
  });

  describe('readWhere', () => {
    it('returns an empty filter for ADMIN', () => {
      expect(service.readWhere(makeUser(UserRole.ADMIN))).toEqual({});
    });

    it('returns an org-unit `in` filter for RISK_OWNER', () => {
      expect(service.readWhere(makeUser(UserRole.RISK_OWNER, ['a', 'b']))).toEqual({
        orgUnitId: { in: ['a', 'b'] },
      });
    });
  });

  describe('orgUnitWhere', () => {
    it('does not drop a RISK_OWNER scope restriction when no explicit orgUnitId is given', () => {
      const user = makeUser(UserRole.RISK_OWNER, ['a', 'b']);
      expect(service.orgUnitWhere(user)).toEqual({ orgUnitId: { in: ['a', 'b'] } });
    });

    it('combines (AND) rather than overwrites when an explicit orgUnitId is given', () => {
      const user = makeUser(UserRole.RISK_OWNER, ['a', 'b']);
      const where = service.orgUnitWhere(user, 'a');
      expect(where).toEqual({
        orgUnitId: { in: ['a', 'b'] },
        AND: [{ orgUnitId: 'a' }],
      });
    });

    it('stays unrestricted for ADMIN regardless of the explicit orgUnitId', () => {
      const user = makeUser(UserRole.ADMIN, []);
      expect(service.orgUnitWhere(user, 'z')).toEqual({ AND: [{ orgUnitId: 'z' }] });
    });
  });

  describe('canWrite', () => {
    it('is true for ADMIN and RISK_OWNER, false for AUDITOR and EXECUTIVE', () => {
      expect(service.canWrite(makeUser(UserRole.ADMIN))).toBe(true);
      expect(service.canWrite(makeUser(UserRole.RISK_OWNER))).toBe(true);
      expect(service.canWrite(makeUser(UserRole.AUDITOR))).toBe(false);
      expect(service.canWrite(makeUser(UserRole.EXECUTIVE))).toBe(false);
    });
  });

  describe('assertCanWriteOrgUnit', () => {
    it('allows ADMIN to write to any org unit', () => {
      expect(() => service.assertCanWriteOrgUnit(makeUser(UserRole.ADMIN), 'x')).not.toThrow();
    });

    it('allows RISK_OWNER to write only within an assigned org unit', () => {
      const user = makeUser(UserRole.RISK_OWNER, ['a']);
      expect(() => service.assertCanWriteOrgUnit(user, 'a')).not.toThrow();
      expect(() => service.assertCanWriteOrgUnit(user, 'b')).toThrow(ForbiddenException);
    });

    it('blocks AUDITOR and EXECUTIVE from writing at all', () => {
      expect(() =>
        service.assertCanWriteOrgUnit(makeUser(UserRole.AUDITOR, ['a']), 'a'),
      ).toThrow(ForbiddenException);
      expect(() =>
        service.assertCanWriteOrgUnit(makeUser(UserRole.EXECUTIVE, ['a']), 'a'),
      ).toThrow(ForbiddenException);
    });
  });

  describe('assertCanReadOrgUnit', () => {
    it('allows ADMIN and EXECUTIVE to read any org unit', () => {
      expect(() =>
        service.assertCanReadOrgUnit(makeUser(UserRole.EXECUTIVE, []), 'z'),
      ).not.toThrow();
    });

    it('blocks AUDITOR from reading an org unit they are not assigned to', () => {
      expect(() =>
        service.assertCanReadOrgUnit(makeUser(UserRole.AUDITOR, ['a']), 'b'),
      ).toThrow(ForbiddenException);
    });
  });
});
