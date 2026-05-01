import { AuthError, ConflictError } from '@lambder/shared-kernel';

export const invalidCredentials = () =>
  new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');

export const invalidToken = (message = 'Invalid token') => new AuthError('INVALID_TOKEN', message);

export const tokenReused = () => new AuthError('TOKEN_REUSED', 'Refresh token reuse detected');

export const emailTaken = () => new ConflictError('EMAIL_TAKEN', 'Email already registered');
