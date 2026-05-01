import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productsApi, type CreateProductInput, type UpdateProductInput } from '../api/products-api';

const PRODUCTS_KEY = ['products'] as const;

export function useProducts(limit = 20) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, { limit }],
    queryFn: () => productsApi.list({ limit }),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProductInput) => productsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateProductInput }) =>
      productsApi.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}
