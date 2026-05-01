import { apiClient } from '@/shared/api/api-client';

export interface PublicUser {
  id: string;
  email: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export const authApi = {
  signup: (body: { email: string; password: string }) =>
    apiClient.post<{ user: PublicUser }>('/auth/signup', body).then((r) => r.data.user),
  login: (body: { email: string; password: string }) =>
    apiClient.post<TokenPair>('/auth/login', body).then((r) => r.data),
  logout: () => apiClient.post<void>('/auth/logout').then((r) => r.data),
};
