/**
 * Integration tests for Express webhook middleware.
 *
 * Uses supertest to make real HTTP requests to an Express app.
 */
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import { sumopodWebhookMiddleware } from '../../src/webhook/express/webhook.middleware.js';

// Dummy secret for testing (NOT a real secret)
const TEST_SECRET = 'whsec_dGVzdHNlY3JldA==';
const TEST_SECRET_BYTES = Buffer.from('dGVzdHNlY3JldA==', 'base64');

const WEBHOOK_PAYLOAD = {
  event_type: 'payment.completed',
  data: {
    payment_id: '550e8400-e29b-41d4-a716-446655440000',
    order_id: 'ORD-001',
    amount: 100000,
    fee: 1500,
    net_amount: 98500,
    status: 'completed',
    payment_method: 'qris',
    completed_at: '2026-07-11T02:30:00.000Z',
  },
};

function createSignedHeaders(
  body: string,
): Record<string, string> {
  const svixId = 'msg_test_integration';
  const svixTimestamp = Math.floor(Date.now() / 1000).toString();
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const sig = createHmac('sha256', TEST_SECRET_BYTES)
    .update(signedContent, 'utf8')
    .digest('base64');

  return {
    'svix-id': svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': `v1,${sig}`,
    'content-type': 'application/json',
  };
}

function createApp() {
  const app = express();

  app.post(
    '/webhook',
    express.raw({ type: 'application/json' }),
    sumopodWebhookMiddleware({
      webhookSecret: TEST_SECRET,
      verificationMethod: 'signature',
    }),
    (req, res) => {
      res.status(200).json({
        received: true,
        event: req.sumopodEvent,
      });
    },
  );

  return app;
}

describe('Express Webhook Middleware', () => {
  const app = createApp();

  it('should return 200 and populate req.sumopodEvent with valid signature', async () => {
    const bodyStr = JSON.stringify(WEBHOOK_PAYLOAD);
    const headers = createSignedHeaders(bodyStr);

    const response = await request(app)
      .post('/webhook')
      .set('svix-id', headers['svix-id'])
      .set('svix-timestamp', headers['svix-timestamp'])
      .set('svix-signature', headers['svix-signature'])
      .type('application/json')
      .send(bodyStr)
      .expect(200);

    expect(response.body.received).toBe(true);
    expect(response.body.event).toBeDefined();
    expect(response.body.event.event_type).toBe('payment.completed');
    expect(response.body.event.data.payment_id).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
    expect(response.body.event.data.order_id).toBe('ORD-001');
  });

  it('should return 401 with invalid signature', async () => {
    const bodyStr = JSON.stringify(WEBHOOK_PAYLOAD);
    const headers = createSignedHeaders(bodyStr);

    // Tamper with the signature
    headers['svix-signature'] = 'v1,invalidsignaturevalue';

    const response = await request(app)
      .post('/webhook')
      .set('svix-id', headers['svix-id'])
      .set('svix-timestamp', headers['svix-timestamp'])
      .set('svix-signature', headers['svix-signature'])
      .type('application/json')
      .send(bodyStr)
      .expect(401);

    expect(response.body.error).toBe('Invalid webhook signature');
  });

  it('should return 401 when signature headers are missing entirely', async () => {
    const bodyStr = JSON.stringify(WEBHOOK_PAYLOAD);

    const response = await request(app)
      .post('/webhook')
      .type('application/json')
      .send(bodyStr)
      .expect(401);

    expect(response.body.error).toContain('Missing required webhook signature headers');
  });

  it('should return 500 when webhook secret is not configured', async () => {
    const badApp = express();
    badApp.post(
      '/webhook',
      express.raw({ type: 'application/json' }),
      sumopodWebhookMiddleware({ verificationMethod: 'signature' }),
      (req, res) => res.sendStatus(200),
    );

    const response = await request(badApp)
      .post('/webhook')
      .type('application/json')
      .send('{}')
      .expect(500);

    expect(response.body.error).toBe('Webhook secret not configured');
  });
});

describe('Express Webhook Middleware (token mode)', () => {
  const DUMMY_TOKEN = 'whtok_test_express_token';

  function createTokenApp() {
    const app = express();
    app.post(
      '/webhook',
      express.raw({ type: 'application/json' }),
      sumopodWebhookMiddleware({
        webhookToken: DUMMY_TOKEN,
        verificationMethod: 'token',
      }),
      (req, res) => {
        res.status(200).json({ received: true, event: req.sumopodEvent });
      },
    );
    return app;
  }

  const tokenApp = createTokenApp();

  it('should return 200 with valid token', async () => {
    const bodyStr = JSON.stringify(WEBHOOK_PAYLOAD);

    const response = await request(tokenApp)
      .post('/webhook')
      .set('x-webhook-token', DUMMY_TOKEN)
      .type('application/json')
      .send(bodyStr)
      .expect(200);

    expect(response.body.received).toBe(true);
    expect(response.body.event.event_type).toBe('payment.completed');
  });

  it('should return 401 with invalid token', async () => {
    const bodyStr = JSON.stringify(WEBHOOK_PAYLOAD);

    const response = await request(tokenApp)
      .post('/webhook')
      .set('x-webhook-token', 'whtok_wrong')
      .type('application/json')
      .send(bodyStr)
      .expect(401);

    expect(response.body.error).toBe('Invalid webhook signature');
  });

  it('should return 401 when X-Webhook-Token header is missing', async () => {
    const bodyStr = JSON.stringify(WEBHOOK_PAYLOAD);

    const response = await request(tokenApp)
      .post('/webhook')
      .type('application/json')
      .send(bodyStr)
      .expect(401);

    expect(response.body.error).toContain('Missing required webhook header');
  });

  it('should return 500 when webhook token is not configured', async () => {
    const badApp = express();
    badApp.post(
      '/webhook',
      express.raw({ type: 'application/json' }),
      sumopodWebhookMiddleware({ verificationMethod: 'token' }),
      (req, res) => res.sendStatus(200),
    );

    const response = await request(badApp)
      .post('/webhook')
      .type('application/json')
      .send('{}')
      .expect(500);

    expect(response.body.error).toBe('Webhook token not configured');
  });
});

/*
Expected output (npm run test):

 ✓ test/integration/express.middleware.test.ts (6 tests) 120ms
   ✓ Express Webhook Middleware > should return 200 and populate req.sumopodEvent with valid signature
   ✓ Express Webhook Middleware > should return 401 with invalid signature
   ✓ Express Webhook Middleware > should return 401 when signature headers are missing entirely
   ✓ Express Webhook Middleware (token mode) > should return 200 with valid token
   ✓ Express Webhook Middleware (token mode) > should return 401 with invalid token
   ✓ Express Webhook Middleware (token mode) > should return 401 when X-Webhook-Token header is missing
*/
