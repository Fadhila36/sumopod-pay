/**
 * sumopod-pay — main entrypoint
 *
 * Core SDK for Node.js and Bun. Import from 'sumopod-pay'.
 */

// Core client
export { SumoPodClient } from './core/sumopod.client.js';

// HTTP client utilities
export { FetchClient, maskApiKey } from './core/http/fetch-client.js';

// Crypto adapter
export {
  hmacSha256Base64,
  constantTimeEqual,
} from './core/crypto/crypto.adapter.js';

// Webhook verifier
export {
  verifySignature,
  verifyToken,
  type SvixHeaders,
} from './webhook/webhook.verifier.js';

// DTOs
export type {
  CreatePaymentDto,
  PaymentResponse,
} from './dto/payment.dto.js';
export type {
  WebhookEvent,
  WebhookEventData,
  WebhookEventType,
} from './dto/webhook.dto.js';

// Interfaces
export type {
  SumoPodConfig,
  WebhookConfig,
  ExpressWebhookOptions,
  SumoPodModuleOptions,
  SumoPodModuleAsyncOptions,
} from './interfaces/config.interface.js';

// Exceptions
export {
  SumoPodError,
  SumoPodApiError,
  SumoPodValidationError,
  SumoPodWebhookError,
} from './exceptions/index.js';
