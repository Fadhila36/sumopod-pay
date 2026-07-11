/**
 * Unit tests for the FetchClient
 */
import { describe, it, expect } from 'vitest';
import { FetchClient, maskApiKey } from '../../src/core/http/fetch-client.js';
import { SumoPodApiError } from '../../src/exceptions/index.js';
import { createMockFetch } from '../__mocks__/fetch-mock.js';

describe('FetchClient', () => {

  it('should mask API key correctly', () => {
    expect(maskApiKey('sk_live_1234567890')).toBe('**************7890');
    expect(maskApiKey('abcd')).toBe('****');
  });

  it('should make a successful POST request', async () => {
    const mock = createMockFetch([
      {
        status: 200,
        body: { payment_id: 'pay_123', order_id: 'ORD-FETCH-001' },
      }
    ]);

    const client = new FetchClient({
      baseUrl: 'https://api-pay-sandbox.sumopod.com/api/v1',
      apiKey: 'test_api_key_1234',
      maxRetries: 3,
      timeoutMs: 30_000,
      fetchImpl: mock.fetch,
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
    expect(mock.calls.length).toBe(1);
    expect(mock.calls[0].headers).toHaveProperty('X-Api-Key', 'test_api_key_1234');
  });

  it('should throw SumoPodApiError on 401 without retrying', async () => {
    const mock = createMockFetch([
      {
        status: 401,
        body: { message: 'Unauthorized' },
      }
    ]);

    const client = new FetchClient({
      baseUrl: 'https://api-pay-sandbox.sumopod.com/api/v1',
      apiKey: 'invalid_api_key',
      maxRetries: 3,
      timeoutMs: 30_000,
      fetchImpl: mock.fetch,
    });

    await expect(
      client.request({
        method: 'POST',
        path: '/payments',
        body: { order_id: 'ORD-002', amount: 10_000, currency: 'IDR' },
      }),
    ).rejects.toThrow(SumoPodApiError);

    expect(mock.calls.length).toBe(1);
  });

  it('should retry on 500 with exponential backoff', async () => {
    const mock = createMockFetch([
      { status: 500, body: { message: 'Server Error 1' } },
      { status: 503, body: { message: 'Service Unavailable' } },
      { status: 200, body: { payment_id: 'pay_retry', order_id: 'ORD-RETRY' } },
    ]);

    const client = new FetchClient({
      baseUrl: 'https://api-pay-sandbox.sumopod.com/api/v1',
      apiKey: 'retry_test_key',
      maxRetries: 3,
      timeoutMs: 30_000,
      fetchImpl: mock.fetch,
    });

    const result = await client.request<Record<string, unknown>>({
      method: 'POST',
      path: '/payments',
      body: { order_id: 'ORD-RETRY', amount: 20_000, currency: 'IDR' },
    });

    expect(result).toHaveProperty('payment_id');
    expect(mock.calls.length).toBe(3);
  });

  it('should timeout and retry', async () => {
    let attempts = 0;
    const mockFetch = async (input: any, init: any): Promise<Response> => {
      attempts++;
      if (attempts < 2) {
        // simulate abort timeout natively
        return new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('Timeout');
            error.name = 'AbortError';
            reject(error);
          }, 10);
        });
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ payment_id: 'pay_timeout' }),
      } as Response;
    };

    const client = new FetchClient({
      baseUrl: 'https://api-pay-sandbox.sumopod.com/api/v1',
      apiKey: 'test_api_key_1234',
      maxRetries: 3,
      timeoutMs: 30_000,
      fetchImpl: mockFetch,
    });

    const result = await client.request<Record<string, unknown>>({
      method: 'POST',
      path: '/payments',
      body: { order_id: 'ORD-TIMEOUT' },
    });

    expect(result).toHaveProperty('payment_id');
    expect(attempts).toBe(2);
  });
});
