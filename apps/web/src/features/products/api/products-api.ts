import { apiClient } from '@/shared/api/api-client';

export interface ProductDto {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  price: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPage {
  items: ProductDto[];
  nextCursor: string | null;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  price: string;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  price?: string;
}

export const productsApi = {
  list: (params: { limit?: number; cursor?: string } = {}) =>
    apiClient.get<ProductPage>('/products', { params }).then((r) => r.data),
  get: (id: string) => apiClient.get<ProductDto>(`/products/${id}`).then((r) => r.data),
  create: (body: CreateProductInput) =>
    apiClient.post<ProductDto>('/products', body).then((r) => r.data),
  update: (id: string, body: UpdateProductInput) =>
    apiClient.patch<ProductDto>(`/products/${id}`, body).then((r) => r.data),
  delete: (id: string) => apiClient.delete<void>(`/products/${id}`).then(() => undefined),
};
