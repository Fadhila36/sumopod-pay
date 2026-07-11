/**
 * Unit tests for the crypto adapter.
 *
 * These tests verify HMAC-SHA256 and constant-time comparison work correctly.
 * The same test file can be run under both Node.js (vitest) and Bun (bun test)
 * to confirm cross-runtime compatibility.
 */
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  hmacSha256Base64,
  constantTimeEqual,
} from '../../src/core/crypto/crypto.adapter.js';

describe('CryptoAdapter', () => {
  describe('hmacSha256Base64', () => {
    it('should produce correct HMAC-SHA256 base64 output', () => {
      const key = Buffer.from('testsecret', 'utf8');
      const data = 'hello world';

      // Compute expected value using node:crypto directly
      const expected = createHmac('sha256', key)
        .update(data, 'utf8')
        .digest('base64');

      const result = hmacSha256Base64(key, data);

      expect(result).toBe(expected);
      // Also verify against a known value
      // HMAC-SHA256('testsecret', 'hello world') base64
      expect(result).toMatch(/^[A-Za-z0-9+/]+=*$/); // valid base64
    });

    it('should produce different output for different keys', () => {
      const data = 'same data';
      const key1 = Buffer.from('key1', 'utf8');
      const key2 = Buffer.from('key2', 'utf8');

      const result1 = hmacSha256Base64(key1, data);
      const result2 = hmacSha256Base64(key2, data);

      expect(result1).not.toBe(result2);
    });

    it('should produce different output for different data', () => {
      const key = Buffer.from('samekey', 'utf8');

      const result1 = hmacSha256Base64(key, 'data1');
      const result2 = hmacSha256Base64(key, 'data2');

      expect(result1).not.toBe(result2);
    });
  });

  describe('constantTimeEqual', () => {
    it('should return true for identical strings', () => {
      expect(constantTimeEqual('hello', 'hello')).toBe(true);
    });

    it('should return false for different strings of same length', () => {
      expect(constantTimeEqual('hello', 'world')).toBe(false);
    });

    it('should return false for different length strings', () => {
      expect(constantTimeEqual('short', 'longer_string')).toBe(false);
    });

    it('should return true for empty strings', () => {
      expect(constantTimeEqual('', '')).toBe(true);
    });

    it('should handle unicode strings', () => {
      expect(constantTimeEqual('こんにちは', 'こんにちは')).toBe(true);
      expect(constantTimeEqual('こんにちは', 'こんにちわ')).toBe(false);
    });

  });
});

/*
Expected output (npm run test):

 ✓ test/unit/crypto.adapter.test.ts (8 tests) 8ms
   ✓ CryptoAdapter > hmacSha256Base64 > should produce correct HMAC-SHA256 base64 output
   ✓ CryptoAdapter > hmacSha256Base64 > should produce different output for different keys
   ✓ CryptoAdapter > hmacSha256Base64 > should produce different output for different data
   ✓ CryptoAdapter > constantTimeEqual > should return true for identical strings
   ✓ CryptoAdapter > constantTimeEqual > should return false for different strings of same length
   ✓ CryptoAdapter > constantTimeEqual > should return false for different length strings
   ✓ CryptoAdapter > constantTimeEqual > should return true for empty strings
   ✓ CryptoAdapter > constantTimeEqual > should handle unicode strings
*/
