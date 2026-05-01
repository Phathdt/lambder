import { describe, expect, test, vi, beforeEach } from 'vitest';
import { apiClient } from '@/shared/api/api-client';
import {
  productsApi,
  type ProductDto,
  type ProductPage,
  type CreateProductInput,
  type UpdateProductInput,
} from '@/features/products/api/products-api';

vi.mock('@/shared/api/api-client');

describe('productsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProduct: ProductDto = {
    id: 'p1',
    ownerId: 'u1',
    name: 'Widget',
    description: 'A cool widget',
    price: '9.99',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
  };

  describe('list', () => {
    test('calls apiClient.get with correct endpoint and default limit', async () => {
      const mockPage: ProductPage = { items: [mockProduct], nextCursor: null };
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockPage });

      const result = await productsApi.list();

      expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith('/products', {
        params: { limit: undefined, cursor: undefined },
      });

      expect(result).toEqual(mockPage);
    });

    test('calls apiClient.get with custom limit and cursor', async () => {
      const mockPage: ProductPage = { items: [mockProduct], nextCursor: 'next-cursor' };
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockPage });

      const result = await productsApi.list({ limit: 50, cursor: 'cursor-123' });

      expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith('/products', {
        params: { limit: 50, cursor: 'cursor-123' },
      });

      expect(result).toEqual(mockPage);
    });

    test('returns product page with items and cursor', async () => {
      const mockPage: ProductPage = {
        items: [mockProduct, { ...mockProduct, id: 'p2' }],
        nextCursor: 'next-page-cursor',
      };
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockPage });

      const result = await productsApi.list({ limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe('next-page-cursor');
    });
  });

  describe('get', () => {
    test('calls apiClient.get with correct endpoint for product id', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockProduct });

      const result = await productsApi.get('p1');

      expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith('/products/p1');
      expect(result).toEqual(mockProduct);
    });

    test('returns single product object', async () => {
      const product: ProductDto = {
        ...mockProduct,
        id: 'p-unique-123',
        name: 'Special Widget',
      };
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: product });

      const result = await productsApi.get('p-unique-123');

      expect(result.id).toBe('p-unique-123');
      expect(result.name).toBe('Special Widget');
    });
  });

  describe('create', () => {
    test('calls apiClient.post with correct endpoint and body', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockProduct });

      const input: CreateProductInput = {
        name: 'Widget',
        price: '9.99',
        description: 'A cool widget',
      };

      const result = await productsApi.create(input);

      expect(vi.mocked(apiClient.post)).toHaveBeenCalledWith('/products', input);
      expect(result).toEqual(mockProduct);
    });

    test('creates product without optional description', async () => {
      const productNoDesc: ProductDto = {
        ...mockProduct,
        description: null,
      };
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: productNoDesc });

      const input: CreateProductInput = {
        name: 'Widget',
        price: '9.99',
      };

      const result = await productsApi.create(input);

      expect(vi.mocked(apiClient.post)).toHaveBeenCalledWith('/products', input);
      expect(result.description).toBeNull();
    });

    test('returns created product from response', async () => {
      const newProduct: ProductDto = {
        id: 'p-new-123',
        ownerId: 'u-current',
        name: 'Brand New Widget',
        description: 'Fresh',
        price: '19.99',
        createdAt: '2026-05-01T12:00:00Z',
        updatedAt: '2026-05-01T12:00:00Z',
      };
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: newProduct });

      const input: CreateProductInput = {
        name: 'Brand New Widget',
        price: '19.99',
        description: 'Fresh',
      };

      const result = await productsApi.create(input);

      expect(result.id).toBe('p-new-123');
      expect(result.name).toBe('Brand New Widget');
      expect(result.ownerId).toBe('u-current');
    });
  });

  describe('update', () => {
    test('calls apiClient.patch with correct endpoint, id, and body', async () => {
      const updatedProduct: ProductDto = {
        ...mockProduct,
        name: 'Updated Widget',
        price: '19.99',
      };
      vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: updatedProduct });

      const patch: UpdateProductInput = {
        name: 'Updated Widget',
        price: '19.99',
      };

      const result = await productsApi.update('p1', patch);

      expect(vi.mocked(apiClient.patch)).toHaveBeenCalledWith('/products/p1', patch);
      expect(result.name).toBe('Updated Widget');
      expect(result.price).toBe('19.99');
    });

    test('updates with partial patch data', async () => {
      const updatedProduct: ProductDto = {
        ...mockProduct,
        description: 'New description',
      };
      vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: updatedProduct });

      const patch: UpdateProductInput = {
        description: 'New description',
      };

      const result = await productsApi.update('p1', patch);

      expect(vi.mocked(apiClient.patch)).toHaveBeenCalledWith('/products/p1', patch);
      expect(result.description).toBe('New description');
    });

    test('returns updated product from response', async () => {
      const updatedProduct: ProductDto = {
        ...mockProduct,
        name: 'Final Widget',
        price: '29.99',
        updatedAt: '2026-05-02T00:00:00Z',
      };
      vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: updatedProduct });

      const patch: UpdateProductInput = {
        name: 'Final Widget',
        price: '29.99',
      };

      const result = await productsApi.update('p1', patch);

      expect(result.name).toBe('Final Widget');
      expect(result.price).toBe('29.99');
      expect(result.updatedAt).toBe('2026-05-02T00:00:00Z');
    });
  });

  describe('delete', () => {
    test('calls apiClient.delete with correct endpoint', async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: undefined });

      const result = await productsApi.delete('p1');

      expect(vi.mocked(apiClient.delete)).toHaveBeenCalledWith('/products/p1');
      expect(result).toBeUndefined();
    });

    test('returns undefined on successful delete', async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: undefined });

      const result = await productsApi.delete('p-any-id');

      expect(result).toBeUndefined();
    });

    test('propagates API errors', async () => {
      const error = new Error('Product not found');
      vi.mocked(apiClient.delete).mockRejectedValueOnce(error);

      await expect(productsApi.delete('p-invalid')).rejects.toThrow('Product not found');
    });
  });
});
