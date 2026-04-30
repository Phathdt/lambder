import {
  AuthError,
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@lambder/shared-kernel';
import type { Context } from 'hono';
import { ZodError } from 'zod';

const statusFor = (e: DomainError): number => {
  if (e instanceof AuthError) return 401;
  if (e instanceof ForbiddenError) return 403;
  if (e instanceof NotFoundError) return 404;
  if (e instanceof ConflictError) return 409;
  if (e instanceof ValidationError) return 400;
  return 500;
};

export const mapError = (err: unknown, c: Context) => {
  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: err.flatten().fieldErrors,
        },
      },
      400,
    );
  }
  if (err instanceof DomainError) {
    return c.json({ error: { code: err.code, message: err.message } }, statusFor(err) as 400);
  }
  console.error('Unhandled error', err);
  return c.json({ error: { code: 'INTERNAL', message: 'Internal server error' } }, 500);
};

export const errorMapper = async (err: Error, c: Context) => mapError(err, c);
