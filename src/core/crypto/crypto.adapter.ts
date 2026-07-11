/**
 * Crypto adapter — wraps node:crypto to provide HMAC-SHA256 and
 * constant-time comparison. Compatible with Node.js ≥18 and Bun ≥1.0.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Compute HMAC-SHA256 of `data` using `key`, returning a base64-encoded string.
 */
export function hmacSha256Base64(key: Buffer, data: string): string {
  return createHmac('sha256', key).update(data, 'utf8').digest('base64');
}

/**
 * Constant-time comparison of two strings.
 * Falls back to a manual constant-time loop if `timingSafeEqual` is unavailable.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // To prevent timing attacks that can reveal the target string's length,
    // we must perform a comparison that takes time proportional to the *target length* (b).
    // If we used `a`, an attacker could guess the length of `b` by measuring response times.
    const dummyTarget = Buffer.from(b, 'utf8');
    timingSafeEqualSafe(dummyTarget, dummyTarget);
    return false;
  }

  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return timingSafeEqualSafe(bufA, bufB);
}

/**
 * Safe wrapper around timingSafeEqual with manual fallback.
 */
function timingSafeEqualSafe(a: Buffer, b: Buffer): boolean {
  try {
    return timingSafeEqual(a, b);
  } catch {
    /* v8 ignore start */
    // Manual constant-time comparison fallback
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= (a[i] as number) ^ (b[i] as number);
    }
    return result === 0;
    /* v8 ignore stop */
  }
}
