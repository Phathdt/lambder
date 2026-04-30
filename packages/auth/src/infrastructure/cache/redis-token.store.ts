import type { Redis } from '@lambder/cache';
import type { TokenStore } from '../../domain/interfaces/token-store';

const wlKey = (userId: string, jti: string) => `jwt:wl:${userId}:${jti}`;
const wlPattern = (userId: string) => `jwt:wl:${userId}:*`;

export class RedisTokenStore implements TokenStore {
  constructor(private readonly redis: Redis) {}

  async whitelist(userId: string, jti: string, ttlSeconds: number): Promise<void> {
    await this.redis.setex(wlKey(userId, jti), ttlSeconds, '1');
  }

  async isWhitelisted(userId: string, jti: string): Promise<boolean> {
    return (await this.redis.get(wlKey(userId, jti))) === '1';
  }

  async revoke(userId: string, jti: string): Promise<void> {
    await this.redis.del(wlKey(userId, jti));
  }

  async revokeAll(userId: string): Promise<void> {
    const stream = this.redis.scanStream({ match: wlPattern(userId), count: 100 });
    const pipeline = this.redis.pipeline();
    for await (const keys of stream) {
      for (const k of keys as string[]) pipeline.del(k);
    }
    await pipeline.exec();
  }
}
