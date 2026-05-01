import { beforeEach, describe, expect, test, vi } from 'vitest';

const sendMock = vi.fn();
vi.mock('@aws-sdk/client-sqs', () => {
  class FakeSendMessageCommand {
    constructor(public input: unknown) {}
  }
  class FakeSQSClient {
    constructor(public config: unknown) {}
    send = sendMock;
  }
  return { SQSClient: FakeSQSClient, SendMessageCommand: FakeSendMessageCommand };
});

const { SqsEmailEnqueuer } = await import('./sqs-email.enqueuer');

describe('SqsEmailEnqueuer', () => {
  beforeEach(() => sendMock.mockReset().mockResolvedValue({}));

  test('serializes job + adds enqueuedAt then calls SendMessage', async () => {
    const enq = new SqsEmailEnqueuer({
      queueUrl: 'http://localhost:4566/000000000000/test',
      endpoint: 'http://localhost:4566',
    });

    await enq.enqueueWelcome({ userId: 'u', email: 'a@b.com' });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const cmd = sendMock.mock.calls[0]![0] as { input: { QueueUrl: string; MessageBody: string } };
    expect(cmd.input.QueueUrl).toBe('http://localhost:4566/000000000000/test');
    const body = JSON.parse(cmd.input.MessageBody);
    expect(body).toMatchObject({ userId: 'u', email: 'a@b.com' });
    expect(typeof body.enqueuedAt).toBe('string');
    expect(new Date(body.enqueuedAt).toString()).not.toBe('Invalid Date');
  });

  test('propagates SDK errors so caller can decide swallow vs retry', async () => {
    sendMock.mockRejectedValueOnce(new Error('throttled'));
    const enq = new SqsEmailEnqueuer({ queueUrl: 'http://localhost:4566/000000000000/test' });
    await expect(enq.enqueueWelcome({ userId: 'u', email: 'a@b.com' })).rejects.toThrow('throttled');
  });
});
