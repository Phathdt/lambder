import { z } from 'zod';

// Shape of the message that auth-api enqueues and email-worker consumes.
// Lives in `@lambder/contracts` because both producer + consumer need it.
export const welcomeEmailJob = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  enqueuedAt: z.string().datetime(),
});
export type WelcomeEmailJob = z.infer<typeof welcomeEmailJob>;
