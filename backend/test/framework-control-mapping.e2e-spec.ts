import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAs, authHeader } from './utils/test-app';

/**
 * Control Library <-> Framework clause mapping: FrameworkControl CRUD, a
 * Control mapping to individual clauses (e.g. ISO 27001:2022 "A.5.1")
 * across one or more Frameworks, and the dedup behaviour this feeds into
 * (Framework coverage, Dashboards frameworkCoverage). Requires
 * DATABASE_URL to point at a migrated + seeded database.
 */
describe('Framework clause mapping (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let orgUnitId: string;
  let domainCategoryId: string;
  let frameworkAId: string;
  let frameworkBId: string;

  beforeAll(async () => {
    app = await createTestApp();
    token = await loginAs(app, 'admin@dagrofa.dk');

    const [orgUnits, categories, frameworks] = await Promise.all([
      request(app.getHttpServer()).get('/api/org-units').set(...authHeader(token)),
      request(app.getHttpServer()).get('/api/categories').set(...authHeader(token)),
      request(app.getHttpServer()).get('/api/frameworks').set(...authHeader(token)),
    ]);
    orgUnitId = orgUnits.body[0].id;
    domainCategoryId = categories.body[0].id;
    frameworkAId = frameworks.body[0].id;
    frameworkBId = frameworks.body[1].id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates, updates, and deletes a FrameworkControl clause', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/framework-controls')
      .set(...authHeader(token))
      .send({ frameworkId: frameworkAId, code: `E2E-${Date.now()}`, title: 'e2e clause' })
      .expect(201);
    expect(created.body.framework.id).toBe(frameworkAId);
    expect(created.body.title).toBe('e2e clause');

    const updated = await request(app.getHttpServer())
      .patch(`/api/framework-controls/${created.body.id}`)
      .set(...authHeader(token))
      .send({ title: 'e2e clause (renamed)' })
      .expect(200);
    expect(updated.body.title).toBe('e2e clause (renamed)');

    await request(app.getHttpServer()).delete(`/api/framework-controls/${created.body.id}`).set(...authHeader(token)).expect(200);
    await request(app.getHttpServer()).get(`/api/framework-controls/${created.body.id}`).set(...authHeader(token)).expect(404);
  });

  it('maps a Control to individual clauses across two Frameworks, and dedupes it in coverage/dashboards', async () => {
    const clauseA = await request(app.getHttpServer())
      .post('/api/framework-controls')
      .set(...authHeader(token))
      .send({ frameworkId: frameworkAId, code: `E2E-A-${Date.now()}`, title: 'e2e clause A' })
      .expect(201);
    const clauseB = await request(app.getHttpServer())
      .post('/api/framework-controls')
      .set(...authHeader(token))
      .send({ frameworkId: frameworkBId, code: `E2E-B-${Date.now()}`, title: 'e2e clause B' })
      .expect(201);

    const control = await request(app.getHttpServer())
      .post('/api/controls')
      .set(...authHeader(token))
      .send({
        code: `E2E-CTL-${Date.now()}`,
        name: 'e2e: clause-mapped control',
        domainCategoryId,
        orgUnitId,
        type: 'PREVENTIVE',
        frequency: 'CONTINUOUS',
        frameworkControlIds: [clauseA.body.id, clauseB.body.id],
      })
      .expect(201);
    expect(control.body.frameworkControls).toHaveLength(2);
    expect(control.body.frameworkControls.map((fc: { id: string }) => fc.id).sort()).toEqual(
      [clauseA.body.id, clauseB.body.id].sort(),
    );

    // Filtering Controls by frameworkId matches through the clause, not a direct link.
    const filtered = await request(app.getHttpServer())
      .get(`/api/controls?frameworkId=${frameworkAId}`)
      .set(...authHeader(token))
      .expect(200);
    expect(filtered.body.some((c: { id: string }) => c.id === control.body.id)).toBe(true);

    // Framework A's coverage now counts this Control once, mapped via clauseA.
    const frameworkA = await request(app.getHttpServer())
      .get(`/api/frameworks/${frameworkAId}`)
      .set(...authHeader(token))
      .expect(200);
    expect(frameworkA.body.mappedControls.some((c: { id: string }) => c.id === control.body.id)).toBe(true);
    const clauseAEntry = frameworkA.body.clauses.find((c: { id: string }) => c.id === clauseA.body.id);
    expect(clauseAEntry.mappedControls.some((c: { id: string }) => c.id === control.body.id)).toBe(true);

    // Re-mapping the Control to two clauses within the SAME Framework (A) must still
    // count it once in that Framework's coverage - the dedup this feature exists for.
    const clauseA2 = await request(app.getHttpServer())
      .post('/api/framework-controls')
      .set(...authHeader(token))
      .send({ frameworkId: frameworkAId, code: `E2E-A2-${Date.now()}`, title: 'e2e clause A2' })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/api/controls/${control.body.id}`)
      .set(...authHeader(token))
      .send({ frameworkControlIds: [clauseA.body.id, clauseA2.body.id] })
      .expect(200);
    expect(updated.body.frameworkControls).toHaveLength(2);

    const frameworkAAfter = await request(app.getHttpServer())
      .get(`/api/frameworks/${frameworkAId}`)
      .set(...authHeader(token))
      .expect(200);
    const occurrences = frameworkAAfter.body.mappedControls.filter((c: { id: string }) => c.id === control.body.id);
    expect(occurrences).toHaveLength(1);

    // The dashboards frameworkCoverage tile is built off the same deduped
    // per-Framework control set (see DashboardsService.frameworkCoverage) -
    // just confirm it still resolves cleanly for this Framework.
    const operational = await request(app.getHttpServer())
      .get(`/api/dashboards/operational`)
      .set(...authHeader(token))
      .expect(200);
    const coverageTile = operational.body.frameworkCoverage?.find(
      (f: { frameworkId: string }) => f.frameworkId === frameworkAId,
    );
    expect(coverageTile).toBeDefined();
    expect(coverageTile.coveragePercent).toBeGreaterThanOrEqual(0);
  });
});
