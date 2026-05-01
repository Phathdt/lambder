import type { Email } from '../../domain/entities/email';
import type { EmailProvider } from '../../domain/interfaces/email-provider';
import type { WelcomeEmailJob } from '../../domain/interfaces/email-enqueuer';

// Renders the welcome email body and dispatches via the configured provider.
// Kept dumb on purpose; templating engine is a future concern.
export class WelcomeEmailService {
  constructor(private readonly provider: EmailProvider) {}

  async execute(job: WelcomeEmailJob): Promise<void> {
    const email: Email = {
      to: job.email,
      subject: 'Welcome to Lambder',
      body: `Hi! Your user id is ${job.userId}. Thanks for signing up.`,
    };
    await this.provider.send(email);
  }
}
