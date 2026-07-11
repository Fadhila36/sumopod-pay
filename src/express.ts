/**
 * sumopod-pay/express — Express.js integration entrypoint
 *
 * Import from 'sumopod-pay/express'.
 */
export { sumopodWebhookMiddleware } from './webhook/express/webhook.middleware.js';

// Re-export core types commonly needed with Express
export type { ExpressWebhookOptions } from './interfaces/config.interface.js';
export type { WebhookEvent } from './dto/webhook.dto.js';
