import type { Email } from '../entities/email';

// Outbound port for sending an email. Adapters: MockEmailProvider (logs),
// later SES/Resend/Postmark providers.
export interface EmailProvider {
  send(email: Email): Promise<void>;
}
