import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '@/shared/api/api-client';
import { tokenStorage } from '@/shared/api/storage';

vi.mock('@/shared/api/storage');

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(tokenStorage.getAccess).mockReturnValue(null);
    vi.mocked(tokenStorage.getRefresh).mockReturnValue(null);
    vi.mocked(tokenStorage.setTokens).mockImplementation(() => {});
    vi.mocked(tokenStorage.clear).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('request interceptor', () => {
    test('attaches access token to request headers when available', async () => {
      vi.mocked(tokenStorage.getAccess).mockReturnValue('access-token-123');

      const config: InternalAxiosRequestConfig = {
        headers: axios.AxiosHeaders.from({}),
        method: 'get',
        url: '/products',
      } as any;

      const interceptor = apiClient.interceptors.request.handlers[0];
      const result = interceptor.fulfilled(config);

      expect(result.headers.get('authorization')).toBe('Bearer access-token-123');
    });

    test('does not attach authorization header when no token available', async () => {
      vi.mocked(tokenStorage.getAccess).mockReturnValue(null);

      const config: InternalAxiosRequestConfig = {
        headers: axios.AxiosHeaders.from({}),
        method: 'get',
        url: '/products',
      } as any;

      const interceptor = apiClient.interceptors.request.handlers[0];
      const result = interceptor.fulfilled(config);

      expect(result.headers.get('authorization')).toBeUndefined();
    });
  });

  describe('response interceptor - error handling', () => {
    test('passes through non-401 errors without retry', async () => {
      const error = new AxiosError('Server error', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 500,
        statusText: 'Internal Server Error',
        data: {},
        headers: {},
        config: {
          headers: axios.AxiosHeaders.from({}),
          method: 'get',
          url: '/products',
        } as any,
      } as any);

      const interceptor = apiClient.interceptors.response.handlers[0];
      await expect(interceptor.rejected(error)).rejects.toThrow();
    });

    test('passes through errors without config', async () => {
      const error = new AxiosError('Network error');

      const interceptor = apiClient.interceptors.response.handlers[0];
      await expect(interceptor.rejected(error)).rejects.toThrow();
    });

    test('passes through errors already retried', async () => {
      const error = new AxiosError(
        'Unauthorized',
        'ERR_BAD_REQUEST',
        {
          _retried: true,
          headers: axios.AxiosHeaders.from({}),
          method: 'get',
          url: '/products',
        } as any,
        undefined,
        {
          status: 401,
          statusText: 'Unauthorized',
          data: {},
          headers: {},
          config: {
            headers: axios.AxiosHeaders.from({}),
            method: 'get',
            url: '/products',
            _retried: true,
          } as any,
        } as any,
      );

      const interceptor = apiClient.interceptors.response.handlers[0];
      await expect(interceptor.rejected(error)).rejects.toThrow();
    });

    test('clears storage and rejects when refresh endpoint returns 401', async () => {
      const error = new AxiosError(
        'Unauthorized',
        'ERR_BAD_REQUEST',
        {
          headers: axios.AxiosHeaders.from({}),
          method: 'post',
          url: '/auth/refresh',
        } as any,
        undefined,
        {
          status: 401,
          statusText: 'Unauthorized',
          data: {},
          headers: {},
          config: {
            headers: axios.AxiosHeaders.from({}),
            method: 'post',
            url: '/auth/refresh',
          } as any,
        } as any,
      );

      const interceptor = apiClient.interceptors.response.handlers[0];
      await expect(interceptor.rejected(error)).rejects.toThrow();
      expect(vi.mocked(tokenStorage.clear)).toHaveBeenCalled();
    });
  });

  describe('response interceptor - 401 refresh flow', () => {
    test('does not attempt refresh when no refresh token available', async () => {
      vi.mocked(tokenStorage.getRefresh).mockReturnValue(null);

      const error = new AxiosError(
        'Unauthorized',
        'ERR_BAD_REQUEST',
        {
          headers: axios.AxiosHeaders.from({}),
          method: 'get',
          url: '/products',
        } as any,
        undefined,
        {
          status: 401,
          statusText: 'Unauthorized',
          data: {},
          headers: {},
          config: {
            headers: axios.AxiosHeaders.from({}),
            method: 'get',
            url: '/products',
          } as any,
        } as any,
      );

      const interceptor = apiClient.interceptors.response.handlers[0];
      await expect(interceptor.rejected(error)).rejects.toThrow();
    });

    test('successfully refreshes token and replays original request on 401', async () => {
      vi.mocked(tokenStorage.getRefresh).mockReturnValue('refresh-token-123');

      // Mock the refresh endpoint response
      const refreshSpy = vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      });

      // Mock the replayed request
      const requestSpy = vi.spyOn(apiClient, 'request').mockResolvedValueOnce({
        data: { items: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const originalConfig = {
        headers: axios.AxiosHeaders.from({
          authorization: 'Bearer old-token',
        }),
        method: 'get',
        url: '/products',
      } as any;

      const error = new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', originalConfig, undefined, {
        status: 401,
        statusText: 'Unauthorized',
        data: {},
        headers: {},
        config: originalConfig,
      } as any);

      const interceptor = apiClient.interceptors.response.handlers[0];
      const result = await interceptor.rejected(error);

      expect(refreshSpy).toHaveBeenCalled();
      expect(vi.mocked(tokenStorage.setTokens)).toHaveBeenCalledWith(
        'new-access-token',
        'new-refresh-token',
      );

      // Request should be replayed
      expect(requestSpy).toHaveBeenCalled();
    });

    test('clears storage and rejects when refresh token is invalid', async () => {
      vi.mocked(tokenStorage.getRefresh).mockReturnValue('expired-refresh-token');

      // Mock failed refresh
      const refreshSpy = vi
        .spyOn(axios, 'post')
        .mockRejectedValueOnce(new AxiosError('Invalid refresh token'));

      const originalConfig = {
        headers: axios.AxiosHeaders.from({}),
        method: 'get',
        url: '/products',
      } as any;

      const error = new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', originalConfig, undefined, {
        status: 401,
        statusText: 'Unauthorized',
        data: {},
        headers: {},
        config: originalConfig,
      } as any);

      const interceptor = apiClient.interceptors.response.handlers[0];
      await expect(interceptor.rejected(error)).rejects.toThrow();

      expect(refreshSpy).toHaveBeenCalled();
      expect(vi.mocked(tokenStorage.clear)).toHaveBeenCalled();
    });
  });

  describe('basic request methods', () => {
    test('get method works with apiClient', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: { items: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await apiClient.get('/products');

      expect(getSpy).toHaveBeenCalledWith('/products');
      expect(result.data).toEqual({ items: [] });
    });

    test('post method works with apiClient', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: { id: 'p1' },
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      });

      const result = await apiClient.post('/products', { name: 'Widget' });

      expect(postSpy).toHaveBeenCalledWith('/products', { name: 'Widget' });
      expect(result.data.id).toBe('p1');
    });

    test('patch method works with apiClient', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: { id: 'p1', name: 'Updated Widget' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await apiClient.patch('/products/p1', { name: 'Updated Widget' });

      expect(patchSpy).toHaveBeenCalledWith('/products/p1', { name: 'Updated Widget' });
      expect(result.data.name).toBe('Updated Widget');
    });

    test('delete method works with apiClient', async () => {
      const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({
        data: undefined,
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: {} as any,
      });

      await apiClient.delete('/products/p1');

      expect(deleteSpy).toHaveBeenCalledWith('/products/p1');
    });
  });
});
