import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * Boots a real Nest application against DATABASE_URL (see README.md
 * "Running the tests" - point it at a disposable Postgres you don't mind
 * being wiped, already migrated + seeded). Mirrors the global pipes/prefix
 * main.ts applies in production so these tests exercise the same request
 * pipeline a real client would.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return app;
}

export function getPrisma(app: INestApplication): PrismaService {
  return app.get(PrismaService);
}

/** Logs in as a seeded local account and returns its bearer access token. */
export async function loginAs(app: INestApplication, email: string, password = 'DagrofaShield2026!'): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/local/login')
    .send({ email, password })
    .expect(200);
  return res.body.accessToken as string;
}

export function authHeader(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}
