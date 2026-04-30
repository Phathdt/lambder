import { describe, expect, test } from 'vitest';
import { Argon2Hasher } from '../src/infrastructure/crypto/argon2.hasher';

describe('Argon2Hasher (scrypt-backed)', () => {
  const hasher = new Argon2Hasher();

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
});
