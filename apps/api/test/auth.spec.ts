import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiErrorSchema, AuthCandidateSchema, SessionUserSchema } from '@monsport/shared';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

// Dat duoi .spec.ts (khong phai .e2e-spec.ts mac dinh cua Nest) — repo chua co
// vitest.config.ts nen glob mac dinh khong khop *-spec.ts co gach ngang.
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('liệt kê được danh sách user để chọn đăng nhập', async () => {
    const response = await request(httpServer).get('/api/auth/candidates');
    expect(response.status).toBe(200);

    const candidates = z.array(AuthCandidateSchema).parse(response.body);
    expect(candidates.length).toBeGreaterThanOrEqual(10);
  });

  it('đăng nhập bằng zaloId hợp lệ → có cookie, /api/auth/me đúng người (mô phỏng F5)', async () => {
    const agent = request.agent(httpServer);

    const loginResponse = await agent.post('/api/auth/login').send({ zaloId: 'mock-player-1' });
    expect(loginResponse.status).toBe(200);
    const loggedInUser = SessionUserSchema.parse(loginResponse.body);
    expect(loggedInUser).toMatchObject({ name: 'Trần Thị Bình', role: 'PLAYER' });

    // Mo phong F5: goi lai /api/auth/me bang cookie da co, khong gui lai zaloId.
    const meResponse = await agent.get('/api/auth/me');
    expect(meResponse.status).toBe(200);
    const sessionUser = SessionUserSchema.parse(meResponse.body);
    expect(sessionUser).toEqual(loggedInUser);
  });

  it('từ chối đăng nhập với zaloId không tồn tại', async () => {
    const response = await request(httpServer)
      .post('/api/auth/login')
      .send({ zaloId: 'mock-khong-ton-tai' });

    expect(response.status).toBe(404);
    const error = ApiErrorSchema.parse(response.body);
    expect(error.code).toBe('NotFoundException');
  });

  it('từ chối đăng nhập thiếu zaloId (ZodValidationPipe)', async () => {
    const response = await request(httpServer).post('/api/auth/login').send({});

    expect(response.status).toBe(400);
    const error = ApiErrorSchema.parse(response.body);
    expect(error.message).toBe('Dữ liệu không hợp lệ.');
  });

  it('từ chối /api/auth/me khi chưa đăng nhập', async () => {
    const response = await request(httpServer).get('/api/auth/me');

    expect(response.status).toBe(401);
    const error = ApiErrorSchema.parse(response.body);
    expect(error.code).toBe('UnauthorizedException');
  });
});
