import { describe, expect, test } from 'vitest';
import {
  AuthError,
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from './errors';

describe('Domain error hierarchy', () => {
  test('all errors carry a code and inherit from DomainError', () => {
    const cases = [
      new AuthError('A', 'a'),
      new ConflictError('C', 'c'),
      new ForbiddenError('F', 'f'),
      new NotFoundError('N', 'n'),
      new ValidationError('V', 'v'),
    ];
    for (const e of cases) {
      expect(e).toBeInstanceOf(DomainError);
      expect(e.code).toMatch(/^[A-Z]$/);
      expect(e.name).toBe(e.constructor.name);
    }
  });

  test('error name is the subclass name (used by HTTP mapper)', () => {
    expect(new AuthError('X', 'x').name).toBe('AuthError');
    expect(new NotFoundError('X', 'x').name).toBe('NotFoundError');
  });
});
