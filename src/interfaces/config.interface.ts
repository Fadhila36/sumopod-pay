/**
 * Configuration interfaces for SumoPod SDK
 */

/** Core SDK configuration */
export interface SumoPodConfig {
  /**
   * Your SumoPod API Key (e.g. sk_live_xxx).
   */
  apiKey: string;

  /**
   * The base URL for the SumoPod API.
   * Defaults to the sandbox environment if not provided.
   * MUST use https:// protocol.
   */
  baseUrl?: string;

  /**
   * Maximum number of retries for 5xx errors or network timeouts.
   * Defaults to 3. (4xx errors are never retried).
   */
  maxRetries?: number;

  /**
   * Timeout in milliseconds for each request.
   * Defaults to 30000 (30 seconds).
   */
  timeoutMs?: number;

  /**
   * Disable the client-side rate limiter.
   * By default, the SDK throttles requests to 50/sec to prevent spam/retry-loops.
   */
  disableRateLimit?: boolean;

}

/** Webhook verification configuration */
export interface WebhookConfig {
  /** Svix-style webhook secret (starts with "whsec_") */
  webhookSecret?: string;
  /** Token-based webhook verification token (starts with "whtok_") */
  webhookToken?: string;
  /** Tolerance in seconds for svix-timestamp webhook verification to prevent replay attacks (default: 300) */
  webhookToleranceInSeconds?: number;
}

/** Options for the Express webhook middleware */
export interface ExpressWebhookOptions extends WebhookConfig {
  /** Verification method: 'signature' for Svix-style, 'token' for simple token */
  verificationMethod?: 'signature' | 'token';
}

/** NestJS module configuration */
export interface SumoPodModuleOptions extends SumoPodConfig, WebhookConfig {}

/** Async module configuration factory for NestJS */
export interface SumoPodModuleAsyncOptions {
  imports?: any[];
  useFactory: (
    ...args: any[]
  ) => Promise<SumoPodModuleOptions> | SumoPodModuleOptions;
  inject?: any[];
}
