/**
 * Integration tests for NestJS SumoPodWebhookGuard.
 *
 * Uses mocked ExecutionContext to simulate NestJS request handling.
 */
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { SumoPodWebhookGuard } from '../../src/webhook/nest/webhook.guard.js';
import { SUMOPOD_OPTIONS } from '../../src/webhook/nest/sumopod.constants.js';
import type { SumoPodModuleOptions } from '../../src/interfaces/config.interface.js';

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

function createMockExecutionContext(
  body: string | Buffer,
  headers: Record<string, string>,
) {
  const mockRequest = {
    body: typeof body === 'string' ? Buffer.from(body) : body,
    headers,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getClass: () => ({}),
    getHandler: () => ({}),
    getArgs: () => [mockRequest],
    getArgByIndex: () => mockRequest,
    switchToRpc: () => ({} as any),
    switchToWs: () => ({} as any),
    getType: () => 'http' as const,
  } as any;
}

function getTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

function computeSignature(body: string, ts: string): string {
  const svixId = 'msg_nest_test';
  const signedContent = `${svixId}.${ts}.${body}`;
  return createHmac('sha256', TEST_SECRET_BYTES)
    .update(signedContent, 'utf8')
    .digest('base64');
}

describe('SumoPodWebhookGuard', () => {
  const options: SumoPodModuleOptions = {
    apiKey: 'test_key_1234',
    webhookSecret: TEST_SECRET,
  };

  // Manually instantiate guard (bypassing DI for unit test)
  const guard = new SumoPodWebhookGuard(options);

  it('should allow request with valid signature', () => {
    const bodyStr = JSON.stringify(WEBHOOK_PAYLOAD);
    const ts = getTimestamp();
    const sig = computeSignature(bodyStr, ts);

    const context = createMockExecutionContext(bodyStr, {
      'svix-id': 'msg_nest_test',
      'svix-timestamp': ts,
      'svix-signature': `v1,${sig}`,
    });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException with invalid signature', () => {
    const bodyStr = JSON.stringify(WEBHOOK_PAYLOAD);
    const ts = getTimestamp();

    const context = createMockExecutionContext(bodyStr, {
      'svix-id': 'msg_nest_test',
      'svix-timestamp': ts,
      'svix-signature': 'v1,invalidsignature',
    });

    expect(() => guard.canActivate(context)).toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when signature headers are missing', () => {
    const bodyStr = JSON.stringify(WEBHOOK_PAYLOAD);

    const context = createMockExecutionContext(bodyStr, {});

    expect(() => guard.canActivate(context)).toThrow(
      UnauthorizedException,
    );
  });

  it('should verify using token method when only webhookToken is configured', () => {
    const tokenOptions: SumoPodModuleOptions = {
      apiKey: 'test_key_1234',
      webhookToken: 'whtok_test_token_xyz',
    };
    const tokenGuard = new SumoPodWebhookGuard(tokenOptions);

    const bodyStr = JSON.stringify(WEBHOOK_PAYLOAD);

    // Valid token
    const validContext = createMockExecutionContext(bodyStr, {
      'x-webhook-token': 'whtok_test_token_xyz',
    });
    expect(tokenGuard.canActivate(validContext)).toBe(true);

    // Invalid token
    const invalidContext = createMockExecutionContext(bodyStr, {
      'x-webhook-token': 'whtok_wrong_token',
    });
    expect(() => tokenGuard.canActivate(invalidContext)).toThrow(
      UnauthorizedException,
    );

    // Missing token header
    const missingTokenContext = createMockExecutionContext(bodyStr, {});
    expect(() => tokenGuard.canActivate(missingTokenContext)).toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when no verification method is configured', () => {
    const emptyGuard = new SumoPodWebhookGuard({ apiKey: 'test' });
    const bodyStr = JSON.stringify(WEBHOOK_PAYLOAD);
    const context = createMockExecutionContext(bodyStr, {});
    
    expect(() => emptyGuard.canActivate(context)).toThrow(
      UnauthorizedException,
    );
  });
});

/*
Expected output (npm run test):

 ✓ test/integration/nest.guard.test.ts (4 tests) 35ms
   ✓ SumoPodWebhookGuard > should allow request with valid signature
   ✓ SumoPodWebhookGuard > should throw UnauthorizedException with invalid signature
   ✓ SumoPodWebhookGuard > should throw UnauthorizedException when signature headers are missing
   ✓ SumoPodWebhookGuard > should verify using token method when only webhookToken is configured
*/
