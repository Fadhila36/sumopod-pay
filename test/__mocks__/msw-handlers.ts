/**
 * MSW (Mock Service Worker) handlers for simulating the SumoPod API.
 *
 * These handlers are used in tests to avoid hitting the real API.
 * They simulate real API responses including error cases.
 */
import { http, HttpResponse } from 'msw';

const BASE_URL = 'https://api-pay-sandbox.sumopod.com/api/v1';

// Track call counts for retry testing
let createPaymentCallCount = 0;

export function resetCallCount(): void {
  createPaymentCallCount = 0;
}

export function getCallCount(): number {
  return createPaymentCallCount;
}

export const handlers = [
  // POST /payments — successful response
  http.post(`${BASE_URL}/payments`, async ({ request }) => {
    createPaymentCallCount++;

    const apiKey = request.headers.get('X-Api-Key');

    // Simulate 401 for invalid API key
    if (apiKey === 'invalid_api_key') {
      return HttpResponse.json(
        { error: 'Unauthorized', message: 'Invalid API key' },
        { status: 401 },
      );
    }

    // Simulate 500 that eventually succeeds (for retry testing)
    if (apiKey === 'retry_test_key') {
      if (createPaymentCallCount < 3) {
        return HttpResponse.json(
          { error: 'Internal Server Error' },
          { status: 500 },
        );
      }
      // 3rd attempt succeeds
    }

    // Simulate 400 for bad request (should not retry)
    if (apiKey === 'bad_request_key') {
      return HttpResponse.json(
        {
          error: 'Bad Request',
          message: 'Invalid payment parameters',
        },
        { status: 400 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;

    return HttpResponse.json({
      payment_id: '550e8400-e29b-41d4-a716-446655440000',
      order_id: body['order_id'],
      amount: body['amount'],
      fee: 1500,
      net_amount: (body['amount'] as number) - 1500,
      payment_link_url: 'https://pay.sumopod.com/link/abc123',
      status: 'pending',
      expires_at: '2026-07-12T02:30:00.000Z',
    });
  }),
];
