import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Compute HMAC-SHA256 of `data` using `key`, returning a base64-encoded string.
 */
export function hmacSha256Base64(key: Buffer, data: string): string {
  return createHmac('sha256', key).update(data, 'utf8').digest('base64');
}

/**
 * Constant-time comparison of two strings.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // still gotta compare something even on length mismatch, otherwise timing leaks the length
    const dummyTarget = Buffer.from(b, 'utf8');
    safeTimingEqual(dummyTarget, dummyTarget);
    return false;
  }

  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return safeTimingEqual(bufA, bufB);
}

// manual fallback just in case timingSafeEqual is not there
function safeTimingEqual(a: Buffer, b: Buffer): boolean {
  try {
    return timingSafeEqual(a, b);
  } catch {
    /* v8 ignore start */
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= (a[i] as number) ^ (b[i] as number);
    }
    return result === 0;
    /* v8 ignore stop */
  }
}
