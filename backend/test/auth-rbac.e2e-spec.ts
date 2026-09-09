import { INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAs, authHeader, getPrisma } from './utils/test-app';
import { AuthService } from '../src/modules/auth/auth.service';
import { LocalAuthProvider } from '../src/modules/auth/providers/local-auth.provider';

/**
 * Covers local login, and - at the real HTTP layer, not just the unit-test
 * layer - the org-unit-scope AND-combination regression documented in
 * ARCHITECTURE.md ("A note on a bug we caught and fixed"): an explicit
 * ?orgUnitId= filter must never be able to either drop or widen a
 * Risk Owner/Auditor's own org-unit scope.
 *
 * All logins happen once in beforeAll and are reused across `it` blocks -
 * /auth/local/login is intentionally rate-limited (5 req/min, see
 * AuthController), and this suite would trip that limit if it logged in
 * fresh inside every test.
 *
 * Requires DATABASE_URL to point at a migrated + seeded database (see
 * README.md "Running the tests").
 */
describe('Auth + RBAC (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let riskOwnerToken: string;
  let riskOwnerId: string;
  let riskOwnerOrgUnitIds: string[];
  let auditorToken: string;
  let executiveToken: string;
  let orgUnits: { id: string }[];
  let categoryId: string;

  beforeAll(async () => {
    app = await createTestApp();

    [adminToken, riskOwnerToken, auditorToken, executiveToken] = await Promise.all([
      loginAs(app, 'admin@dagrofa.dk'),
      loginAs(app, 'anna.poulsen@dagrofa.dk'),
      loginAs(app, 'anders.auditor@dagrofa.dk'),
      loginAs(app, 'eva.direktion@dagrofa.dk'),
    ]);

    const [orgUnitsRes, categoriesRes, meRes] = await Promise.all([
      request(app.getHttpServer()).get('/api/org-units').set(...authHeader(adminToken)),
      request(app.getHttpServer()).get('/api/categories').set(...authHeader(adminToken)),
      request(app.getHttpServer()).get('/api/auth/me').set(...authHeader(riskOwnerToken)),
    ]);
    orgUnits = orgUnitsRes.body;
    categoryId = categoriesRes.body[0].id;
    riskOwnerId = meRes.body.id;
    riskOwnerOrgUnitIds = meRes.body.orgUnitIds;
    expect(riskOwnerOrgUnitIds.length).toBeGreaterThan(0);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('local login', () => {
    it('rejects an invalid password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/local/login')
        .send({ email: 'admin@dagrofa.dk', password: 'wrong-password' })
        .expect(401);
    });

    it('rejects unauthenticated access to a protected route', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('logged the admin in with the right role', async () => {
      const me = await request(app.getHttpServer()).get('/api/auth/me').set(...authHeader(adminToken)).expect(200);
      expect(me.body.role).toBe('ADMIN');
    });
  });

  describe('org-unit scoping (Risk Owner / Auditor)', () => {
    it("never leaks risks outside the Risk Owner's org units on an unfiltered list", async () => {
      const risks = await request(app.getHttpServer()).get('/api/risks').set(...authHeader(riskOwnerToken)).expect(200);
      expect(risks.body.items.length).toBeGreaterThan(0);
      for (const risk of risks.body.items) {
        expect(riskOwnerOrgUnitIds).toContain(risk.orgUnitId);
      }
    });

    it('cannot widen access by passing an explicit orgUnitId outside their scope', async () => {
      const outsideOrgUnit = orgUnits.find((o) => !riskOwnerOrgUnitIds.includes(o.id));
      expect(outsideOrgUnit).toBeTruthy();

      // The AND-combination bug this regression-tests: a naive spread would
      // let this explicit filter override (widen) the scope instead of
      // narrowing within it - so this must come back empty, not the other
      // org unit's risks.
      const res = await request(app.getHttpServer())
        .get(`/api/risks?orgUnitId=${outsideOrgUnit!.id}`)
        .set(...authHeader(riskOwnerToken))
        .expect(200);
      expect(res.body.items).toEqual([]);

      // And direct writes to that org unit must be rejected outright, not just filtered.
      await request(app.getHttpServer())
        .post('/api/risks')
        .set(...authHeader(riskOwnerToken))
        .send({
          title: 'Should be rejected',
          description: 'x',
          categoryId,
          orgUnitId: outsideOrgUnit!.id,
          ownerId: riskOwnerId,
          likelihood: 1,
          impact: 1,
        })
        .expect(403);
    });

    it('lets a Risk Owner write within their own org unit', async () => {
      await request(app.getHttpServer())
        .post('/api/risks')
        .set(...authHeader(riskOwnerToken))
        .send({
          title: 'e2e: within-scope risk',
          description: 'x',
          categoryId,
          orgUnitId: riskOwnerOrgUnitIds[0],
          ownerId: riskOwnerId,
          likelihood: 2,
          impact: 2,
        })
        .expect(201);
    });

    it('lets an Auditor read but not write', async () => {
      await request(app.getHttpServer()).get('/api/risks').set(...authHeader(auditorToken)).expect(200);

      await request(app.getHttpServer())
        .post('/api/risks')
        .set(...authHeader(auditorToken))
        .send({
          title: 'Auditor should not be able to create this',
          description: 'x',
          categoryId,
          orgUnitId: orgUnits[0].id,
          ownerId: riskOwnerId,
          likelihood: 1,
          impact: 1,
        })
        .expect(403);
    });

    it('admin-only endpoints reject non-admins', async () => {
      await request(app.getHttpServer()).get('/api/audit-logs').set(...authHeader(auditorToken)).expect(403);
    });
  });

  describe('Executive (group-level, read-only)', () => {
    it('sees risks across every org unit, not just an assigned subset', async () => {
      const risks = await request(app.getHttpServer())
        .get('/api/risks?pageSize=0')
        .set(...authHeader(executiveToken))
        .expect(200);
      const distinctOrgUnits = new Set(risks.body.items.map((r: { orgUnitId: string }) => r.orgUnitId));
      expect(distinctOrgUnits.size).toBeGreaterThan(1);
    });

    it('cannot write', async () => {
      await request(app.getHttpServer())
        .post('/api/risks')
        .set(...authHeader(executiveToken))
        .send({
          title: 'Executive should not be able to create this',
          description: 'x',
          categoryId,
          orgUnitId: orgUnits[0].id,
          ownerId: riskOwnerId,
          likelihood: 1,
          impact: 1,
        })
        .expect(403);
    });
  });

  describe('Account lifecycle (status/source)', () => {
    // Exercises LocalAuthProvider directly rather than through
    // POST /api/auth/local/login: that route is throttled to 5 req/min
    // (see AuthController), a budget the 'local login' describe block above
    // already spends in full, so this goes through the same underlying
    // service method the controller calls without tripping the limiter.
    it('blocks login once an account is deactivated, and revives it on reactivation', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/users')
        .set(...authHeader(adminToken))
        .send({
          email: 'e2e-lifecycle@dagrofa.dk',
          name: 'E2E Lifecycle',
          role: 'AUDITOR',
          password: 'E2ELifecycle123!',
        })
        .expect(201);
      expect(created.body.status).toBe('INVITED');

      const localAuthProvider = app.get(LocalAuthProvider);

      // A successful login carries Invited -> Active and stamps lastLoginAt
      // (recordLogin, called by AuthController on this same code path).
      const authService = app.get(AuthService);
      const loggedInUser = await localAuthProvider.validateCredentials('e2e-lifecycle@dagrofa.dk', 'E2ELifecycle123!');
      await authService.recordLogin(loggedInUser.id);
      const me = await request(app.getHttpServer())
        .get('/api/users')
        .set(...authHeader(adminToken))
        .expect(200);
      const afterFirstLogin = me.body.find((u: { id: string }) => u.id === created.body.id);
      expect(afterFirstLogin.status).toBe('ACTIVE');
      expect(afterFirstLogin.lastLoginAt).toBeTruthy();

      await request(app.getHttpServer())
        .post(`/api/users/${created.body.id}/deactivate`)
        .set(...authHeader(adminToken))
        .expect(201);

      await expect(
        localAuthProvider.validateCredentials('e2e-lifecycle@dagrofa.dk', 'E2ELifecycle123!'),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      await request(app.getHttpServer())
        .post(`/api/users/${created.body.id}/reactivate`)
        .set(...authHeader(adminToken))
        .expect(201);

      await expect(
        localAuthProvider.validateCredentials('e2e-lifecycle@dagrofa.dk', 'E2ELifecycle123!'),
      ).resolves.toMatchObject({ email: 'e2e-lifecycle@dagrofa.dk' });
    });

    it('denies role-gated endpoints for a JIT-provisioned user who has no role yet', async () => {
      // Real Entra ID SSO isn't configured in this test environment, so this
      // reproduces the no-role JIT state EntraAuthProvider.handleCallback
      // creates directly via Prisma, then issues a real token pair for it
      // exactly as AuthController would after a real SSO callback.
      const prisma = getPrisma(app);
      const noRoleUser = await prisma.user.create({
        data: {
          email: 'e2e-norole@dagrofa.dk',
          name: 'E2E No Role',
          role: null,
          status: 'ACTIVE',
          source: 'ENTRA_SSO',
        },
      });
      const authService = app.get(AuthService);
      const tokens = await authService.issueTokensForUser(noRoleUser);

      const me = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set(...authHeader(tokens.accessToken))
        .expect(200);
      expect(me.body.role).toBeNull();

      // Authenticated, but no @Roles()-guarded endpoint is reachable without one.
      await request(app.getHttpServer())
        .get('/api/users')
        .set(...authHeader(tokens.accessToken))
        .expect(403);
      await request(app.getHttpServer()).get('/api/audit-logs').set(...authHeader(tokens.accessToken)).expect(403);
    });
  });
});
