import type { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { welcomeEmailJob } from '@lambder/contracts';
import { MockEmailProvider, WelcomeEmailService, type EmailProvider } from '@lambder/email';
import { createLogger, type Logger } from '@lambder/shared-kernel';

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
        const log = logger.child({ messageId: record.messageId });
        try {
          const job = welcomeEmailJob.parse(JSON.parse(record.body));
          await service.execute(job);
          log.info({ userId: job.userId }, 'email-worker.processed');
        } catch (err) {
          log.error({ err }, 'email-worker.failed');
          failures.push({ itemIdentifier: record.messageId });
        }
      }

      return { batchItemFailures: failures };
    },
  };
};
