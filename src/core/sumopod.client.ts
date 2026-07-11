import type { SumoPodConfig } from '../interfaces/config.interface.js';
import type {
  CreatePaymentDto,
  PaymentResponse,
} from '../dto/payment.dto.js';
import { FetchClient, maskApiKey } from './http/fetch-client.js';
import { SumoPodValidationError, SumoPodApiError } from '../exceptions/index.js';

const DEFAULT_BASE_URL = 'https://api-pay-sandbox.sumopod.com/api/v1';
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_EXPIRES_IN_HOURS = 24;

class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  
  constructor(private capacity: number, private refillRatePerSec: number) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }
  
  consume(): boolean {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.refillRatePerSec);
    this.lastRefill = now;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

// thread-safe for concurrent first requests
let zodPromise: Promise<any> | null = null;
let zodSchema: any = null;

function getZodSchema(): Promise<any> {
  if (zodSchema !== null) return Promise.resolve(zodSchema);
  if (zodPromise) return zodPromise;

  // @ts-ignore: optional peer dependency
  zodPromise = import('zod')
    .then((m) => {
      const z = m.z || m.default?.z || m;
      zodSchema = z.object({
        order_id: z.string().min(1).max(64).regex(/^[a-zA-Z0-9-_]+$/),
        amount: z.number().int().positive().max(999999999),
        currency: z.literal('IDR'),
        success_return_url: z.string().url().regex(/^https:\/\//).optional(),
        cancel_return_url: z.string().url().regex(/^https:\/\//).optional(),
        expires_in_hours: z.number().int().positive().optional(),
      });
      return zodSchema;
    })
    .catch(() => {
      // fallback to manual validation if zod isn't installed
      zodSchema = false;
      return false;
    });

  return zodPromise;
}

export class SumoPodClient {
  private readonly httpClient: FetchClient;
  private readonly maskedKey: string;
  private readonly rateLimiter?: TokenBucket;

  constructor(config: SumoPodConfig) {
    if (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim() === '' || config.apiKey.length < 10) {
      throw new SumoPodValidationError(
        'apiKey',
        'API key is required, must be a string, and must be at least 10 characters long.',
      );
    }

    if (config.baseUrl && !config.baseUrl.startsWith('https://')) {
      throw new SumoPodValidationError(
        'baseUrl',
        'baseUrl must use the secure https:// protocol to prevent SSRF or MITM attacks.',
      );
    }

    this.maskedKey = maskApiKey(config.apiKey);

    if (!config.disableRateLimit) {
      // allow 50 requests per second burst/refill (generous enough for typical use)
      this.rateLimiter = new TokenBucket(50, 50);
    }

    this.httpClient = new FetchClient({
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      apiKey: config.apiKey,
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      fetchImpl: config.fetchImpl,
    });
  }

  /**
   * Create a new payment link.
   *
   * @param dto - Payment creation parameters
   * @returns Payment details including the payment_link_url
   */
  async createPayment(dto: CreatePaymentDto): Promise<PaymentResponse> {
    if (this.rateLimiter && !this.rateLimiter.consume()) {
      throw new SumoPodApiError(429, 'Client-side rate limit exceeded. Slow down requests.');
    }

    const schema = await getZodSchema();
    if (schema) {
      const result = schema.safeParse(dto);
      if (!result.success) {
        throw new SumoPodValidationError('payload', `Validation failed: ${result.error.message}`);
      }
    } else {
      this.manualValidate(dto);
    }

    // TODO: maybe add support for custom idempotency keys later
    const body = {
      ...dto,
      expires_in_hours: dto.expires_in_hours ?? DEFAULT_EXPIRES_IN_HOURS,
    };

    return this.httpClient.request<PaymentResponse>({
      method: 'POST',
      path: '/payments',
      body,
    });
  }

  /**
   * Get the masked API key (safe for logging).
   * @returns Masked API key string
   */
  getMaskedApiKey(): string {
    return this.maskedKey;
  }

  private manualValidate(dto: CreatePaymentDto): void {
    if (!dto.order_id || typeof dto.order_id !== 'string' || dto.order_id.trim() === '' || dto.order_id.length > 64) {
      throw new SumoPodValidationError('order_id', 'order_id is required, must be a string, and max 64 characters.');
    }
    if (!/^[a-zA-Z0-9-_]+$/.test(dto.order_id)) {
      throw new SumoPodValidationError('order_id', 'order_id contains invalid characters.');
    }

    if (typeof dto.amount !== 'number' || dto.amount <= 0 || !Number.isInteger(dto.amount) || dto.amount > 999999999) {
      throw new SumoPodValidationError('amount', 'amount must be a positive integer no greater than 999,999,999.');
    }

    if (dto.currency !== 'IDR') {
      throw new SumoPodValidationError('currency', 'Only "IDR" currency is supported.');
    }

    if (dto.success_return_url && !dto.success_return_url.startsWith('https://')) {
      throw new SumoPodValidationError('success_return_url', 'Must use https:// protocol.');
    }

    if (dto.cancel_return_url && !dto.cancel_return_url.startsWith('https://')) {
      throw new SumoPodValidationError('cancel_return_url', 'Must use https:// protocol.');
    }
  }
}
