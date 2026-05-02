import { GenericContainer, type StartedTestContainer } from 'testcontainers';

export interface StartedRedis {
  url: string;
  stop(): Promise<void>;
}

export async function startRedis(): Promise<StartedRedis> {
  const container: StartedTestContainer = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .start();

  const url = `redis://${container.getHost()}:${container.getMappedPort(6379)}`;
  process.env.REDIS_URL = url;
  // biome-ignore lint/suspicious/noExplicitAny: globalThis access
  delete (globalThis as Record<string, unknown>)._redis;

  return {
    url,
    async stop() {
      // biome-ignore lint/suspicious/noExplicitAny: globalThis access
      const r = (globalThis as Record<string, unknown>)._redis as
        | { quit(): Promise<unknown>; disconnect(): void }
        | undefined;
      if (r) {
        try {
          await r.quit();
        } catch {
          /* already closed */
        }
        // biome-ignore lint/suspicious/noExplicitAny: globalThis access
        delete (globalThis as Record<string, unknown>)._redis;
      }
      await container.stop();
    },
  };
}
