import type { Logger } from '@lambder/shared-kernel';
import type { Email } from '../../domain/entities/email';
import type { EmailProvider } from '../../domain/interfaces/email-provider';

// MVP provider: logs the email payload as JSON via pino. Swap for SES/Resend
// later by writing a sibling adapter that implements EmailProvider.
export class MockEmailProvider implements EmailProvider {
  constructor(private readonly logger: Logger) {}

  async send(email: Email): Promise<void> {
    this.logger.info(
      { to: email.to, subject: email.subject, body: email.body },
      'email.sent',
    );
  }
}
