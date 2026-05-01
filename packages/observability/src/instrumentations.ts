import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';

// Auto-instrumentation set picked for our stack: HTTP (Hono uses node:http),
// AWS SDK v3 (SQS produce/consume), pg + ioredis (DB + cache spans), pino
// (auto-injects traceId/spanId into log lines).
export const pickInstrumentations = () => [
  new HttpInstrumentation(),
  new AwsInstrumentation({ suppressInternalInstrumentation: true }),
  new PgInstrumentation({ enhancedDatabaseReporting: false }),
  new IORedisInstrumentation(),
  new PinoInstrumentation({
    logKeys: { traceId: 'traceId', spanId: 'spanId', traceFlags: 'traceFlags' },
  }),
];
