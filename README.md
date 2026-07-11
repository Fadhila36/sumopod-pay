# sumopod-pay

[![npm version](https://img.shields.io/npm/v/sumopod-pay.svg)](https://www.npmjs.com/package/sumopod-pay)
[![CI](https://github.com/sumopod/sumopod-pay/actions/workflows/ci.yml/badge.svg)](https://github.com/sumopod/sumopod-pay/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-%3E90%25-brightgreen.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Unofficial SDK for **SumoPod Payment Gateway** — works with Node.js, Bun, Express, and NestJS.

> [!WARNING]
> **Disclaimer:** This package is an unofficial SDK created by a third party. It is not affiliated with, maintained, authorized, endorsed, or sponsored by SumoPod. All trademarks, service marks, and trade names of SumoPod used herein are the property of SumoPod.

## Features

- 🚀 **Multi-runtime** — Node.js ≥18, Bun ≥1.0
- 🔌 **Framework integrations** — Express middleware & NestJS dynamic module included
- 🔒 **Secure webhook verification** — Svix-style HMAC signatures + token-based, constant-time comparison
- ♻️ **Automatic retry** — Exponential backoff for 5xx/network errors (never retries 4xx)
- 📦 **Dual ESM/CJS** — Subpath exports with full TypeScript declarations
- 🧪 **Thoroughly tested** — Vitest + MSW, 90%+ coverage

---

## Installation

```bash
# npm
npm install sumopod-pay

# bun
bun add sumopod-pay

# pnpm
pnpm add sumopod-pay

# yarn
yarn add sumopod-pay
```

### Peer Dependencies (optional)

For Express integration:
```bash
npm install express
```

For NestJS integration:
```bash
npm install @nestjs/common @nestjs/core reflect-metadata
```

---

## Quick Start

### Node.js / Bun (Core SDK)

```typescript
import { SumoPodClient } from 'sumopod-pay';

const client = new SumoPodClient({
  apiKey: process.env.SUMOPOD_API_KEY!,
  baseUrl: 'https://api-pay-sandbox.sumopod.com/api/v1', // optional, defaults to sandbox
});

const payment = await client.createPayment({
  order_id: 'ORD-001',
  amount: 150_000,
  currency: 'IDR',
  expires_in_hours: 24,
  success_return_url: 'https://myapp.com/success',
  cancel_return_url: 'https://myapp.com/cancel',
});

console.log(payment.payment_link_url);
// → https://pay.sumopod.com/link/abc123
```

### Express.js

```typescript
import express from 'express';
import { sumopodWebhookMiddleware } from 'sumopod-pay/express';

const app = express();

app.post(
  '/webhook/sumopod',
  express.raw({ type: 'application/json' }),
  sumopodWebhookMiddleware({
    webhookSecret: process.env.SUMOPOD_WEBHOOK_SECRET!,
    verificationMethod: 'signature', // or 'token'
  }),
  (req, res) => {
    const event = req.sumopodEvent!;
    console.log(`Received ${event.event_type}:`, event.data);

    switch (event.event_type) {
      case 'payment.completed':
        // Handle successful payment
        break;
      case 'payment.failed':
        // Handle failed payment
        break;
      case 'payment.expired':
        // Handle expired payment
        break;
    }

    res.sendStatus(200);
  },
);

app.listen(3000);
```

### NestJS

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { SumoPodModule } from 'sumopod-pay/nest';

@Module({
  imports: [
    SumoPodModule.forRoot({
      apiKey: process.env.SUMOPOD_API_KEY!,
      webhookSecret: process.env.SUMOPOD_WEBHOOK_SECRET,
    }),
    // Or use async configuration:
    // SumoPodModule.forRootAsync({
    //   imports: [ConfigModule],
    //   useFactory: (config: ConfigService) => ({
    //     apiKey: config.get('SUMOPOD_API_KEY')!,
    //     webhookSecret: config.get('SUMOPOD_WEBHOOK_SECRET'),
    //   }),
    //   inject: [ConfigService],
    // }),
  ],
})
export class AppModule {}
```

```typescript
// payment.controller.ts
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { SumoPodService, SumoPodWebhookGuard } from 'sumopod-pay/nest';

@Controller('payments')
export class PaymentController {
  constructor(private readonly sumopod: SumoPodService) {}

  @Post()
  async create() {
    return this.sumopod.createPayment({
      order_id: 'ORD-001',
      amount: 100_000,
      currency: 'IDR',
    });
  }

  @Post('webhook')
  @UseGuards(SumoPodWebhookGuard)
  async handleWebhook(@Body() body: any) {
    console.log('Webhook received:', body);
    return { ok: true };
  }
}
```

---

## Webhook Verification (Manual)

For frameworks like Fastify, Hono, etc., use the core verifier directly:

```typescript
import { verifySignature, verifyToken } from 'sumopod-pay';

// Method 1: Svix-style signature
const isValid = verifySignature(
  rawBodyString,
  {
    'svix-id': request.headers['svix-id'],
    'svix-timestamp': request.headers['svix-timestamp'],
    'svix-signature': request.headers['svix-signature'],
  },
  process.env.SUMOPOD_WEBHOOK_SECRET!,
);

// Method 2: Token-based
const isValidToken = verifyToken(
  request.headers['x-webhook-token'],
  process.env.SUMOPOD_WEBHOOK_TOKEN!,
);
```

> ⚠️ **Important**: Always use the raw request body (not parsed JSON) for signature verification. Parsing and re-serializing JSON may change whitespace or key ordering, breaking the signature.

---

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | *required* | Your SumoPod API key |
| `baseUrl` | `string` | `https://api-pay-sandbox.sumopod.com/api/v1` | API base URL |
| `maxRetries` | `number` | `3` | Max retries for 5xx/network errors |
| `timeoutMs` | `number` | `30000` | Request timeout in milliseconds |

### Environment Variables

Copy `.env.example` to `.env`:

```env
SUMOPOD_API_KEY=your_api_key_here
SUMOPOD_BASE_URL=https://api-pay-sandbox.sumopod.com/api/v1
SUMOPOD_WEBHOOK_SECRET=whsec_xxx
SUMOPOD_WEBHOOK_TOKEN=whtok_xxx
```

> The SDK receives config via constructor — it never reads `process.env` directly. You manage `.env` loading yourself (e.g., with `dotenv`).

---

## Error Handling

```typescript
import {
  SumoPodApiError,
  SumoPodValidationError,
} from 'sumopod-pay';

try {
  await client.createPayment({ ... });
} catch (error) {
  if (error instanceof SumoPodValidationError) {
    console.error(`Validation failed on field "${error.field}": ${error.message}`);
  } else if (error instanceof SumoPodApiError) {
    console.error(`API error ${error.statusCode}: ${error.message}`);
    console.error('Response body:', error.responseBody);
  }
}
```

> [!NOTE]
> **Security Note:** In production (`NODE_ENV=production`), this SDK automatically strips `.stack` traces from custom errors (like `SumoPodApiError`) as an added layer of defense. However, **this is only an additional SDK-level protection**. You, as the application developer, **TETAP bertanggung jawab (remain responsible)** to ensure you do not leak `error.message` or the full raw error object directly to your public API responses. Always handle errors at your application boundary.

---

## Testing

### Run all tests

```bash
# Node.js (Vitest)
npm run test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Bun
bun test
```

### Example Output

```
 ✓ test/unit/sumopod.client.test.ts (10 tests) 120ms
 ✓ test/unit/webhook.verifier.test.ts (9 tests) 15ms
 ✓ test/unit/fetch-client.test.ts (6 tests) 80ms
 ✓ test/unit/crypto.adapter.test.ts (8 tests) 8ms
 ✓ test/integration/express.middleware.test.ts (3 tests) 95ms
 ✓ test/integration/nest.guard.test.ts (4 tests) 35ms

 Test Files  6 passed (6)
      Tests  40 passed (40)
   Start at  02:30:00
   Duration  680ms
```

---

## Publishing this Package

1. **Build** the package:
   ```bash
   npm run build
   ```

2. **Login** to npm:
   ```bash
   npm login
   ```

3. **Publish**:
   ```bash
   npm publish --access public
   ```

### Automated Publishing (GitHub Actions)

The CI workflow automatically publishes to npm when a version tag is pushed:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Make sure `NPM_TOKEN` is set in your GitHub repository secrets.

---

## Project Structure

```
sumopod-pay/
├── src/
│   ├── core/
│   │   ├── sumopod.client.ts     # Main SDK client
│   │   ├── http/
│   │   │   └── fetch-client.ts    # HTTP client with retry
│   │   └── crypto/
│   │       └── crypto.adapter.ts  # HMAC & constant-time compare
│   ├── webhook/
│   │   ├── webhook.verifier.ts    # Signature & token verification
│   │   ├── express/
│   │   │   └── webhook.middleware.ts
│   │   └── nest/
│   │       ├── sumopod.module.ts
│   │       ├── sumopod.service.ts
│   │       ├── webhook.guard.ts
│   │       └── sumopod.constants.ts
│   ├── dto/                       # Data Transfer Objects
│   ├── interfaces/                # TypeScript interfaces
│   ├── exceptions/                # Custom error classes
│   ├── index.ts                   # Main entrypoint
│   ├── express.ts                 # Express entrypoint
│   └── nest.ts                    # NestJS entrypoint
├── test/
│   ├── unit/
│   ├── integration/
│   └── __mocks__/                 # MSW handlers
├── .github/workflows/ci.yml
├── tsup.config.ts
├── vitest.config.ts
├── tsconfig.json
└── package.json
```

## Author

**Muhammad Fadhila Abiyyu Faris**
- GitHub: [@fadhila36](https://github.com/fadhila36)
- Website: [https://www.fadhilaabiyyu.my.id/](https://www.fadhilaabiyyu.my.id/)

---

## License

[MIT](LICENSE)
