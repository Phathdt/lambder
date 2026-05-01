import type { Logger } from '@lambder/shared-kernel';
import type { Context, MiddlewareHandler } from 'hono';

// Per-request child logger with request ID + duration. Routes read it via
// `c.get('logger')`. Lambda API Gateway populates `x-amzn-trace-id`; we fall
// back to a UUID for local dev so requests stay traceable.
export const requestLogger = (rootLogger: Logger): MiddlewareHandler => {
  return async (c: Context, next) => {
    const requestId =
      c.req.header('x-amzn-trace-id') ??
      c.req.header('x-request-id') ??
      crypto.randomUUID();

    const start = performance.now();
    const log = rootLogger.child({ requestId, method: c.req.method, path: c.req.path });
    c.set('logger', log);

    log.info('request received');
    try {
      await next();
      const durationMs = Math.round(performance.now() - start);
      log.info({ status: c.res.status, durationMs }, 'request completed');
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      log.error({ err, durationMs }, 'request failed');
      throw err;
    }
  };
};

declare module 'hono' {
  interface ContextVariableMap {
    logger: Logger;
  }
}
