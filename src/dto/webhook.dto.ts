/**
 * DTOs for SumoPod Webhook events
 */

/** Supported webhook event types */
export type WebhookEventType =
  | 'payment.completed'
  | 'payment.failed'
  | 'payment.expired'
  | 'payment.test';

/** Webhook event payload data */
export interface WebhookEventData {
  payment_id: string;
  order_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  payment_method: string;
  completed_at: string;
}

/** Full webhook event payload */
export interface WebhookEvent {
  event_type: WebhookEventType;
  data: WebhookEventData;
}
