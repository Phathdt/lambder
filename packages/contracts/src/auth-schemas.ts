import { z } from 'zod';

const strongPassword = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/\d/, 'Password must contain a digit')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain a symbol');

export const signupBody = z.object({
  email: z.string().email().max(255),
  password: strongPassword,
});
export type SignupBody = z.infer<typeof signupBody>;

export const loginBody = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(255),
});
export type LoginBody = z.infer<typeof loginBody>;

export const refreshBody = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshBody = z.infer<typeof refreshBody>;

export const tokenPair = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
});
export type TokenPair = z.infer<typeof tokenPair>;

export const publicUser = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
});
export type PublicUser = z.infer<typeof publicUser>;
