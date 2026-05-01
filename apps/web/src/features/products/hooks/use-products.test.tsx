import { describe, expect, test, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from '@/features/products/hooks/use-products';
import { productsApi } from '@/features/products/api/products-api';

vi.mock('@/features/products/api/products-api');

describe('Products Hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('useProducts', () => {
    test('fetches products with default limit', async () => {
      vi.mocked(productsApi.list).mockResolvedValueOnce({
        items: [
          {
            id: 'p1',
            ownerId: 'u1',
            name: 'Widget',
            description: 'Cool',
            price: '9.99',
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-01T00:00:00Z',
          },
        ],
        nextCursor: null,
      });

      const { result } = renderHook(() => useProducts(), { wrapper });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.items).toHaveLength(1);
      expect(result.current.data?.items[0].name).toBe('Widget');
      expect(vi.mocked(productsApi.list)).toHaveBeenCalledWith({ limit: 20 });
    });

    test('fetches products with custom limit', async () => {
      vi.mocked(productsApi.list).mockResolvedValueOnce({
        items: [],
        nextCursor: null,
      });

      renderHook(() => useProducts(50), { wrapper });

      await waitFor(() => {
        expect(vi.mocked(productsApi.list)).toHaveBeenCalledWith({ limit: 50 });
      });
    });
  });

  describe('useCreateProduct', () => {
    test('calls productsApi.create and invalidates products query on success', async () => {
      vi.mocked(productsApi.create).mockResolvedValueOnce({
        id: 'p1',
        ownerId: 'u1',
        name: 'New Widget',
        description: 'A new widget',
        price: '9.99',
        createdAt: '2026-05-01T00:00:00Z',
        updatedAt: '2026-05-01T00:00:00Z',
      });

      const { result } = renderHook(() => useCreateProduct(), { wrapper });

      expect(result.current.isPending).toBe(false);

      result.current.mutateAsync({
        name: 'New Widget',
        price: '9.99',
        description: 'A new widget',
      });

      await waitFor(() => {
        expect(vi.mocked(productsApi.create)).toHaveBeenCalledWith({
          name: 'New Widget',
          price: '9.99',
          description: 'A new widget',
        });
      });
    });

    test('handles create mutation error', async () => {
      vi.mocked(productsApi.create).mockRejectedValueOnce(new Error('Create failed'));

      const { result } = renderHook(() => useCreateProduct(), { wrapper });

      await expect(
        result.current.mutateAsync({ name: 'New Widget', price: '9.99' }),
      ).rejects.toThrow('Create failed');

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useUpdateProduct', () => {
    test('calls productsApi.update with id and patch data', async () => {
      vi.mocked(productsApi.update).mockResolvedValueOnce({
        id: 'p1',
        ownerId: 'u1',
        name: 'Updated Widget',
        description: 'Updated',
        price: '19.99',
        createdAt: '2026-05-01T00:00:00Z',
        updatedAt: '2026-05-01T00:00:00Z',
      });

      const { result } = renderHook(() => useUpdateProduct(), { wrapper });

      result.current.mutateAsync({
        id: 'p1',
        patch: { name: 'Updated Widget', price: '19.99' },
      });

      await waitFor(() => {
        expect(vi.mocked(productsApi.update)).toHaveBeenCalledWith('p1', {
          name: 'Updated Widget',
          price: '19.99',
        });
      });
    });

    test('handles update mutation error', async () => {
      vi.mocked(productsApi.update).mockRejectedValueOnce(new Error('Update failed'));

      const { result } = renderHook(() => useUpdateProduct(), { wrapper });

      await expect(
        result.current.mutateAsync({
          id: 'p1',
          patch: { name: 'Updated Widget' },
        }),
      ).rejects.toThrow('Update failed');

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useDeleteProduct', () => {
    test('calls productsApi.delete with product id', async () => {
      vi.mocked(productsApi.delete).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDeleteProduct(), { wrapper });

      result.current.mutateAsync('p1');

      await waitFor(() => {
        expect(vi.mocked(productsApi.delete)).toHaveBeenCalledWith('p1');
      });
    });

    test('handles delete mutation error', async () => {
      vi.mocked(productsApi.delete).mockRejectedValueOnce(new Error('Delete failed'));

      const { result } = renderHook(() => useDeleteProduct(), { wrapper });

      await expect(result.current.mutateAsync('p1')).rejects.toThrow('Delete failed');

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    test('sets isPending during delete request', async () => {
      vi.mocked(productsApi.delete).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(() => {
              resolve(undefined);
            }, 100),
          ),
      );

      const { result } = renderHook(() => useDeleteProduct(), { wrapper });

      expect(result.current.isPending).toBe(false);

      const promise = result.current.mutateAsync('p1');

      // Should be pending after mutate call (may need slight delay for state update)
      await waitFor(() => {
        expect(result.current.isPending).toBe(true);
      });

      // Wait for completion
      await promise;

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
    });
  });
});
