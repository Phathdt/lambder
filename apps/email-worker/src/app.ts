import type { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { context as otelContext, trace } from '@opentelemetry/api';
import { welcomeEmailJob } from '@lambder/contracts';
import { MockEmailProvider, WelcomeEmailService, type EmailProvider } from '@lambder/email';
import { extractTraceContextFromSqsRecord } from '@lambder/observability';
import { createLogger, type Logger } from '@lambder/shared-kernel';

const tracer = trace.getTracer('email-worker');

export interface EmailWorkerDeps {
  service?: WelcomeEmailService;
  logger?: Logger;
}

export interface EmailWorker {
  handle(event: SQSEvent): Promise<SQSBatchResponse>;
}

// Per-record try/catch; SQS partial-batch responses let the runtime redrive
// only the failed messageIds, leaving good ones consumed.
export const buildEmailWorker = (deps: EmailWorkerDeps = {}): EmailWorker => {
  const logger =
    deps.logger ??
    createLogger({ service: 'email-worker', pretty: process.env.NODE_ENV !== 'production' });
  const provider: EmailProvider = new MockEmailProvider(logger);
  const service = deps.service ?? new WelcomeEmailService(provider);

  return {
    async handle(event) {
      const failures: SQSBatchItemFailure[] = [];

      for (const record of event.Records) {
        // Resume the producer's distributed trace by extracting the W3C
        // trace-context from SQS message attributes.
        const parentCtx = extractTraceContextFromSqsRecord(record);
        await otelContext.with(parentCtx, async () => {
          const span = tracer.startSpan('email-worker.process-record', {
            attributes: { 'messaging.system': 'aws_sqs', 'messaging.message_id': record.messageId },
          });
          const log = logger.child({ messageId: record.messageId });
          try {
            const job = welcomeEmailJob.parse(JSON.parse(record.body));
            await service.execute(job);
            log.info({ userId: job.userId }, 'email-worker.processed');
            span.setStatus({ code: 1 });
          } catch (err) {
            log.error({ err }, 'email-worker.failed');
            span.recordException(err as Error);
            span.setStatus({ code: 2, message: (err as Error).message });
            failures.push({ itemIdentifier: record.messageId });
          } finally {
            span.end();
          }
        });
      }

      return { batchItemFailures: failures };
    },
  };
};
