import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { injectTraceContextIntoSqsAttrs } from '@lambder/observability';
import type {
  EmailEnqueuer,
  WelcomeEmailJob,
  WelcomeEmailJobInput,
} from '../../domain/interfaces/email-enqueuer';

export interface SqsEnqueuerConfig {
  queueUrl: string;
  endpoint?: string; // LocalStack override
  region?: string;
}

// Production adapter — publishes WelcomeEmailJob to SQS. The client is held in
// a class field so warm Lambda invocations reuse the underlying connection.
export class SqsEmailEnqueuer implements EmailEnqueuer {
  private readonly client: SQSClient;
  private readonly queueUrl: string;

  constructor(config: SqsEnqueuerConfig) {
    this.client = new SQSClient({
      region: config.region ?? 'ap-southeast-1',
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    });
    this.queueUrl = config.queueUrl;
  }

  async enqueueWelcome(input: WelcomeEmailJobInput): Promise<void> {
    const body: WelcomeEmailJob = { ...input, enqueuedAt: new Date().toISOString() };
    // Carry the active span context across the queue hop so the worker can
    // resume the same distributed trace.
    const MessageAttributes = injectTraceContextIntoSqsAttrs();
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(body),
        MessageAttributes,
      }),
    );
  }
}
