import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAs, authHeader } from './utils/test-app';

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
      expect(risks.body.length).toBeGreaterThan(0);
      for (const risk of risks.body) {
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
      expect(res.body).toEqual([]);

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
      const risks = await request(app.getHttpServer()).get('/api/risks').set(...authHeader(executiveToken)).expect(200);
      const distinctOrgUnits = new Set(risks.body.map((r: { orgUnitId: string }) => r.orgUnitId));
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
});
