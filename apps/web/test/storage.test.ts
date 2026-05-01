import { describe, expect, test, beforeEach } from 'vitest';
import { tokenStorage } from '@/shared/api/storage';

describe('tokenStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getAccess', () => {
    test('returns null when no access token stored', () => {
      const token = tokenStorage.getAccess();
      expect(token).toBeNull();
    });

    test('returns stored access token', () => {
      localStorage.setItem('lambder.accessToken', 'access-token-123');

      const token = tokenStorage.getAccess();
      expect(token).toBe('access-token-123');
    });

    test('returns most recent access token after setTokens', () => {
      tokenStorage.setTokens('first-access', 'first-refresh');
      expect(tokenStorage.getAccess()).toBe('first-access');

      tokenStorage.setTokens('second-access', 'second-refresh');
      expect(tokenStorage.getAccess()).toBe('second-access');
    });
  });

  describe('getRefresh', () => {
    test('returns null when no refresh token stored', () => {
      const token = tokenStorage.getRefresh();
      expect(token).toBeNull();
    });

    test('returns stored refresh token', () => {
      localStorage.setItem('lambder.refreshToken', 'refresh-token-123');

      const token = tokenStorage.getRefresh();
      expect(token).toBe('refresh-token-123');
    });

    test('returns most recent refresh token after setTokens', () => {
      tokenStorage.setTokens('first-access', 'first-refresh');
      expect(tokenStorage.getRefresh()).toBe('first-refresh');

      tokenStorage.setTokens('second-access', 'second-refresh');
      expect(tokenStorage.getRefresh()).toBe('second-refresh');
    });
  });

  describe('setTokens', () => {
    test('stores both access and refresh tokens', () => {
      tokenStorage.setTokens('my-access-token', 'my-refresh-token');

      expect(localStorage.getItem('lambder.accessToken')).toBe('my-access-token');
      expect(localStorage.getItem('lambder.refreshToken')).toBe('my-refresh-token');
    });

    test('overwrites existing tokens', () => {
      tokenStorage.setTokens('old-access', 'old-refresh');
      expect(tokenStorage.getAccess()).toBe('old-access');
      expect(tokenStorage.getRefresh()).toBe('old-refresh');

      tokenStorage.setTokens('new-access', 'new-refresh');
      expect(tokenStorage.getAccess()).toBe('new-access');
      expect(tokenStorage.getRefresh()).toBe('new-refresh');
    });

    test('stores tokens with long-lived values', () => {
      const longAccessToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const longRefreshToken = 'refresh_token_' + 'x'.repeat(500);

      tokenStorage.setTokens(longAccessToken, longRefreshToken);

      expect(tokenStorage.getAccess()).toBe(longAccessToken);
      expect(tokenStorage.getRefresh()).toBe(longRefreshToken);
    });
  });

  describe('clear', () => {
    test('removes both access and refresh tokens', () => {
      tokenStorage.setTokens('access-token', 'refresh-token');
      expect(tokenStorage.getAccess()).toBe('access-token');
      expect(tokenStorage.getRefresh()).toBe('refresh-token');

      tokenStorage.clear();

      expect(tokenStorage.getAccess()).toBeNull();
      expect(tokenStorage.getRefresh()).toBeNull();
    });

    test('can be called when no tokens are stored', () => {
      expect(tokenStorage.getAccess()).toBeNull();
      expect(tokenStorage.getRefresh()).toBeNull();

      // Should not throw
      tokenStorage.clear();

      expect(tokenStorage.getAccess()).toBeNull();
      expect(tokenStorage.getRefresh()).toBeNull();
    });

    test('completely removes localStorage entries', () => {
      tokenStorage.setTokens('access', 'refresh');
      expect(localStorage.getItem('lambder.accessToken')).toBe('access');
      expect(localStorage.getItem('lambder.refreshToken')).toBe('refresh');

      tokenStorage.clear();

      expect(localStorage.getItem('lambder.accessToken')).toBeNull();
      expect(localStorage.getItem('lambder.refreshToken')).toBeNull();
    });

    test('leaves other localStorage keys untouched', () => {
      localStorage.setItem('other-key', 'other-value');
      tokenStorage.setTokens('access', 'refresh');

      tokenStorage.clear();

      expect(localStorage.getItem('other-key')).toBe('other-value');
      expect(tokenStorage.getAccess()).toBeNull();
    });
  });

  describe('integration scenarios', () => {
    test('lifecycle: set, get, clear', () => {
      // Initial state
      expect(tokenStorage.getAccess()).toBeNull();

      // After login
      tokenStorage.setTokens('token-1', 'refresh-1');
      expect(tokenStorage.getAccess()).toBe('token-1');

      // After token refresh
      tokenStorage.setTokens('token-2', 'refresh-2');
      expect(tokenStorage.getAccess()).toBe('token-2');

      // After logout
      tokenStorage.clear();
      expect(tokenStorage.getAccess()).toBeNull();
      expect(tokenStorage.getRefresh()).toBeNull();
    });

    test('independent token management', () => {
      // Can set access without affecting refresh retrieval
      localStorage.setItem('lambder.accessToken', 'access-only');

      expect(tokenStorage.getAccess()).toBe('access-only');
      expect(tokenStorage.getRefresh()).toBeNull();

      // Can set refresh without affecting access
      localStorage.setItem('lambder.refreshToken', 'refresh-only');

      expect(tokenStorage.getAccess()).toBe('access-only');
      expect(tokenStorage.getRefresh()).toBe('refresh-only');
    });
  });
});
