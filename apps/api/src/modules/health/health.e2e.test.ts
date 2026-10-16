import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HealthResponse } from '@monsport/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';

describe('GET /api/health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = setupApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('reaches the real Postgres database', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(HealthResponse.parse(res.body)).toEqual({ status: 'ok', db: 'up' });
  });
});
