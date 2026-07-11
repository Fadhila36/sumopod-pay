/**
 * Express.js middleware for SumoPod webhook verification.
 *
 * Usage:
 * ```ts
 * import express from 'express';
 * import { sumopodWebhookMiddleware } from 'sumopod-pay/express';
 *
 * const app = express();
 *
 * app.post(
 *   '/webhook',
 *   express.raw({ type: 'application/json' }),
 *   sumopodWebhookMiddleware({
 *     webhookSecret: process.env.SUMOPOD_WEBHOOK_SECRET,
 *     verificationMethod: 'signature',
 *   }),
 *   (req, res) => {
 *     console.log(req.sumopodEvent);
 *     res.sendStatus(200);
 *   },
 * );
 * ```
 */
import type { Request, Response, NextFunction } from 'express';
import type { WebhookEvent } from '../../dto/webhook.dto.js';
import type { ExpressWebhookOptions } from '../../interfaces/config.interface.js';
import {
  verifySignature,
  verifyToken,
  type SvixHeaders,
} from '../webhook.verifier.js';

// Augment Express Request type
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sumopodEvent?: WebhookEvent;
    }
  }
}

/**
 * Express middleware for SumoPod webhook verification.
 * 
 * Note: Must be used after `express.raw({ type: 'application/json' })`
 * @param options - Webhook configuration options
 */
export function sumopodWebhookMiddleware(
  options: ExpressWebhookOptions,
) {
  const method = options.verificationMethod ?? 'signature';

  return (req: Request, res: Response, next: NextFunction): void => {
    // Get raw body — must be Buffer from express.raw()
    const rawBody =
      req.body instanceof Buffer
        ? req.body.toString('utf8')
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body);

    let verified = false;

    if (method === 'signature') {
      const secret = options.webhookSecret;
      if (!secret) {
        res
          .status(500)
          .json({ error: 'Webhook secret not configured' });
        return;
      }

      const svixId = req.headers['svix-id'] as string | undefined;
      const svixTimestamp = req.headers['svix-timestamp'] as
        | string
        | undefined;
      const svixSignature = req.headers['svix-signature'] as
        | string
        | undefined;

      if (!svixId || !svixTimestamp || !svixSignature) {
        res.status(401).json({
          error:
            'Missing required webhook signature headers: svix-id, svix-timestamp, svix-signature',
        });
        return;
      }

      const headers: SvixHeaders = {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      };

      verified = verifySignature(rawBody, headers, secret, options.webhookToleranceInSeconds);
    } else if (method === 'token') {
      const token = options.webhookToken;
      if (!token) {
        res
          .status(500)
          .json({ error: 'Webhook token not configured' });
        return;
      }

      const receivedToken = req.headers['x-webhook-token'] as
        | string
        | undefined;

      if (!receivedToken) {
        res.status(401).json({
          error: 'Missing required webhook header: X-Webhook-Token',
        });
        return;
      }

      verified = verifyToken(receivedToken, token);
    }

    if (!verified) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    // Parse the event and attach to request
    try {
      const event: WebhookEvent =
        typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
      req.sumopodEvent = event;
    } catch {
      res.status(400).json({ error: 'Invalid webhook payload' });
      return;
    }

    next();
  };
}
