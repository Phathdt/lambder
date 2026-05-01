import { describe, expect, test } from 'vitest';
import { LogoutService } from './logout.service';
import { createFakeTokenStore } from '../../__test-fakes__/fakes';

describe('LogoutService', () => {
  test('revokes the specific (userId, jti) pair', async () => {
    const tokens = createFakeTokenStore();
    await tokens.whitelist('u1', 'jti-1', 60);
    await tokens.whitelist('u1', 'jti-2', 60);

    await new LogoutService(tokens).execute({ userId: 'u1', jti: 'jti-1' });

    expect(await tokens.isWhitelisted('u1', 'jti-1')).toBe(false);
    expect(await tokens.isWhitelisted('u1', 'jti-2')).toBe(true);
  });

  test('is idempotent on missing entries', async () => {
    const tokens = createFakeTokenStore();
    await expect(
      new LogoutService(tokens).execute({ userId: 'u1', jti: 'missing' }),
    ).resolves.toBeUndefined();
  });
});
