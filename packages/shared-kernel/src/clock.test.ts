import { describe, expect, test, vi } from 'vitest';
import { SystemClock } from './clock';

describe('SystemClock', () => {
  const clock = new SystemClock();

  test('now() returns a Date instance', () => {
    const result = clock.now();
    expect(result).toBeInstanceOf(Date);
  });

  test('now() returns current time within reasonable bounds', () => {
    const before = Date.now();
    const result = clock.now();
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });

  test('nowSeconds() returns current unix timestamp in seconds', () => {
    const before = Math.floor(Date.now() / 1000);
    const result = clock.nowSeconds();
    const after = Math.floor(Date.now() / 1000);
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  test('nowSeconds() returns an integer (floored)', () => {
    const result = clock.nowSeconds();
    expect(result).toStrictEqual(Math.floor(result));
  });

  test('now() and nowSeconds() are reasonably consistent', () => {
    const dateMs = clock.now().getTime();
    const seconds = clock.nowSeconds();
    const secondsMs = seconds * 1000;
    // Allow 1000ms margin for execution time
    expect(Math.abs(dateMs - secondsMs)).toBeLessThan(1000);
  });
});
