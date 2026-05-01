import type { SQSEvent } from 'aws-lambda';
import { describe, expect, test, vi } from 'vitest';
import { buildEmailWorker } from './app';
import type { Logger } from '@lambder/shared-kernel';

const stubLogger = (): Logger => {
  const child = vi.fn();
  const log = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    silent: vi.fn(),
    child,
  } as unknown as Logger;
  child.mockReturnValue(log);
  return log;
};

const makeEvent = (records: { messageId: string; body: string }[]): SQSEvent => ({
  Records: records.map((r) => ({
    messageId: r.messageId,
    receiptHandle: `receipt-${r.messageId}`,
    body: r.body,
    attributes: {} as never,
    messageAttributes: {},
    md5OfBody: '',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:test',
    awsRegion: 'ap-southeast-1',
  })),
});

const validJob = (id = 'm1') =>
  JSON.stringify({
    userId: '00000000-0000-4000-8000-000000000000',
    email: 'a@b.com',
    enqueuedAt: '2026-05-01T00:00:00.000Z',
  });

describe('buildEmailWorker', () => {
  test('processes valid record and returns no failures', async () => {
    const logger = stubLogger();
    const worker = buildEmailWorker({ logger });
    const result = await worker.handle(makeEvent([{ messageId: 'm1', body: validJob() }]));
    expect(result.batchItemFailures).toEqual([]);
  });

  test('records batchItemFailure for malformed JSON', async () => {
    const logger = stubLogger();
    const worker = buildEmailWorker({ logger });
    const result = await worker.handle(makeEvent([{ messageId: 'bad', body: 'not-json' }]));
    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'bad' }]);
  });

  test('records batchItemFailure for schema-invalid payload', async () => {
    const logger = stubLogger();
    const worker = buildEmailWorker({ logger });
    const event = makeEvent([
      { messageId: 'bad', body: JSON.stringify({ userId: 'not-uuid', email: 'x' }) },
    ]);
    const result = await worker.handle(event);
    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'bad' }]);
  });

  test('mixed batch: good + bad → only bad reported as failure', async () => {
    const logger = stubLogger();
    const worker = buildEmailWorker({ logger });
    const result = await worker.handle(
      makeEvent([
        { messageId: 'ok', body: validJob() },
        { messageId: 'bad', body: 'not-json' },
      ]),
    );
    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'bad' }]);
  });

  test('reports failure when WelcomeEmailService throws', async () => {
    const logger = stubLogger();
    const worker = buildEmailWorker({
      logger,
      service: { execute: vi.fn().mockRejectedValue(new Error('provider down')) } as never,
    });
    const result = await worker.handle(makeEvent([{ messageId: 'oops', body: validJob() }]));
    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'oops' }]);
    expect(logger.child).toHaveBeenCalled();
  });
});
