import { describe, expect, test } from 'vitest';
import { err, isErr, isOk, ok } from './result';

describe('Result', () => {
  test('ok wraps a value', () => {
    const r = ok(42);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value).toBe(42);
  });

  test('err wraps an error', () => {
    const r = err(new Error('boom'));
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.message).toBe('boom');
  });

  test('type guards are mutually exclusive', () => {
    const o = ok(1);
    const e = err('x');
    expect(isOk(o)).toBe(true);
    expect(isErr(o)).toBe(false);
    expect(isOk(e)).toBe(false);
    expect(isErr(e)).toBe(true);
  });
});
