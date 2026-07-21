import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    return request(server).get('/').expect(200).expect('Hello World!');
  });

  it('/transactions (GET) rejects unauthenticated requests', () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    return request(server).get('/transactions').expect(401);
  });

  it('/transactions/sms/import rejects unauthenticated requests', () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    return request(server)
      .post('/transactions/sms/import')
      .send({ messages: [] })
      .expect(401);
  });

  it('dashboard endpoints reject unauthenticated requests', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    await Promise.all([
      request(server).get('/dashboard/home').expect(401),
      request(server).get('/dashboard/summary').expect(401),
    ]);
  });

  afterEach(async () => {
    await app.close();
  });
});
