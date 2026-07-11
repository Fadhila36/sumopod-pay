/**
 * DTOs (Data Transfer Objects) for SumoPod Payment Gateway
 */

/** Request DTO for creating a payment */
export interface CreatePaymentDto {
  /** Your unique order identifier */
  order_id: string;
  /** Payment amount (must be > 0) */
  amount: number;
  /** Currency code — currently only IDR supported */
  currency: 'IDR';
  /** Hours until the payment link expires (default: 24) */
  expires_in_hours?: number;
  /** URL to redirect to after successful payment */
  success_return_url?: string;
  /** URL to redirect to if payment is cancelled */
  cancel_return_url?: string;
}

/** Response from the Create Payment API */
export interface PaymentResponse {
  payment_id: string;
  order_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  payment_link_url: string;
  status: 'pending';
  expires_at: string;
}
