import { describe, expect, test } from 'vitest';
import { createBufferedEmailProvider } from '../../__test-fakes__/fakes';
import { WelcomeEmailService } from './welcome-email.service';

describe('WelcomeEmailService', () => {
  test('renders welcome email and dispatches via provider', async () => {
    const provider = createBufferedEmailProvider();
    const svc = new WelcomeEmailService(provider);

    await svc.execute({
      userId: 'u-1',
      email: 'a@b.com',
      enqueuedAt: '2026-05-01T00:00:00.000Z',
    });

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]).toMatchObject({
      to: 'a@b.com',
      subject: 'Welcome to Lambder',
    });
    expect(provider.sent[0]?.body).toContain('u-1');
  });
});
