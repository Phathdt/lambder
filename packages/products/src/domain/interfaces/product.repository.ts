import type { NewProduct, Product, ProductPatch } from '../entities/product.entity.js';

export interface ProductPage {
  readonly items: Product[];
  readonly nextCursor: string | null;
}

export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  list(input: { limit: number; cursor?: string | undefined }): Promise<ProductPage>;
  create(input: NewProduct): Promise<Product>;
  update(id: string, patch: ProductPatch): Promise<Product>;
  delete(id: string): Promise<void>;
}
