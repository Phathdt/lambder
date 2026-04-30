import { hash, verify } from '@node-rs/argon2';
import type { Hasher } from '../../domain/interfaces/hasher.js';

// OWASP-recommended Argon2id parameters.
const OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export class Argon2Hasher implements Hasher {
  async hash(plain: string): Promise<string> {
    return hash(plain, OPTIONS);
  }

  async verify(plain: string, digest: string): Promise<boolean> {
    try {
      return await verify(digest, plain);
    } catch {
      return false;
    }
  }
}
