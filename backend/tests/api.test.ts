import request from 'supertest';
import { createApp } from '../src/app';
import { cleanDb, createTestMessage, prisma } from './setup/testHelpers';
import { v4 as uuidv4 } from 'uuid';

const app = createApp();

beforeEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Health Check', () => {
  it('GET /health returns 200 when DB is reachable', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
  });
});

describe('Message Creation - POST /api/v1/messages', () => {
  it('creates a message and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/messages')
      .set('x-tenant-id', 'tenant-a')
      .send({
        conversationId: 'conv-100',
        to: '+919876543210',
        text: 'Your order has shipped',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      tenantId: 'tenant-a',
      conversationId: 'conv-100',
      to: '+919876543210',
      text: 'Your order has shipped',
      status: 'QUEUED',
    });
    expect(res.body.data.id).toBeDefined();
  });

  it('returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/messages')
      .set('x-tenant-id', 'tenant-a')
      .send({ to: '+919876543210' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid phone number format', async () => {
    const res = await request(app)
      .post('/api/v1/messages')
      .set('x-tenant-id', 'tenant-a')
      .send({
        conversationId: 'conv-100',
        to: '9876543210',  // missing +country code
        text: 'Hello',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without x-tenant-id header', async () => {
    const res = await request(app)
      .post('/api/v1/messages')
      .send({ conversationId: 'conv-1', to: '+919876543210', text: 'Hello' });

    expect(res.status).toBe(401);
  });

  it('returns 400 if body tenantId does not match header', async () => {
    const res = await request(app)
      .post('/api/v1/messages')
      .set('x-tenant-id', 'tenant-a')
      .send({
        tenantId: 'tenant-b',
        conversationId: 'conv-100',
        to: '+919876543210',
        text: 'Hello',
      });

    expect(res.status).toBe(400);
  });
});

describe('Message Retrieval - GET /api/v1/messages/:messageId', () => {
  it('retrieves message by ID for correct tenant', async () => {
    const msg = await createTestMessage({ tenantId: 'tenant-a' });

    const res = await request(app)
      .get(`/api/v1/messages/${msg.id}`)
      .set('x-tenant-id', 'tenant-a');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(msg.id);
    expect(res.body.data.status).toBe('QUEUED');
  });

  it('returns 404 for message accessed by wrong tenant (isolation)', async () => {
    const msg = await createTestMessage({ tenantId: 'tenant-a' });

    const res = await request(app)
      .get(`/api/v1/messages/${msg.id}`)
      .set('x-tenant-id', 'tenant-b');

    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent message', async () => {
    const res = await request(app)
      .get(`/api/v1/messages/${uuidv4()}`)
      .set('x-tenant-id', 'tenant-a');

    expect(res.status).toBe(404);
  });
});

describe('Conversation Pagination - GET /api/v1/conversations/:id/messages', () => {
  it('returns messages in chronological order with cursor pagination', async () => {
    // Create 5 messages in a conversation
    for (let i = 0; i < 5; i++) {
      await createTestMessage({ conversationId: 'conv-pag', tenantId: 'tenant-a', text: `Message ${i}` });
      await new Promise((r) => setTimeout(r, 5)); // ensure distinct timestamps
    }

    // Get first page of 3
    const page1 = await request(app)
      .get('/api/v1/conversations/conv-pag/messages?limit=3')
      .set('x-tenant-id', 'tenant-a');

    expect(page1.status).toBe(200);
    expect(page1.body.data.length).toBe(3);
    expect(page1.body.pagination.hasMore).toBe(true);
    expect(page1.body.pagination.nextCursor).toBeTruthy();

    // Get second page
    const page2 = await request(app)
      .get(`/api/v1/conversations/conv-pag/messages?limit=3&cursor=${page1.body.pagination.nextCursor}`)
      .set('x-tenant-id', 'tenant-a');

    expect(page2.status).toBe(200);
    expect(page2.body.data.length).toBe(2);
    expect(page2.body.pagination.hasMore).toBe(false);

    // Ensure no overlap between pages
    const page1Ids = page1.body.data.map((m: { id: string }) => m.id);
    const page2Ids = page2.body.data.map((m: { id: string }) => m.id);
    const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
    expect(overlap.length).toBe(0);
  });
});

