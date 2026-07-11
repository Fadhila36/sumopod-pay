/**
 * NestJS service wrapping the core SumoPodClient.
 */
import { Injectable, Inject } from '@nestjs/common';
import { SumoPodClient } from '../../core/sumopod.client.js';
import type {
  CreatePaymentDto,
  PaymentResponse,
} from '../../dto/payment.dto.js';
import { SUMOPOD_OPTIONS } from './sumopod.constants.js';
import type { SumoPodModuleOptions } from '../../interfaces/config.interface.js';

@Injectable()
export class SumoPodService {
  private readonly client: SumoPodClient;

  constructor(
    @Inject(SUMOPOD_OPTIONS)
    options: SumoPodModuleOptions,
  ) {
    this.client = new SumoPodClient({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      maxRetries: options.maxRetries,
      timeoutMs: options.timeoutMs,
    });
  }

  /**
   * Create a payment link via the SumoPod API.
   * @param dto - Payment creation parameters
   * @returns Payment details including the payment_link_url
   */
  async createPayment(dto: CreatePaymentDto): Promise<PaymentResponse> {
    return this.client.createPayment(dto);
  }

  /**
   * Access the underlying SumoPodClient.
   * @returns The raw SumoPodClient instance
   */
  getClient(): SumoPodClient {
    return this.client;
  }
}
