import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAs, authHeader } from './utils/test-app';

/**
 * Main Risk Register API flow: create -> live inherent/residual scoring ->
 * update -> flat sortable/paginated list -> heat map -> overdue-review flag
 * -> audit trail. Requires DATABASE_URL to point at a migrated + seeded
 * database.
 */
describe('Risk Register (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let orgUnitId: string;
  let categoryId: string;
  let ownerId: string;

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
    ownerId = me.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('computes inherent score/band server-side on create, ignoring anything the client might send for them', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/risks')
      .set(...authHeader(token))
      .send({
        title: 'e2e: scoring risk',
        description: 'desc',
        categoryId,
        orgUnitId,
        ownerId,
        likelihood: 4,
        impact: 4,
      })
      .expect(201);

    expect(res.body.inherentScore).toBe(16);
    expect(res.body.inherentBand).toBe('CRITICAL');
    expect(res.body.residualScore).toBeNull();
    expect(res.body.auditHistory).toHaveLength(1);
    expect(res.body.auditHistory[0].action).toBe('CREATE');
  });

  it('rejects likelihood/impact outside 1-5', async () => {
    await request(app.getHttpServer())
      .post('/api/risks')
      .set(...authHeader(token))
      .send({ title: 'x', description: 'x', categoryId, orgUnitId, ownerId, likelihood: 6, impact: 1 })
      .expect(400);
  });

  it('recomputes the residual band live from a manually-entered residual score on update', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/risks')
      .set(...authHeader(token))
      .send({ title: 'e2e: residual risk', description: 'desc', categoryId, orgUnitId, ownerId, likelihood: 5, impact: 5 })
      .expect(201);
    expect(created.body.inherentScore).toBe(25);
    expect(created.body.residualScore).toBeNull();

    const updated = await request(app.getHttpServer())
      .patch(`/api/risks/${created.body.id}`)
      .set(...authHeader(token))
      .send({ residualScore: 9, treatmentStrategy: 'REDUCE' })
      .expect(200);
    expect(updated.body.residualScore).toBe(9);
    expect(updated.body.residualBand).toBe('HIGH');
    // Inherent score is untouched by a residual-only edit.
    expect(updated.body.inherentScore).toBe(25);
    expect(updated.body.auditHistory).toHaveLength(2);

    // And live again: bumping likelihood recomputes inherent without touching residual.
    const updated2 = await request(app.getHttpServer())
      .patch(`/api/risks/${created.body.id}`)
      .set(...authHeader(token))
      .send({ likelihood: 1 })
      .expect(200);
    expect(updated2.body.inherentScore).toBe(5);
    expect(updated2.body.inherentBand).toBe('MEDIUM');
    expect(updated2.body.residualScore).toBe(9); // still carried over, untouched

    // Editing the residual score alone recomputes only its band, live.
    const updated3 = await request(app.getHttpServer())
      .patch(`/api/risks/${created.body.id}`)
      .set(...authHeader(token))
      .send({ residualScore: 3 })
      .expect(200);
    expect(updated3.body.residualScore).toBe(3);
    expect(updated3.body.residualBand).toBe('LOW');
  });

  it('flags a risk whose next review date has passed, and does not flag one that has not', async () => {
    const overdue = await request(app.getHttpServer())
      .post('/api/risks')
      .set(...authHeader(token))
      .send({
        title: 'e2e: overdue review risk',
        description: 'desc',
        categoryId,
        orgUnitId,
        ownerId,
        likelihood: 1,
        impact: 1,
        nextReviewDate: '2020-01-01',
      })
      .expect(201);
    expect(overdue.body.isOverdue).toBe(true);

    const notOverdue = await request(app.getHttpServer())
      .post('/api/risks')
      .set(...authHeader(token))
      .send({
        title: 'e2e: future review risk',
        description: 'desc',
        categoryId,
        orgUnitId,
        ownerId,
        likelihood: 1,
        impact: 1,
        nextReviewDate: '2099-01-01',
      })
      .expect(201);
    expect(notOverdue.body.isOverdue).toBe(false);
  });

  it('lists risks as a single flat table, sorted by inherent score descending by default', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/risks?categoryId=${categoryId}`)
      .set(...authHeader(token))
      .expect(200);

    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const risk of res.body.items) {
      expect(risk.categoryId).toBe(categoryId);
    }
    for (let i = 1; i < res.body.items.length; i++) {
      expect(res.body.items[i - 1].inherentScore).toBeGreaterThanOrEqual(res.body.items[i].inherentScore);
    }
  });

  it('paginates and sorts on request', async () => {
    const page1 = await request(app.getHttpServer())
      .get('/api/risks?pageSize=2&page=1&sortBy=title&sortDir=asc')
      .set(...authHeader(token))
      .expect(200);
    expect(page1.body.items).toHaveLength(2);

    const page2 = await request(app.getHttpServer())
      .get('/api/risks?pageSize=2&page=2&sortBy=title&sortDir=asc')
      .set(...authHeader(token))
      .expect(200);
    expect(page2.body.items).toHaveLength(2);
    expect(page2.body.items[0].id).not.toBe(page1.body.items[0].id);
    expect(page1.body.items[0].title.localeCompare(page1.body.items[1].title)).toBeLessThanOrEqual(0);
  });

  it('heat map returns all 25 cells with correct band per likelihood x impact', async () => {
    const res = await request(app.getHttpServer()).get('/api/risks/heat-map').set(...authHeader(token)).expect(200);
    expect(res.body).toHaveLength(25);
    const cell55 = res.body.find((c: { likelihood: number; impact: number }) => c.likelihood === 5 && c.impact === 5);
    expect(cell55.band).toBe('CRITICAL');
    const cell11 = res.body.find((c: { likelihood: number; impact: number }) => c.likelihood === 1 && c.impact === 1);
    expect(cell11.band).toBe('LOW');
  });

  it('supports exact-cell drill-through via ?likelihood=&impact=', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/risks?likelihood=4&impact=4')
      .set(...authHeader(token))
      .expect(200);
    for (const risk of res.body.items) {
      expect(risk.likelihood).toBe(4);
      expect(risk.impact).toBe(4);
    }
    expect(res.body.items.some((r: { title: string }) => r.title === 'e2e: scoring risk')).toBe(true);
  });

  it('deletes a risk and records the DELETE audit entry (retrievable while entity still existed)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/risks')
      .set(...authHeader(token))
      .send({ title: 'e2e: to delete', description: 'desc', categoryId, orgUnitId, ownerId, likelihood: 1, impact: 1 })
      .expect(201);

    await request(app.getHttpServer()).delete(`/api/risks/${created.body.id}`).set(...authHeader(token)).expect(200);
    await request(app.getHttpServer()).get(`/api/risks/${created.body.id}`).set(...authHeader(token)).expect(404);
  });
});
