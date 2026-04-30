import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_PUBLIC_KEY_PEM: z.string().min(1),
  JWT_PRIVATE_KEY_PEM: z.string().min(1),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(604800),
  JWT_ISSUER: z.string().default('lambder'),
  JWT_AUDIENCE: z.string().default('lambder.api'),
});

export type ProductsApiEnv = z.infer<typeof envSchema>;

export const loadConfig = (source: NodeJS.ProcessEnv = process.env): ProductsApiEnv => {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid env: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
  }
  return parsed.data;
};
