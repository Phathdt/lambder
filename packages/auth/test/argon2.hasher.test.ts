import { describe, expect, test, vi, beforeEach } from 'vitest';
import { Argon2Hasher } from '../src/infrastructure/crypto/argon2.hasher';

describe('Argon2Hasher (scrypt-backed)', () => {
  let hasher: Argon2Hasher;

  beforeEach(() => {
    hasher = new Argon2Hasher();
  });

  test('hash produces a non-trivial digest, never the plain password', async () => {
    const digest = await hasher.hash('SuperSecret123!');
    expect(digest).not.toContain('SuperSecret123!');
    expect(digest.startsWith('scrypt$')).toBe(true);
    expect(digest.split('$')).toHaveLength(3);
  });

  test('verify accepts correct password', async () => {
    const digest = await hasher.hash('Pa$$word!');
    expect(await hasher.verify('Pa$$word!', digest)).toBe(true);
  });

  test('verify rejects wrong password', async () => {
    const digest = await hasher.hash('Pa$$word!');
    expect(await hasher.verify('Different', digest)).toBe(false);
  });

  test('verify returns false for malformed digests', async () => {
    expect(await hasher.verify('x', 'not-a-valid-digest')).toBe(false);
    expect(await hasher.verify('x', 'scrypt$only-two-parts')).toBe(false);
  });

  test('two hashes of the same password are different (salted)', async () => {
    const a = await hasher.hash('same');
    const b = await hasher.hash('same');
    expect(a).not.toBe(b);
  });

  test('verify returns false for digest with invalid salt length (too short)', async () => {
    // Create a digest with valid format but salt that decodes to wrong length
    // 'ab' is only 1 byte, we need 16 bytes
    const badDigest = 'scrypt$ab$' + 'cd'.repeat(32);
    expect(await hasher.verify('password', badDigest)).toBe(false);
  });

  test('verify returns false for digest with invalid hash length (too short)', async () => {
    // Valid salt (16 bytes) but hash is only 1 byte instead of 32
    const badDigest = 'scrypt$' + 'aa'.repeat(16) + '$cd';
    expect(await hasher.verify('password', badDigest)).toBe(false);
  });

  test('verify returns false for digest with invalid salt length (too long)', async () => {
    // Salt decodes to more than 16 bytes
    const badDigest = 'scrypt$' + 'aa'.repeat(20) + '$' + 'cd'.repeat(32);
    expect(await hasher.verify('password', badDigest)).toBe(false);
  });

  test('verify handles catch when comparing hashes fails', async () => {
    // Create a valid digest first
    const digest = await hasher.hash('password');

    // Now create a scenario where timingSafeEqual might fail
    // by passing buffers of mismatched lengths through to the comparison
    // This is defensive code that catches any error from scrypt in verify
    const [, saltHex, expectedHex] = digest.split('$');

    // Create a slightly shorter expected hash to potentially cause issues
    const parts = expectedHex.split('');
    parts.pop(); // Remove last char
    const truncatedHex = parts.join('');

    const badDigest = `scrypt$${saltHex}$${truncatedHex}`;
    expect(await hasher.verify('password', badDigest)).toBe(false);
  });

  test('verify returns false for digest with missing salt (covers nullish coalesce fallback)', async () => {
    // Digest with empty salt part: missing the hex content before second $
    const badDigest = 'scrypt$$' + 'aa'.repeat(32);
    expect(await hasher.verify('password', badDigest)).toBe(false);
  });

  test('verify returns false for digest with missing hash (covers nullish coalesce fallback)', async () => {
    // Digest with empty hash part: missing the hex content after final $
    const badDigest = 'scrypt$' + 'aa'.repeat(16) + '$';
    expect(await hasher.verify('password', badDigest)).toBe(false);
  });
});
