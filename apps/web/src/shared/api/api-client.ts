import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from './storage';

// Single base URL — points at API Gateway (LocalStack in dev, AWS in prod).
const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/';

export const apiClient = axios.create({
  baseURL,
  headers: { 'content-type': 'application/json' },
});

// Attach access token to every request when present.
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token) config.headers.set('authorization', `Bearer ${token}`);
  return config;
});

// Auto-refresh on 401: exchange the refresh token, replay original request.
// `_retried` flag prevents infinite loops if the refresh itself 401s.
interface RetriableRequest extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

let refreshInflight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) return null;
  try {
    const res = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${baseURL}/auth/refresh`,
      { refreshToken: refresh },
      { headers: { 'content-type': 'application/json' } },
    );
    tokenStorage.setTokens(res.data.accessToken, res.data.refreshToken);
    return res.data.accessToken;
  } catch {
    tokenStorage.clear();
    return null;
  }
}

apiClient.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as RetriableRequest | undefined;
    if (!original || original._retried || error.response?.status !== 401) {
      return Promise.reject(error);
    }
    if (original.url?.includes('/auth/refresh')) {
      tokenStorage.clear();
      return Promise.reject(error);
    }
    original._retried = true;
    refreshInflight ??= refreshAccessToken().finally(() => {
      refreshInflight = null;
    });
    const newToken = await refreshInflight;
    if (!newToken) return Promise.reject(error);
    original.headers.set('authorization', `Bearer ${newToken}`);
    return apiClient.request(original);
  },
);
