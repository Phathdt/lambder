import { z } from 'zod';

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Price must be a decimal with up to 2 fractional digits');

export const createProductBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: decimalString,
});
export type CreateProductBody = z.infer<typeof createProductBody>;

export const updateProductBody = createProductBody.partial();
export type UpdateProductBody = z.infer<typeof updateProductBody>;

export const listProductsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});
export type ListProductsQuery = z.infer<typeof listProductsQuery>;

export const productDto = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ProductDto = z.infer<typeof productDto>;
