import Redis from 'ioredis';

declare global {
  // eslint-disable-next-line no-var
  var _redis: Redis | undefined;
}

export const getRedis = (redisUrl: string): Redis => {
  if (!globalThis._redis) {
    globalThis._redis = new Redis(redisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }
  return globalThis._redis;
};

export type { Redis };
