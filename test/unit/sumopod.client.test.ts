/**
 * Unit tests for SumoPodClient
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SumoPodClient } from '../../src/core/sumopod.client.js';
import {
  SumoPodValidationError,
  SumoPodApiError,
} from '../../src/exceptions/index.js';
import type { CreatePaymentDto } from '../../src/dto/payment.dto.js';
import { createMockFetch } from '../__mocks__/fetch-mock.js';

const VALID_PAYMENT: CreatePaymentDto = {
  order_id: 'ORD-001',
  amount: 100_000,
  currency: 'IDR',
};

describe('SumoPodClient', () => {

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
      const mock = createMockFetch([
        {
          status: 200,
          body: {
            payment_id: '12345678-1234-1234-1234-1234567890ab',
            order_id: 'ORD-001',
            amount: 100_000,
            fee: 1000,
            net_amount: 99000,
            payment_link_url: 'https://pay.sumopod.com/link',
            status: 'pending',
            expires_at: '2026-07-12T00:00:00Z',
          }
        }
      ]);

      const client = new SumoPodClient({
        apiKey: 'test_dummy_secret_do_not_use_in_production',
        disableRateLimit: true,
        fetchImpl: mock.fetch,
      });

      const result = await client.createPayment(VALID_PAYMENT);

      expect(result.order_id).toBe('ORD-001');
      expect(result.amount).toBe(100_000);
      expect(typeof result.fee).toBe('number');
      expect(typeof result.net_amount).toBe('number');
      expect(result.payment_link_url).toContain('https://');
      expect(result.status).toBe('pending');
      expect(typeof result.expires_at).toBe('string');
      expect(result.payment_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(mock.calls.length).toBe(1);
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
      const mock = createMockFetch([
        { status: 401, body: { message: 'Unauthorized' } },
        { status: 401, body: { message: 'Unauthorized' } }
      ]);
      const client = new SumoPodClient({
        apiKey: 'invalid_api_key',
        fetchImpl: mock.fetch,
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
      const mock = createMockFetch([
        { status: 500, body: { message: 'Internal Server Error' } },
        { status: 502, body: { message: 'Bad Gateway' } },
        { status: 200, body: { status: 'pending', order_id: 'ORD-001' } },
      ]);
      const client = new SumoPodClient({
        apiKey: 'retry_test_key',
        maxRetries: 3,
        fetchImpl: mock.fetch,
      });

      const result = await client.createPayment(VALID_PAYMENT);

      expect(result.status).toBe('pending');
      expect(result.order_id).toBe('ORD-001');
      expect(mock.calls.length).toBe(3);
    });

    it('should NOT retry on 400 (client error)', async () => {
      const mock = createMockFetch([
        { status: 400, body: { message: 'Bad Request' } }
      ]);
      const client = new SumoPodClient({
        apiKey: 'bad_request_key',
        maxRetries: 3,
        fetchImpl: mock.fetch,
      });

      await expect(
        client.createPayment(VALID_PAYMENT),
      ).rejects.toThrow(SumoPodApiError);

      expect(mock.calls.length).toBe(1);
    });

    it('should default expires_in_hours to 24 when not provided', async () => {
      const mock = createMockFetch([
        { status: 200, body: { status: 'pending', order_id: 'ORD-DEFAULT' } }
      ]);
      const client = new SumoPodClient({
        apiKey: 'test_dummy_secret_do_not_use_in_production',
        disableRateLimit: true,
        fetchImpl: mock.fetch,
      });

      const result = await client.createPayment({
        order_id: 'ORD-DEFAULT',
        amount: 75_000,
        currency: 'IDR',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('pending');
      
      const parsedBody = JSON.parse(mock.calls[0].body as string);
      expect(parsedBody.expires_in_hours).toBe(24);
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
      const mock = createMockFetch(Array(60).fill({ status: 200, body: { status: 'pending' } }));
      const client = new SumoPodClient({
        apiKey: 'test_dummy_secret_do_not_use_in_production',
        disableRateLimit: false,
        fetchImpl: mock.fetch,
      });

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
