import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { tokenStorage } from '@/shared/api/storage';
import { authApi, type PublicUser } from '../api/auth-api';

interface AuthState {
  user: PublicUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Decode the JWT payload (no signature check — that's the API's job).
function decodeJwt<T>(token: string): T | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as T;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);

  // Hydrate from access token on mount.
  useEffect(() => {
    const token = tokenStorage.getAccess();
    if (!token) return;
    const claims = decodeJwt<{ sub: string }>(token);
    if (claims?.sub) setUser({ id: claims.sub, email: '' });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await authApi.login({ email, password });
    tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
    const claims = decodeJwt<{ sub: string }>(tokens.accessToken);
    setUser({ id: claims?.sub ?? '', email });
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    await authApi.signup({ email, password });
    await login(email, password);
  }, [login]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore — clear locally anyway */
    }
    tokenStorage.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, isAuthenticated: !!user, login, signup, logout }),
    [user, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
