// Note: kept the file name for stability of imports. Implementation uses
// Node's built-in scrypt — no native binaries needed for Lambda deployments.
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Hasher } from '../../domain/interfaces/hasher';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

// OWASP-recommended scrypt cost parameters: N=2^15, r=8, p=1, 32-byte hash.
const KEY_LEN = 32;
const SALT_LEN = 16;

export class Argon2Hasher implements Hasher {
  async hash(plain: string): Promise<string> {
    const salt = randomBytes(SALT_LEN);
    const derived = await scrypt(plain, salt, KEY_LEN);
    return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
  }

  async verify(plain: string, digest: string): Promise<boolean> {
    const parts = digest.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const salt = Buffer.from(parts[1] ?? '', 'hex');
    const expected = Buffer.from(parts[2] ?? '', 'hex');
    if (salt.length !== SALT_LEN || expected.length !== KEY_LEN) return false;
    try {
      const derived = await scrypt(plain, salt, KEY_LEN);
      return timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }
}
