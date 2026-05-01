import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_PRIVATE_KEY_PEM: z.string().min(1),
  JWT_PUBLIC_KEY_PEM: z.string().min(1),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(604800),
  JWT_ISSUER: z.string().default('lambder'),
  JWT_AUDIENCE: z.string().default('lambder.api'),
  // SQS queue auth-api publishes welcome-email jobs to. In dev we read from
  // .env (set by `pnpm deploy:local`); in prod from SSM-injected env vars.
  EMAIL_QUEUE_URL: z.string().url(),
  AWS_ENDPOINT_URL: z.string().url().optional(),
  AWS_REGION: z.string().default('ap-southeast-1'),
});

export type AuthApiEnv = z.infer<typeof envSchema>;

export const loadConfig = (source: NodeJS.ProcessEnv = process.env): AuthApiEnv => {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid env: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
  }
  return parsed.data;
};
