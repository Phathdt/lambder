import { describe, expect, test, vi, beforeEach } from 'vitest';
import { apiClient } from '@/shared/api/api-client';
import { authApi, type PublicUser, type TokenPair } from '@/features/auth/api/auth-api';

vi.mock('@/shared/api/api-client');

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signup', () => {
    test('calls apiClient.post with correct endpoint and body', async () => {
      const mockUser: PublicUser = { id: 'u1', email: 'test@example.com' };
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { user: mockUser },
      });

      const result = await authApi.signup({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(vi.mocked(apiClient.post)).toHaveBeenCalledWith('/auth/signup', {
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual(mockUser);
    });

    test('returns user object from response', async () => {
      const mockUser: PublicUser = { id: 'u123', email: 'newuser@example.com' };
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { user: mockUser },
      });

      const result = await authApi.signup({
        email: 'newuser@example.com',
        password: 'securepass',
      });

      expect(result.id).toBe('u123');
      expect(result.email).toBe('newuser@example.com');
    });
  });

  describe('login', () => {
    test('calls apiClient.post with correct endpoint and body', async () => {
      const mockTokens: TokenPair = {
        accessToken: 'access.token',
        refreshToken: 'refresh.token',
        expiresIn: 3600,
      };
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: mockTokens,
      });

      const result = await authApi.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(vi.mocked(apiClient.post)).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual(mockTokens);
    });

    test('returns token pair from response', async () => {
      const mockTokens: TokenPair = {
        accessToken: 'eyJhbGc...',
        refreshToken: 'refresh123',
        expiresIn: 7200,
      };
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: mockTokens,
      });

      const result = await authApi.login({
        email: 'user@example.com',
        password: 'password',
      });

      expect(result.accessToken).toBe('eyJhbGc...');
      expect(result.refreshToken).toBe('refresh123');
      expect(result.expiresIn).toBe(7200);
    });
  });

  describe('logout', () => {
    test('calls apiClient.post with correct endpoint', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: undefined,
      });

      await authApi.logout();

      expect(vi.mocked(apiClient.post)).toHaveBeenCalledWith('/auth/logout');
    });

    test('returns undefined on logout success', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: undefined,
      });

      const result = await authApi.logout();

      expect(result).toBeUndefined();
    });

    test('propagates API errors', async () => {
      const error = new Error('Network error');
      vi.mocked(apiClient.post).mockRejectedValueOnce(error);

      await expect(authApi.logout()).rejects.toThrow('Network error');
    });
  });
});
