import { Redis } from 'ioredis';

declare global {
  // eslint-disable-next-line no-var
  var _redis: Redis | undefined;
}

export const getRedis = (redisUrl: string): Redis => {
  if (!globalThis._redis) {
    // Note: keep enableOfflineQueue=true so commands issued before the first
    // connect resolve once the socket is up. Lambda cold start finishes the
    // handshake on the first command.
    globalThis._redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
  }
  return globalThis._redis;
};

export { Redis };
