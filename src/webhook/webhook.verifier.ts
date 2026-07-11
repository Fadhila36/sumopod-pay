/**
 * Webhook verification for SumoPod Payment Gateway.
 *
 * Supports two verification methods:
 * 1. Signature (Svix-style) — HMAC-SHA256 with svix-id, svix-timestamp, svix-signature headers
 * 2. Token — simple constant-time comparison of X-Webhook-Token header
 */
import {
  hmacSha256Base64,
  constantTimeEqual,
} from '../core/crypto/crypto.adapter.js';

/**
 * Headers expected for Svix-style signature verification.
 */
export interface SvixHeaders {
  'svix-id': string;
  'svix-timestamp': string;
  'svix-signature': string;
}

/**
 * Verify a Svix-style HMAC-SHA256 webhook signature.
 *
 * @param rawBody   - The raw request body as a string (must be the exact bytes received)
 * @param headers   - The svix-id, svix-timestamp, and svix-signature headers
 * @param secret    - The webhook secret (e.g. "whsec_dGVzdHNlY3JldA==")
 * @param tolerance - Maximum allowed time difference in seconds between signature and current time (default 300)
 * @returns `true` if any of the signatures in the header match and the timestamp is within tolerance
 */
export function verifySignature(
  rawBody: string,
  headers: SvixHeaders,
  secret: string,
  tolerance = 300,
): boolean {
  const svixId = headers['svix-id'];
  const svixTimestamp = headers['svix-timestamp'];
  const svixSignatureHeader = headers['svix-signature'];

  if (!svixId || !svixTimestamp || !svixSignatureHeader) {
    return false;
  }

  // Prevent replay attacks / clock drift anomalies
  const timestampNum = parseInt(svixTimestamp, 10);
  if (isNaN(timestampNum)) return false;

  const now = Math.floor(Date.now() / 1000);
  // Compare using absolute difference so that both old payloads and future payloads (from clock skew) are rejected
  if (Math.abs(now - timestampNum) > tolerance) {
    return false;
  }

  // Strip the "whsec_" prefix and base64-decode the secret
  const secretBase64 = secret.startsWith('whsec_')
    ? secret.slice(6)
    : secret;
  const secretBytes = Buffer.from(secretBase64, 'base64');

  // Construct the signed content
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;

  // Compute expected signature
  const expectedSig = hmacSha256Base64(secretBytes, signedContent);

  // svix-signature can contain multiple space-separated values: "v1,<sig1> v1,<sig2>"
  const signatures = svixSignatureHeader.split(' ');

  for (const sigEntry of signatures) {
    const parts = sigEntry.split(',');
    if (parts.length < 2 || parts[0] !== 'v1') continue;

    const candidateSig = parts.slice(1).join(','); // rejoin in case base64 contains no comma, but be safe
    if (constantTimeEqual(expectedSig, candidateSig)) {
      return true;
    }
  }

  return false;
}

/**
 * Verify a webhook using a simple token comparison.
 *
 * @param receivedToken  - The token from the X-Webhook-Token header
 * @param expectedToken  - The expected webhook token (e.g. "whtok_xxx")
 * @returns `true` if the tokens match (constant-time comparison)
 */
export function verifyToken(
  receivedToken: string,
  expectedToken: string,
): boolean {
  if (!receivedToken || !expectedToken) {
    return false;
  }
  return constantTimeEqual(receivedToken, expectedToken);
}
