# Security Policy

## Supported Versions

The following versions of the SumoPod Payment SDK are currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within `sumopod-pay`, please **DO NOT** open a public issue.

Please report security vulnerabilities privately via GitHub Security Advisories at:
https://github.com/fadhila36/sumopod-pay/security/advisories/new

All security vulnerabilities will be promptly addressed.

## Security Practices Implemented

This SDK implements several security mechanisms by default:
- **Constant-Time Comparison:** Webhook tokens and HMAC signatures use `timingSafeEqual` to prevent timing side-channel attacks. Target-length masking is applied.
- **Clock Skew / Replay Protection:** Webhook signatures include a timestamp validation with a configurable maximum tolerance (default 300s). Both future and past skews are rejected via absolute difference.
- **SSRF Prevention:** API endpoints and URLs strictly validate the `https://` protocol constraint.
- **Rate Limiting:** A Token-Bucket rate limiter blocks excessive requests on the client side before dispatch.
- **Error Hygiene:** Stack traces for API and Validation errors are stripped from `error.stack` natively in `NODE_ENV=production`.
