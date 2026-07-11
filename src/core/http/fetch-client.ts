/**
 * Fetch-based HTTP client with retry logic for the SumoPod API.
 *
 * - Uses native `fetch` (Node 18+ / Bun)
 * - Retries on network errors and 5xx responses with exponential backoff
 * - Never retries 4xx responses
 * - Masks API key in any logged output
 */
import { SumoPodApiError } from '../../exceptions/index.js';

export interface FetchClientConfig {
  baseUrl: string;
  apiKey: string;
  maxRetries: number;
  timeoutMs: number;
}

export interface FetchRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: unknown;
}

/**
 * Masks an API key for safe logging — shows only the last 4 characters.
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 4) return '****';
  return '*'.repeat(apiKey.length - 4) + apiKey.slice(-4);
}

export class FetchClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;

  constructor(config: FetchClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.maxRetries = config.maxRetries;
    this.timeoutMs = config.timeoutMs;
  }

  /**
   * Execute an HTTP request with retry logic.
   */
  async request<T>(options: FetchRequestOptions): Promise<T> {
    const url = `${this.baseUrl}${options.path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Key': this.apiKey,
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.timeoutMs,
        );

        const response = await fetch(url, {
          method: options.method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          return (await response.json()) as T;
        }

        const responseBody = await response.text().catch(() => '');
        let parsedBody: unknown;
        try {
          parsedBody = JSON.parse(responseBody);
        } catch {
          parsedBody = responseBody;
        }

        // 4xx — never retry client errors
        if (response.status >= 400 && response.status < 500) {
          throw new SumoPodApiError(
            response.status,
            this.extractErrorMessage(parsedBody) ||
              `Request failed with status ${response.status}`,
            parsedBody,
          );
        }

        // 5xx — retry with backoff
        lastError = new SumoPodApiError(
          response.status,
          this.extractErrorMessage(parsedBody) ||
            `Server error (${response.status})`,
          parsedBody,
        );

        if (attempt < this.maxRetries) {
          await this.delay(this.getBackoffMs(attempt));
        }
      } catch (error) {
        if (error instanceof SumoPodApiError && error.statusCode < 500) {
          throw error;
        }

        lastError =
          error instanceof Error
            ? error
            : new Error(String(error));

        if (attempt < this.maxRetries) {
          await this.delay(this.getBackoffMs(attempt));
        }
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  /**
   * Exponential backoff: 200ms, 400ms, 800ms, ...
   */
  private getBackoffMs(attempt: number): number {
    return Math.min(200 * Math.pow(2, attempt), 10_000);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractErrorMessage(body: unknown): string | undefined {
    if (typeof body === 'object' && body !== null) {
      const obj = body as Record<string, unknown>;
      if (typeof obj['message'] === 'string') return obj['message'];
      if (typeof obj['error'] === 'string') return obj['error'];
    }
    return undefined;
  }
}
