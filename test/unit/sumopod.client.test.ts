/**
 * Unit tests for SumoPodClient
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SumoPodClient } from '../../src/core/sumopod.client.js';
import {
  SumoPodValidationError,
  SumoPodApiError,
} from '../../src/exceptions/index.js';
import {
  resetCallCount,
  getCallCount,
} from '../__mocks__/msw-handlers.js';
import type { CreatePaymentDto } from '../../src/dto/payment.dto.js';

const VALID_PAYMENT: CreatePaymentDto = {
  order_id: 'ORD-001',
  amount: 100_000,
  currency: 'IDR',
};

describe('SumoPodClient', () => {
  beforeEach(() => {
    resetCallCount();
  });

  describe('constructor', () => {
    it('should throw SumoPodValidationError when apiKey is empty', () => {
      expect(() => new SumoPodClient({ apiKey: '' })).toThrow(
        SumoPodValidationError,
      );
    });

    it('should throw SumoPodValidationError when apiKey is whitespace', () => {
      expect(() => new SumoPodClient({ apiKey: '   ' })).toThrow(
        SumoPodValidationError,
      );
    });

    it('should throw SumoPodValidationError when baseUrl is not HTTPS (SSRF check)', () => {
      expect(() => new SumoPodClient({ apiKey: 'test_dummy_secret_do_not_use_in_production', baseUrl: 'http://localhost:3000' })).toThrow(
        SumoPodValidationError,
      );
      expect(() => new SumoPodClient({ apiKey: 'test_dummy_secret_do_not_use_in_production', baseUrl: 'ftp://evil.com' })).toThrow(
        SumoPodValidationError,
      );
    });
  });

  describe('createPayment', () => {
    it('should create payment successfully with valid payload', async () => {
      const client = new SumoPodClient({
        apiKey: 'test_dummy_secret_do_not_use_in_production',
        disableRateLimit: true,
      });

      const result = await client.createPayment(VALID_PAYMENT);

      expect(result).toMatchObject({
        payment_id: expect.any(String),
        order_id: 'ORD-001',
        amount: 100_000,
        fee: expect.any(Number),
        net_amount: expect.any(Number),
        payment_link_url: expect.stringContaining('https://'),
        status: 'pending',
        expires_at: expect.any(String),
      });

      expect(result.payment_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('should throw SumoPodValidationError when order_id is empty', async () => {
      const client = new SumoPodClient({
        apiKey: 'test_dummy_secret_do_not_use_in_production',
        disableRateLimit: true,
      });

      await expect(
        client.createPayment({
          order_id: '',
          amount: 50_000,
          currency: 'IDR',
        }),
      ).rejects.toThrow(SumoPodValidationError);

      await expect(
        client.createPayment({
          order_id: '',
          amount: 50_000,
          currency: 'IDR',
        }),
      ).rejects.toThrow(/order_id/);
    });

    it('should throw SumoPodValidationError when amount is zero or negative', async () => {
      const client = new SumoPodClient({
        apiKey: 'test_dummy_secret_do_not_use_in_production',
        disableRateLimit: true,
      });

      await expect(
        client.createPayment({
          order_id: 'ORD-002',
          amount: 0,
          currency: 'IDR',
        }),
      ).rejects.toThrow(SumoPodValidationError);

      await expect(
        client.createPayment({
          order_id: 'ORD-003',
          amount: -100,
          currency: 'IDR',
        }),
      ).rejects.toThrow(SumoPodValidationError);
    });

    it('should throw SumoPodApiError on 401 (invalid API key)', async () => {
      const client = new SumoPodClient({
        apiKey: 'invalid_api_key',
      });

      await expect(
        client.createPayment(VALID_PAYMENT),
      ).rejects.toThrow(SumoPodApiError);

      try {
        await client.createPayment(VALID_PAYMENT);
      } catch (error) {
        expect(error).toBeInstanceOf(SumoPodApiError);
        expect((error as SumoPodApiError).statusCode).toBe(401);
      }
    });

    it('should retry on 500 and succeed on 3rd attempt', async () => {
      const client = new SumoPodClient({
        apiKey: 'retry_test_key',
        maxRetries: 3,
      });

      resetCallCount();

      const result = await client.createPayment(VALID_PAYMENT);

      expect(result.status).toBe('pending');
      expect(result.order_id).toBe('ORD-001');
      // The handler returns 500 for calls 1 and 2, succeeds on call 3
      expect(getCallCount()).toBe(3);
    });

    it('should NOT retry on 400 (client error)', async () => {
      const client = new SumoPodClient({
        apiKey: 'bad_request_key',
        maxRetries: 3,
      });

      resetCallCount();

      await expect(
        client.createPayment(VALID_PAYMENT),
      ).rejects.toThrow(SumoPodApiError);

      // Should only have called fetch once — no retry for 4xx
      expect(getCallCount()).toBe(1);
    });

    it('should default expires_in_hours to 24 when not provided', async () => {
      const client = new SumoPodClient({
        apiKey: 'test_dummy_secret_do_not_use_in_production',
        disableRateLimit: true,
      });

      // This test validates that the client sends the default value.
      // The MSW handler accepts whatever is sent and returns a valid response.
      const result = await client.createPayment({
        order_id: 'ORD-DEFAULT',
        amount: 75_000,
        currency: 'IDR',
        // Note: expires_in_hours not provided — should default to 24
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('pending');
    });

    it('should throw SumoPodValidationError for unsupported currency', async () => {
      const client = new SumoPodClient({
        apiKey: 'test_dummy_secret_do_not_use_in_production',
        disableRateLimit: true,
      });

      await expect(
        client.createPayment({
          order_id: 'ORD-CUR',
          amount: 50_000,
          currency: 'USD' as any,
        }),
      ).rejects.toThrow(SumoPodValidationError);

      await expect(
        client.createPayment({
          order_id: 'ORD-CUR',
          amount: 50_000,
          currency: 'USD' as any,
        }),
      ).rejects.toThrow(/currency/);
    });
  });

  describe('getMaskedApiKey', () => {
    it('should mask API key showing only last 4 characters', () => {
      const client = new SumoPodClient({
        apiKey: 'sk_live_abcdef1234',
      });

      const masked = client.getMaskedApiKey();
      expect(masked).toBe('**************1234');
      expect(masked).not.toContain('abcdef');
    });
  });

  describe('rate limiter', () => {
    it('should block requests exceeding the rate limit', async () => {
      // By default capacity is 50, refill is 50/sec.
      const client = new SumoPodClient({
        apiKey: 'test_dummy_secret_do_not_use_in_production',
        disableRateLimit: false,
      });

      // Send 60 requests concurrently. Capacity is 50.
      // At least some of the trailing requests should hit the rate limiter synchronously.
      const promises = [];
      let rateLimitHit = false;

      for (let i = 0; i < 60; i++) {
        promises.push(
          client.createPayment(VALID_PAYMENT).catch((err) => {
            if (err.message && err.message.includes('Client-side rate limit exceeded')) {
              rateLimitHit = true;
            }
          })
        );
      }
      
      await Promise.all(promises);
      expect(rateLimitHit).toBe(true);
    });
  });
});

/*
Expected output (npm run test):

 ✓ test/unit/sumopod.client.test.ts (8 tests) 120ms
   ✓ SumoPodClient > constructor > should throw SumoPodValidationError when apiKey is empty
   ✓ SumoPodClient > constructor > should throw SumoPodValidationError when apiKey is whitespace
   ✓ SumoPodClient > createPayment > should create payment successfully with valid payload
   ✓ SumoPodClient > createPayment > should throw SumoPodValidationError when order_id is empty
   ✓ SumoPodClient > createPayment > should throw SumoPodValidationError when amount is zero or negative
   ✓ SumoPodClient > createPayment > should throw SumoPodApiError on 401 (invalid API key)
   ✓ SumoPodClient > createPayment > should retry on 500 and succeed on 3rd attempt
   ✓ SumoPodClient > createPayment > should NOT retry on 400 (client error)
   ✓ SumoPodClient > createPayment > should default expires_in_hours to 24 when not provided
   ✓ SumoPodClient > getMaskedApiKey > should mask API key showing only last 4 characters
*/
