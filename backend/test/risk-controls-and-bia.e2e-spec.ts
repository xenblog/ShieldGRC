import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAs, authHeader } from './utils/test-app';

/**
 * Risk<->Control linking + residual-score propagation, and the BIA Register
 * (Business Process <-> Risk linking). Requires DATABASE_URL to point at a
 * migrated + seeded database.
 */
describe('Risk-Control linking, propagation, and BIA Register (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let orgUnitId: string;
  let categoryId: string;
  let domainCategoryId: string;
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();
    token = await loginAs(app, 'admin@dagrofa.dk');

    const [orgUnits, categories, me] = await Promise.all([
      request(app.getHttpServer()).get('/api/org-units').set(...authHeader(token)),
      request(app.getHttpServer()).get('/api/categories').set(...authHeader(token)),
      request(app.getHttpServer()).get('/api/auth/me').set(...authHeader(token)),
    ]);
    orgUnitId = orgUnits.body[0].id;
    categoryId = categories.body[0].id;
    domainCategoryId = categories.body[0].id;
    userId = me.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('links a Control to a Risk and computes the residual score live from the Control (no test yet -> no reduction)', async () => {
    const risk = await request(app.getHttpServer())
      .post('/api/risks')
      .set(...authHeader(token))
      .send({ title: 'e2e: risk-control risk', description: 'x', categoryId, orgUnitId, ownerId: userId, likelihood: 4, impact: 5 })
      .expect(201);
    expect(risk.body.inherentScore).toBe(20);
    expect(risk.body.residualScore).toBeNull();

    const control = await request(app.getHttpServer())
      .post('/api/controls')
      .set(...authHeader(token))
      .send({ code: `E2E-${Date.now()}`, name: 'e2e: untested control', domainCategoryId, orgUnitId, type: 'PREVENTIVE', frequency: 'CONTINUOUS' })
      .expect(201);
    expect(control.body.effectiveness).toBe('NOT_YET_TESTED');

    const linked = await request(app.getHttpServer())
      .put(`/api/risks/${risk.body.id}/controls`)
      .set(...authHeader(token))
      .send({ controlIds: [control.body.id] })
      .expect(200);

    expect(linked.body.linkedControls).toHaveLength(1);
    expect(linked.body.linkedControls[0].id).toBe(control.body.id);
    // NOT_YET_TESTED contributes zero reduction - computed residual equals inherent.
    expect(linked.body.residualScore).toBe(20);
    expect(linked.body.residualSource).toBe('COMPUTED');

    // Propagation: passing a test for the Control recomputes the linked Risk's residual score.
    await request(app.getHttpServer())
      .post('/api/control-tests')
      .set(...authHeader(token))
      .field('controlId', control.body.id)
      .field('result', 'PASS')
      .field('testMethod', 'INSPECTION')
      .field('testerId', userId)
      .field('cycle', 'e2e cycle')
      .field('testedDate', '2026-01-01')
      .field('dueDate', '2026-12-31')
      .expect(201);

    const afterTest = await request(app.getHttpServer()).get(`/api/risks/${risk.body.id}`).set(...authHeader(token)).expect(200);
    // EFFECTIVE -> 0.7 reduction: 20 * 0.3 = 6.
    expect(afterTest.body.residualScore).toBe(6);
    expect(afterTest.body.residualSource).toBe('COMPUTED');

    // A manual override wins over the computed value...
    const overridden = await request(app.getHttpServer())
      .patch(`/api/risks/${risk.body.id}`)
      .set(...authHeader(token))
      .send({ residualScoreOverride: 2 })
      .expect(200);
    expect(overridden.body.residualScore).toBe(2);
    expect(overridden.body.residualSource).toBe('MANUAL');

    // ...until it's explicitly cleared, reverting to the computed value.
    const cleared = await request(app.getHttpServer())
      .patch(`/api/risks/${risk.body.id}`)
      .set(...authHeader(token))
      .send({ clearResidualOverride: true })
      .expect(200);
    expect(cleared.body.residualScore).toBe(6);
    expect(cleared.body.residualSource).toBe('COMPUTED');

    // Unlinking the Control removes it from the computation entirely.
    const unlinked = await request(app.getHttpServer())
      .put(`/api/risks/${risk.body.id}/controls`)
      .set(...authHeader(token))
      .send({ controlIds: [] })
      .expect(200);
    expect(unlinked.body.linkedControls).toHaveLength(0);
    expect(unlinked.body.residualScore).toBeNull();
    expect(unlinked.body.residualSource).toBeNull();
  });

  it('creates a Business Process, links Risks to it, and lists them back on the detail response', async () => {
    const risk = await request(app.getHttpServer())
      .post('/api/risks')
      .set(...authHeader(token))
      .send({ title: 'e2e: bia-linked risk', description: 'x', categoryId, orgUnitId, ownerId: userId, likelihood: 2, impact: 3 })
      .expect(201);

    const process = await request(app.getHttpServer())
      .post('/api/business-processes')
      .set(...authHeader(token))
      .send({
        name: 'e2e: order processing',
        description: 'Order intake and fulfillment',
        orgUnitId,
        ownerId: userId,
        criticalityTier: 'HIGH',
        rtoMinutes: 120,
        rpoMinutes: 30,
      })
      .expect(201);
    expect(process.body.code).toMatch(/^BP-\d{3}$/);
    expect(process.body.linkedRisks).toHaveLength(0);

    const linked = await request(app.getHttpServer())
      .put(`/api/business-processes/${process.body.id}/risks`)
      .set(...authHeader(token))
      .send({ riskIds: [risk.body.id] })
      .expect(200);
    expect(linked.body.linkedRisks).toHaveLength(1);
    expect(linked.body.linkedRisks[0].id).toBe(risk.body.id);
    expect(linked.body.auditHistory.length).toBeGreaterThan(0);

    const list = await request(app.getHttpServer())
      .get(`/api/business-processes?criticalityTier=HIGH`)
      .set(...authHeader(token))
      .expect(200);
    expect(list.body.items.some((p: { id: string }) => p.id === process.body.id)).toBe(true);

    await request(app.getHttpServer()).delete(`/api/business-processes/${process.body.id}`).set(...authHeader(token)).expect(200);
    await request(app.getHttpServer()).get(`/api/business-processes/${process.body.id}`).set(...authHeader(token)).expect(404);
  });
});
