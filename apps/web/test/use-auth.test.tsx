import { describe, expect, test, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/features/auth/hooks/use-auth';
import { authApi } from '@/features/auth/api/auth-api';
import { tokenStorage } from '@/shared/api/storage';

vi.mock('@/features/auth/api/auth-api');
vi.mock('@/shared/api/storage');

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(tokenStorage.getAccess).mockReturnValue(null);
    vi.mocked(tokenStorage.getRefresh).mockReturnValue(null);
    vi.mocked(tokenStorage.setTokens).mockImplementation(() => {});
    vi.mocked(tokenStorage.clear).mockImplementation(() => {});
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  test('loads initial user from token storage on mount', () => {
    // Mock stored JWT token with decoded payload containing sub=u1
    vi.mocked(tokenStorage.getAccess).mockReturnValue('a.eyJzdWIiOiJ1MSJ9.s');

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user?.id).toBe('u1');
    expect(result.current.isAuthenticated).toBe(true);
  });

  test('returns null user when no token in storage', () => {
    vi.mocked(tokenStorage.getAccess).mockReturnValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  test('returns null user when token is malformed', () => {
    // Invalid JWT (no payload part)
    vi.mocked(tokenStorage.getAccess).mockReturnValue('invalid-token');

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  test('login sets user and stores tokens', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      accessToken: 'a.eyJzdWIiOiJ1MiJ9.s',
      refreshToken: 'r.eyJzdWIiOiJ1MiJ9.s',
      expiresIn: 3600,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();

    result.current.login('test@example.com', 'password123');

    await waitFor(() => {
      expect(result.current.user?.id).toBe('u2');
      expect(result.current.user?.email).toBe('test@example.com');
    });

    expect(vi.mocked(authApi.login)).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(vi.mocked(tokenStorage.setTokens)).toHaveBeenCalledWith(
      'a.eyJzdWIiOiJ1MiJ9.s',
      'r.eyJzdWIiOiJ1MiJ9.s',
    );
  });

  test('login handles JWT decode failure gracefully', async () => {
    // Return token with no payload that decodes successfully
    vi.mocked(authApi.login).mockResolvedValueOnce({
      accessToken: 'malformed.token.s',
      refreshToken: 'r.eyJzdWIiOiJ1MiJ9.s',
      expiresIn: 3600,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    result.current.login('test@example.com', 'password123');

    await waitFor(() => {
      expect(result.current.user).toBeTruthy();
    });

    // Should set email and use empty id when decode fails
    expect(result.current.user?.email).toBe('test@example.com');
    expect(result.current.user?.id).toBe('');
  });

  test('signup calls authApi.signup and then logs in', async () => {
    vi.mocked(authApi.signup).mockResolvedValueOnce({
      id: 'u3',
      email: 'newuser@example.com',
    });

    vi.mocked(authApi.login).mockResolvedValueOnce({
      accessToken: 'a.eyJzdWIiOiJ1MyJ9.s',
      refreshToken: 'r.eyJzdWIiOiJ1MyJ9.s',
      expiresIn: 3600,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    result.current.signup('newuser@example.com', 'securepass123');

    await waitFor(() => {
      expect(result.current.user?.id).toBe('u3');
    });

    expect(vi.mocked(authApi.signup)).toHaveBeenCalledWith({
      email: 'newuser@example.com',
      password: 'securepass123',
    });

    expect(vi.mocked(authApi.login)).toHaveBeenCalledWith({
      email: 'newuser@example.com',
      password: 'securepass123',
    });
  });

  test('signup fails when signup API call fails', async () => {
    vi.mocked(authApi.signup).mockRejectedValueOnce(new Error('Email already exists'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    try {
      await result.current.signup('existing@example.com', 'password123');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }

    expect(result.current.user).toBeNull();
  });

  test('logout clears tokens and user state', async () => {
    // Start logged in
    vi.mocked(tokenStorage.getAccess).mockReturnValue('a.eyJzdWIiOiJ1MSJ9.s');
    vi.mocked(authApi.logout).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeTruthy();

    result.current.logout();

    await waitFor(() => {
      expect(result.current.user).toBeNull();
    });

    expect(vi.mocked(authApi.logout)).toHaveBeenCalled();
    expect(vi.mocked(tokenStorage.clear)).toHaveBeenCalled();
  });

  test('logout clears storage even if logout API fails', async () => {
    vi.mocked(tokenStorage.getAccess).mockReturnValue('a.eyJzdWIiOiJ1MSJ9.s');
    vi.mocked(authApi.logout).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeTruthy();

    result.current.logout();

    await waitFor(() => {
      expect(result.current.user).toBeNull();
    });

    // Storage should be cleared despite API error
    expect(vi.mocked(tokenStorage.clear)).toHaveBeenCalled();
  });

  test('isAuthenticated reflects user state', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      accessToken: 'a.eyJzdWIiOiJ1MSJ9.s',
      refreshToken: 'r.eyJzdWIiOiJ1MSJ9.s',
      expiresIn: 3600,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);

    result.current.login('test@example.com', 'password123');

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    vi.mocked(authApi.logout).mockResolvedValueOnce(undefined);

    result.current.logout();

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  test('throws error when useAuth is used outside AuthProvider', () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used inside <AuthProvider>');
  });
});
