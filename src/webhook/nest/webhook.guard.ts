/**
 * NestJS webhook guard for SumoPod webhook verification.
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  verifySignature,
  verifyToken,
  type SvixHeaders,
} from '../webhook.verifier.js';
import { SUMOPOD_OPTIONS } from './sumopod.constants.js';
import type { SumoPodModuleOptions } from '../../interfaces/config.interface.js';

@Injectable()
export class SumoPodWebhookGuard implements CanActivate {
  constructor(
    @Inject(SUMOPOD_OPTIONS)
    private readonly options: SumoPodModuleOptions,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const rawBody =
      request.body instanceof Buffer
        ? request.body.toString('utf8')
        : typeof request.body === 'string'
          ? request.body
          : JSON.stringify(request.body);

    // Try signature verification first
    if (this.options.webhookSecret) {
      const svixId = request.headers['svix-id'] as string | undefined;
      const svixTimestamp = request.headers['svix-timestamp'] as
        | string
        | undefined;
      const svixSignature = request.headers['svix-signature'] as
        | string
        | undefined;

      if (!svixId || !svixTimestamp || !svixSignature) {
        throw new UnauthorizedException(
          'Missing required webhook signature headers',
        );
      }

      const headers: SvixHeaders = {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      };

      if (!verifySignature(rawBody, headers, this.options.webhookSecret, this.options.webhookToleranceInSeconds)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }

      return true;
    }

    // Fallback to token verification
    if (this.options.webhookToken) {
      const receivedToken = request.headers['x-webhook-token'] as
        | string
        | undefined;

      if (!receivedToken) {
        throw new UnauthorizedException(
          'Missing X-Webhook-Token header',
        );
      }

      if (!verifyToken(receivedToken, this.options.webhookToken)) {
        throw new UnauthorizedException('Invalid webhook token');
      }

      return true;
    }

    throw new UnauthorizedException(
      'No webhook verification method configured',
    );
  }
}