describe('Webhook Processing - POST /api/v1/webhooks/provider', () => {
  it('Scenario A: QUEUED -> SENT -> DELIVERED -> READ', async () => {
    const msg = await createTestMessage();

    // SENT
    const r1 = await request(app).post('/api/v1/webhooks/provider').send({
      eventId: 'evt-A-1',
      messageId: msg.id,
      status: 'SENT',
      occurredAt: new Date().toISOString(),
    });
    expect(r1.status).toBe(200);
    expect(r1.body.data.processingResult).toBe('APPLIED');

    // DELIVERED
    const r2 = await request(app).post('/api/v1/webhooks/provider').send({
      eventId: 'evt-A-2',
      messageId: msg.id,
      status: 'DELIVERED',
      occurredAt: new Date().toISOString(),
    });
    expect(r2.body.data.processingResult).toBe('APPLIED');

    // READ
    const r3 = await request(app).post('/api/v1/webhooks/provider').send({
      eventId: 'evt-A-3',
      messageId: msg.id,
      status: 'READ',
      occurredAt: new Date().toISOString(),
    });
    expect(r3.body.data.processingResult).toBe('APPLIED');

    // Verify final state
    const final = await request(app)
      .get(`/api/v1/messages/${msg.id}`)
      .set('x-tenant-id', 'tenant-a');
    expect(final.body.data.status).toBe('READ');
    expect(final.body.data.sentAt).toBeTruthy();
    expect(final.body.data.deliveredAt).toBeTruthy();
    expect(final.body.data.readAt).toBeTruthy();
  });

  it('Scenario B: out-of-order - READ then SENT should keep READ', async () => {
    const msg = await createTestMessage();

    const r1 = await request(app).post('/api/v1/webhooks/provider').send({
      eventId: 'evt-B-1',
      messageId: msg.id,
      status: 'READ',
      occurredAt: new Date().toISOString(),
    });
    expect(r1.body.data.processingResult).toBe('APPLIED');
    expect(r1.body.data.currentStatus).toBe('READ');

    const r2 = await request(app).post('/api/v1/webhooks/provider').send({
      eventId: 'evt-B-2',
      messageId: msg.id,
      status: 'SENT',
      occurredAt: new Date().toISOString(),
    });
    expect(r2.body.data.processingResult).toBe('IGNORED');

    // Status should still be READ
    const final = await request(app)
      .get(`/api/v1/messages/${msg.id}`)
      .set('x-tenant-id', 'tenant-a');
    expect(final.body.data.status).toBe('READ');
  });

  it('Scenario C: duplicate eventId should not apply business effects twice', async () => {
    const msg = await createTestMessage();

    const payload = {
      eventId: 'evt-C-dup',
      messageId: msg.id,
      status: 'SENT',
      occurredAt: new Date().toISOString(),
    };

    const r1 = await request(app).post('/api/v1/webhooks/provider').send(payload);
    expect(r1.body.data.processingResult).toBe('APPLIED');

    const r2 = await request(app).post('/api/v1/webhooks/provider').send(payload);
    expect(r2.body.data.processingResult).toBe('DUPLICATE');

    // Verify only one event record exists
    const events = await prisma.webhookEvent.findMany({
      where: { eventId: 'evt-C-dup' },
    });
    expect(events.length).toBe(1);
  });

  it('Scenario D: tenant isolation - cannot see other tenant messages', async () => {
    const msg = await createTestMessage({ tenantId: 'tenant-a' });

    // tenant-a can retrieve
    const r1 = await request(app)
      .get(`/api/v1/messages/${msg.id}`)
      .set('x-tenant-id', 'tenant-a');
    expect(r1.status).toBe(200);

    // tenant-b cannot retrieve
    const r2 = await request(app)
      .get(`/api/v1/messages/${msg.id}`)
      .set('x-tenant-id', 'tenant-b');
    expect(r2.status).toBe(404);
  });

  it('Scenario E: concurrent duplicate webhook events - only one accepted', async () => {
    const msg = await createTestMessage();

    const payload = {
      eventId: 'evt-E-concurrent',
      messageId: msg.id,
      status: 'SENT',
      occurredAt: new Date().toISOString(),
    };

    // Fire two requests simultaneously
    const [r1, r2] = await Promise.all([
      request(app).post('/api/v1/webhooks/provider').send(payload),
      request(app).post('/api/v1/webhooks/provider').send(payload),
    ]);

    // One must be APPLIED, the other DUPLICATE
    const results = [r1.body.data?.processingResult, r2.body.data?.processingResult];
    expect(results).toContain('APPLIED');
    expect(results).toContain('DUPLICATE');

    // Verify exactly one event in DB
    const events = await prisma.webhookEvent.findMany({
      where: { eventId: 'evt-E-concurrent' },
    });
    expect(events.length).toBe(1);
  });

  it('returns 404 for unknown messageId in webhook', async () => {
    const res = await request(app).post('/api/v1/webhooks/provider').send({
      eventId: 'evt-unknown',
      messageId: uuidv4(),
      status: 'SENT',
      occurredAt: new Date().toISOString(),
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid webhook status', async () => {
    const res = await request(app).post('/api/v1/webhooks/provider').send({
      eventId: 'evt-bad-status',
      messageId: uuidv4(),
      status: 'INVALID_STATUS',
      occurredAt: new Date().toISOString(),
    });
    expect(res.status).toBe(400);
  });

  it('ignores SENT after DELIVERED', async () => {
    const msg = await createTestMessage();

    await request(app).post('/api/v1/webhooks/provider').send({
      eventId: 'evt-oo-1',
      messageId: msg.id,
      status: 'DELIVERED',
      occurredAt: new Date().toISOString(),
    });

    const r2 = await request(app).post('/api/v1/webhooks/provider').send({
      eventId: 'evt-oo-2',
      messageId: msg.id,
      status: 'SENT',
      occurredAt: new Date().toISOString(),
    });

    expect(r2.body.data.processingResult).toBe('IGNORED');

    const final = await request(app)
      .get(`/api/v1/messages/${msg.id}`)
      .set('x-tenant-id', 'tenant-a');
    expect(final.body.data.status).toBe('DELIVERED');
  });

  it('ignores SENT after FAILED', async () => {
    const msg = await createTestMessage();

    await request(app).post('/api/v1/webhooks/provider').send({
      eventId: 'evt-fail-1',
      messageId: msg.id,
      status: 'FAILED',
      occurredAt: new Date().toISOString(),
    });

    const r2 = await request(app).post('/api/v1/webhooks/provider').send({
      eventId: 'evt-fail-2',
      messageId: msg.id,
      status: 'SENT',
      occurredAt: new Date().toISOString(),
    });

    expect(r2.body.data.processingResult).toBe('IGNORED');
  });

  it('allows QUEUED -> DELIVERED forward jump', async () => {
    const msg = await createTestMessage();

    const r = await request(app).post('/api/v1/webhooks/provider').send({
      eventId: 'evt-jump-1',
      messageId: msg.id,
      status: 'DELIVERED',
      occurredAt: new Date().toISOString(),
    });

    expect(r.body.data.processingResult).toBe('APPLIED');

    const final = await request(app)
      .get(`/api/v1/messages/${msg.id}`)
      .set('x-tenant-id', 'tenant-a');
    expect(final.body.data.status).toBe('DELIVERED');
    // sentAt should also be populated on the forward jump
    expect(final.body.data.sentAt).toBeTruthy();
  });
});

describe('Event Logs - GET /api/v1/webhooks/events', () => {
  it('returns webhook events for the tenant', async () => {
    const msg = await createTestMessage({ tenantId: 'tenant-a' });

    await request(app).post('/api/v1/webhooks/provider').send({
      eventId: 'evt-log-1',
      messageId: msg.id,
      status: 'SENT',
      occurredAt: new Date().toISOString(),
    });

    const res = await request(app)
      .get('/api/v1/webhooks/events')
      .set('x-tenant-id', 'tenant-a');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].eventId).toBe('evt-log-1');
  });

  it('filters by processingResult', async () => {
    const msg = await createTestMessage({ tenantId: 'tenant-a' });

    await request(app).post('/api/v1/webhooks/provider').send({
      eventId: 'evt-log-applied',
      messageId: msg.id,
      status: 'SENT',
      occurredAt: new Date().toISOString(),
    });

    await request(app).post('/api/v1/webhooks/provider').send({
      eventId: 'evt-log-ignored',
      messageId: msg.id,
      status: 'QUEUED', // invalid status for webhook - will be rejected by validator
      occurredAt: new Date().toISOString(),
    });

    const res = await request(app)
      .get('/api/v1/webhooks/events?processingResult=APPLIED')
      .set('x-tenant-id', 'tenant-a');

    expect(res.status).toBe(200);
    expect(res.body.data.every((e: { processingResult: string }) => e.processingResult === 'APPLIED')).toBe(true);
  });
});
