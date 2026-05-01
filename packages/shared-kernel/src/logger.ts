import { pino, type Logger, type LoggerOptions } from 'pino';

export type { Logger };

export interface LoggerConfig {
  service: string;
  level?: string;
  // pretty=true uses pino-pretty (dev). Lambda always emits JSON to stdout
  // for CloudWatch to pick up.
  pretty?: boolean;
}

// Lambda + CloudWatch want JSON on stdout. Process-wide singleton.
export const createLogger = (config: LoggerConfig): Logger => {
  const opts: LoggerOptions = {
    level: config.level ?? process.env.LOG_LEVEL ?? 'info',
    base: {
      service: config.service,
      env: process.env.NODE_ENV ?? 'development',
    },
    // Add ISO timestamp; CloudWatch + Datadog parse this.
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    // Drop these from logs since Lambda already adds requestId via env.
    redact: {
      paths: [
        'password',
        '*.password',
        'authorization',
        '*.authorization',
        'accessToken',
        'refreshToken',
      ],
      remove: true,
    },
  };

  if (config.pretty) {
    return pino({
      ...opts,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname,service,env',
        },
      },
    });
  }
  return pino(opts);
};
