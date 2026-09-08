import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAs, authHeader } from './utils/test-app';

/**
 * Risk Assessment + Treatment Action API flow: create an assessment with
 * linked risks, add treatment actions, and confirm progressPercent
 * auto-computes from the COMPLETED share (with manual override respected,
 * and cleanly resumed once override is turned back off). Requires
 * DATABASE_URL to point at a migrated + seeded database.
 */
describe('Risk Assessment + Treatment Actions (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let orgUnitId: string;
  let categoryId: string;
  let userId: string;
  let riskId: string;

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
    userId = me.body.id;

    const risk = await request(app.getHttpServer())
      .post('/api/risks')
      .set(...authHeader(token))
      .send({ title: 'e2e: assessment-linked risk', description: 'x', categoryId, orgUnitId, ownerId: userId, likelihood: 3, impact: 3 })
      .expect(201);
    riskId = risk.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates an assessment with a linked risk at 0% progress', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/risk-assessments')
      .set(...authHeader(token))
      .send({
        name: 'e2e: assessment',
        scope: 'scope',
        orgUnitId,
        leadAssessorId: userId,
        startDate: '2026-01-01',
        dueDate: '2026-12-31',
        riskIds: [riskId],
      })
      .expect(201);

    expect(res.body.progressPercent).toBe(0);
    expect(res.body.linkedRisks).toHaveLength(1);
    expect(res.body.linkedRisks[0].id).toBe(riskId);
    expect(res.body.auditHistory).toHaveLength(1);
  });

  it('auto-computes progress from the COMPLETED share of treatment actions, respects override, and resumes auto-compute when override is lifted', async () => {
    const assessment = await request(app.getHttpServer())
      .post('/api/risk-assessments')
      .set(...authHeader(token))
      .send({ name: 'e2e: progress assessment', scope: 'scope', orgUnitId, leadAssessorId: userId, startDate: '2026-01-01', dueDate: '2026-12-31' })
      .expect(201);
    const assessmentId = assessment.body.id;

    const action1 = await request(app.getHttpServer())
      .post('/api/treatment-actions')
      .set(...authHeader(token))
      .send({ description: 'Action 1', riskId, assessmentId, ownerId: userId, dueDate: '2026-06-01' })
      .expect(201);
    const action2 = await request(app.getHttpServer())
      .post('/api/treatment-actions')
      .set(...authHeader(token))
      .send({ description: 'Action 2', riskId, assessmentId, ownerId: userId, dueDate: '2026-06-02' })
      .expect(201);

    let current = await request(app.getHttpServer()).get(`/api/risk-assessments/${assessmentId}`).set(...authHeader(token)).expect(200);
    expect(current.body.progressPercent).toBe(0);

    await request(app.getHttpServer())
      .patch(`/api/treatment-actions/${action1.body.id}`)
      .set(...authHeader(token))
      .send({ status: 'COMPLETED' })
      .expect(200);

    current = await request(app.getHttpServer()).get(`/api/risk-assessments/${assessmentId}`).set(...authHeader(token)).expect(200);
    expect(current.body.progressPercent).toBe(50);
    expect(current.body.treatmentActions).toHaveLength(2);

    const overridden = await request(app.getHttpServer())
      .patch(`/api/risk-assessments/${assessmentId}`)
      .set(...authHeader(token))
      .send({ progressOverride: true, progressManualValue: 90 })
      .expect(200);
    expect(overridden.body.progressPercent).toBe(90);

    // Completing the second action must NOT move the overridden value.
    await request(app.getHttpServer())
      .patch(`/api/treatment-actions/${action2.body.id}`)
      .set(...authHeader(token))
      .send({ status: 'COMPLETED' })
      .expect(200);
    current = await request(app.getHttpServer()).get(`/api/risk-assessments/${assessmentId}`).set(...authHeader(token)).expect(200);
    expect(current.body.progressPercent).toBe(90);

    const resumed = await request(app.getHttpServer())
      .patch(`/api/risk-assessments/${assessmentId}`)
      .set(...authHeader(token))
      .send({ progressOverride: false })
      .expect(200);
    // Both actions are now COMPLETED, so auto-compute resumes at 100%.
    expect(resumed.body.progressPercent).toBe(100);
  });

  it('a treatment action can also stand alone, without an assessment', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/treatment-actions')
      .set(...authHeader(token))
      .send({ description: 'Standalone action', riskId, ownerId: userId, dueDate: '2026-06-01' })
      .expect(201);
    expect(res.body.assessment).toBeNull();

    const list = await request(app.getHttpServer()).get('/api/treatment-actions?status=NOT_STARTED').set(...authHeader(token)).expect(200);
    expect(list.body.some((a: { id: string }) => a.id === res.body.id)).toBe(true);
  });

  it('replaces an assessment\'s linked risks via PUT .../risks', async () => {
    const assessment = await request(app.getHttpServer())
      .post('/api/risk-assessments')
      .set(...authHeader(token))
      .send({ name: 'e2e: relink assessment', scope: 'scope', orgUnitId, leadAssessorId: userId, startDate: '2026-01-01', dueDate: '2026-12-31', riskIds: [riskId] })
      .expect(201);

    const otherRisk = await request(app.getHttpServer())
      .post('/api/risks')
      .set(...authHeader(token))
      .send({ title: 'e2e: second linked risk', description: 'x', categoryId, orgUnitId, ownerId: userId, likelihood: 2, impact: 2 })
      .expect(201);

    const relinked = await request(app.getHttpServer())
      .put(`/api/risk-assessments/${assessment.body.id}/risks`)
      .set(...authHeader(token))
      .send({ riskIds: [otherRisk.body.id] })
      .expect(200);

    expect(relinked.body.linkedRisks).toHaveLength(1);
    expect(relinked.body.linkedRisks[0].id).toBe(otherRisk.body.id);
  });
});
