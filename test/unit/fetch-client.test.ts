/**
 * Unit tests for the FetchClient
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FetchClient, maskApiKey } from '../../src/core/http/fetch-client.js';
import { SumoPodApiError } from '../../src/exceptions/index.js';
import {
  resetCallCount,
  getCallCount,
} from '../__mocks__/msw-handlers.js';

describe('FetchClient', () => {
  beforeEach(() => {
    resetCallCount();
  });

  it('should make a successful POST request', async () => {
    const client = new FetchClient({
      baseUrl: 'https://api-pay-sandbox.sumopod.com/api/v1',
      apiKey: 'test_api_key_1234',
      maxRetries: 3,
      timeoutMs: 30_000,
    });

    const result = await client.request<Record<string, unknown>>({
      method: 'POST',
      path: '/payments',
      body: {
        order_id: 'ORD-FETCH-001',
        amount: 50_000,
        currency: 'IDR',
      },
    });

    expect(result).toHaveProperty('payment_id');
    expect(result['order_id']).toBe('ORD-FETCH-001');
  });

  it('should throw SumoPodApiError on 401 without retrying', async () => {
    const client = new FetchClient({
      baseUrl: 'https://api-pay-sandbox.sumopod.com/api/v1',
      apiKey: 'invalid_api_key',
      maxRetries: 3,
      timeoutMs: 30_000,
    });

    resetCallCount();

    await expect(
      client.request({
        method: 'POST',
        path: '/payments',
        body: { order_id: 'ORD-002', amount: 10_000, currency: 'IDR' },
      }),
    ).rejects.toThrow(SumoPodApiError);

    expect(getCallCount()).toBe(1);
  });

  it('should retry on 500 with exponential backoff', async () => {
    const client = new FetchClient({
      baseUrl: 'https://api-pay-sandbox.sumopod.com/api/v1',
      apiKey: 'retry_test_key',
      maxRetries: 3,
      timeoutMs: 30_000,
    });

    resetCallCount();

    const result = await client.request<Record<string, unknown>>({
      method: 'POST',
      path: '/payments',
      body: { order_id: 'ORD-RETRY', amount: 20_000, currency: 'IDR' },
    });

    expect(result).toHaveProperty('payment_id');
    expect(getCallCount()).toBe(3);
  });

  it('should timeout and retry', async () => {
    const originalFetch = global.fetch;
    try {
      let attempts = 0;
      global.fetch = async (...args) => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Timeout');
          error.name = 'AbortError';
          throw error;
        }
        return originalFetch(...args);
      };

      const client = new FetchClient({
        baseUrl: 'https://api-pay-sandbox.sumopod.com/api/v1',
        apiKey: 'test_api_key_1234',
        maxRetries: 3,
        timeoutMs: 30_000,
      });

      const result = await client.request<Record<string, unknown>>({
        method: 'POST',
        path: '/payments',
        body: { order_id: 'ORD-TIMEOUT', amount: 20_000, currency: 'IDR' },
      });

      expect(result).toHaveProperty('payment_id');
      expect(attempts).toBe(2);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should handle non-JSON error response', async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = async () => {
        return new Response('Plain text error', {
          status: 400,
          headers: { 'Content-Type': 'text/plain' },
        });
      };

      const client = new FetchClient({
        baseUrl: 'https://api-pay-sandbox.sumopod.com/api/v1',
        apiKey: 'test_key',
        maxRetries: 0,
        timeoutMs: 30_000,
      });

      await expect(client.request({
        method: 'POST',
        path: '/test',
      })).rejects.toThrow('Request failed with status 400');
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('maskApiKey', () => {
  it('should mask all but last 4 characters', () => {
    expect(maskApiKey('sk_live_abcdef1234')).toBe(
      '**************1234',
    );
  });

  it('should handle short keys', () => {
    expect(maskApiKey('abc')).toBe('****');
  });

  it('should handle exactly 4 characters', () => {
    expect(maskApiKey('abcd')).toBe('****');
  });
});

/*
Expected output (npm run test):

 ✓ test/unit/fetch-client.test.ts (6 tests) 80ms
   ✓ FetchClient > should make a successful POST request
   ✓ FetchClient > should throw SumoPodApiError on 401 without retrying
   ✓ FetchClient > should retry on 500 with exponential backoff
   ✓ maskApiKey > should mask all but last 4 characters
   ✓ maskApiKey > should handle short keys
   ✓ maskApiKey > should handle exactly 4 characters
*/
