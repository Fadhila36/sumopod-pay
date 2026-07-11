/**
 * NestJS dynamic module for SumoPod Payment Gateway.
 */
import { Module, DynamicModule, Provider } from '@nestjs/common';
import type {
  SumoPodModuleOptions,
  SumoPodModuleAsyncOptions,
} from '../../interfaces/config.interface.js';
import { SUMOPOD_OPTIONS } from './sumopod.constants.js';
import { SumoPodService } from './sumopod.service.js';
import { SumoPodWebhookGuard } from './webhook.guard.js';

@Module({})
export class SumoPodModule {
  /**
   * Register the SumoPod module with static configuration.
   */
  static forRoot(options: SumoPodModuleOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: SUMOPOD_OPTIONS,
      useValue: options,
    };

    return {
      module: SumoPodModule,
      global: true,
      providers: [optionsProvider, SumoPodService, SumoPodWebhookGuard],
      exports: [SumoPodService, SumoPodWebhookGuard, SUMOPOD_OPTIONS],
    };
  }

  /**
   * Register the SumoPod module with async configuration (e.g., using ConfigService).
   */
  static forRootAsync(options: SumoPodModuleAsyncOptions): DynamicModule {
    const asyncProvider: Provider = {
      provide: SUMOPOD_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: SumoPodModule,
      global: true,
      imports: options.imports ?? [],
      providers: [asyncProvider, SumoPodService, SumoPodWebhookGuard],
      exports: [SumoPodService, SumoPodWebhookGuard, SUMOPOD_OPTIONS],
    };
  }
}
