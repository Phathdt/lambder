// Outbound port: queue a welcome-email job for async delivery.
// Adapters: SqsEmailEnqueuer (production), InMemoryEmailEnqueuer (tests).
export interface WelcomeEmailJob {
  readonly userId: string;
  readonly email: string;
  readonly enqueuedAt: string; // ISO timestamp
}

export type WelcomeEmailJobInput = Omit<WelcomeEmailJob, 'enqueuedAt'>;

export interface EmailEnqueuer {
  enqueueWelcome(job: WelcomeEmailJobInput): Promise<void>;
}
