import {
  hmacSha256Base64,
  constantTimeEqual,
} from '../core/crypto/crypto.adapter.js';

export interface SvixHeaders {
  'svix-id': string;
  'svix-timestamp': string;
  'svix-signature': string;
}

/**
 * Verify a Svix-style HMAC-SHA256 webhook signature.
 *
 * @param rawBody - Raw request body string
 * @param headers - Svix headers
 * @param secret - Webhook secret (whsec_...)
 * @param tolerance - Max clock skew tolerance in seconds
 * @returns true if valid
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

  // prevent replay attacks / clock drift anomalies
  const timestampNum = parseInt(svixTimestamp, 10);
  if (isNaN(timestampNum)) return false;

  const now = Math.floor(Date.now() / 1000);
  // reject both old payloads and future payloads from clock skew
  if (Math.abs(now - timestampNum) > tolerance) {
    return false;
  }

  // strip whsec_ prefix if present
  const secretBase64 = secret.startsWith('whsec_')
    ? secret.slice(6)
    : secret;
  const secretBytes = Buffer.from(secretBase64, 'base64');

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expectedSig = hmacSha256Base64(secretBytes, signedContent);

  // svix-signature might have multiple values separated by space
  const signatures = svixSignatureHeader.split(' ');

  for (const sigEntry of signatures) {
    const parts = sigEntry.split(',');
    if (parts.length < 2 || parts[0] !== 'v1') continue;

    // rejoin in case base64 contains no comma, though it usually doesn't
    const candidateSig = parts.slice(1).join(',');
    if (constantTimeEqual(expectedSig, candidateSig)) {
      return true;
    }
  }

  return false;
}

/**
 * Verify a webhook using a simple constant-time token comparison.
 *
 * @param receivedToken - Token from X-Webhook-Token header
 * @param expectedToken - Expected webhook token
 * @returns true if tokens match
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
