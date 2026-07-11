import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock zod BEFORE importing the client so dynamic import fails
vi.mock('zod', () => {
  throw new Error('Cannot find module zod');
});

import { SumoPodClient } from '../../src/core/sumopod.client.js';
import { SumoPodValidationError } from '../../src/exceptions/index.js';

describe('SumoPodClient - Fallback Validation', () => {
  let client: SumoPodClient;

  beforeEach(() => {
    client = new SumoPodClient({
      apiKey: 'test_dummy_secret_do_not_use_in_production',
      disableRateLimit: true,
    });
  });

  it('should use manual fallback validation when zod is not available', async () => {
    // Valid payload should not throw
    const validPromise = client.createPayment({
      order_id: 'ORD-123',
      amount: 1000,
      currency: 'IDR',
    }).catch(() => null);
    
    // order_id checks
    await expect(client.createPayment({ order_id: '', amount: 1000, currency: 'IDR' }))
      .rejects.toThrow(SumoPodValidationError);
    await expect(client.createPayment({ order_id: 'invalid!@#', amount: 1000, currency: 'IDR' }))
      .rejects.toThrow(SumoPodValidationError);
    
    // amount checks
    await expect(client.createPayment({ order_id: 'ORD', amount: -100, currency: 'IDR' }))
      .rejects.toThrow(SumoPodValidationError);
    await expect(client.createPayment({ order_id: 'ORD', amount: 10.5, currency: 'IDR' }))
      .rejects.toThrow(SumoPodValidationError);
      
    // currency checks
    await expect(client.createPayment({ order_id: 'ORD', amount: 100, currency: 'USD' as any }))
      .rejects.toThrow(SumoPodValidationError);
      
    // URL checks (covers lines 169-170, 173-174)
    await expect(client.createPayment({ 
      order_id: 'ORD', amount: 100, currency: 'IDR', success_return_url: 'http://insecure.com' 
    })).rejects.toThrow(SumoPodValidationError);
    
    await expect(client.createPayment({ 
      order_id: 'ORD', amount: 100, currency: 'IDR', cancel_return_url: 'ftp://insecure.com' 
    })).rejects.toThrow(SumoPodValidationError);
  });
});
