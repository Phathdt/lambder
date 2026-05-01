import { describe, expect, test, vi } from 'vitest';
import type { Logger } from '@lambder/shared-kernel';
import { MockEmailProvider } from './mock-email.provider';

const stubLogger = (): Logger =>
  ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    silent: vi.fn(),
    child: vi.fn(),
    level: 'info',
  } as unknown as Logger);

describe('MockEmailProvider', () => {
  test('logs the email payload with `email.sent` event name', async () => {
    const logger = stubLogger();
    const provider = new MockEmailProvider(logger);

    await provider.send({ to: 'x@y.com', subject: 'Hi', body: 'Welcome' });

    expect(logger.info).toHaveBeenCalledWith(
      { to: 'x@y.com', subject: 'Hi', body: 'Welcome' },
      'email.sent',
    );
  });
});
