import type { Email } from '../domain/entities/email';
import type { EmailProvider } from '../domain/interfaces/email-provider';
import type {
  EmailEnqueuer,
  WelcomeEmailJob,
  WelcomeEmailJobInput,
} from '../domain/interfaces/email-enqueuer';

export interface InMemoryEmailEnqueuer extends EmailEnqueuer {
  readonly calls: WelcomeEmailJob[];
  failNext(message?: string): void;
}

export const createInMemoryEmailEnqueuer = (): InMemoryEmailEnqueuer => {
  const calls: WelcomeEmailJob[] = [];
  let nextError: Error | null = null;
  return {
    calls,
    failNext(message = 'enqueue failure (test)') {
      nextError = new Error(message);
    },
    async enqueueWelcome(input: WelcomeEmailJobInput) {
      if (nextError) {
        const e = nextError;
        nextError = null;
        throw e;
      }
      calls.push({ ...input, enqueuedAt: new Date().toISOString() });
    },
  };
};

export interface BufferedEmailProvider extends EmailProvider {
  readonly sent: Email[];
}

export const createBufferedEmailProvider = (): BufferedEmailProvider => {
  const sent: Email[] = [];
  return {
    sent,
    async send(email) {
      sent.push(email);
    },
  };
};
