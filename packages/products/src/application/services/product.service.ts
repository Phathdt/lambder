import {
  type ForbiddenError,
  type NotFoundError,
  type Result,
  err,
  ok,
} from '@lambder/shared-kernel';
import {
  decimalToCents,
  type Product,
  type ProductPatch,
} from '../../domain/entities/product.entity';
import type { ProductPage, ProductRepository } from '../../domain/interfaces/product.repository';
import { productForbidden, productNotFound } from '../../domain/errors';

export interface CreateProductInput {
  ownerId: string;
  name: string;
  description?: string | undefined;
  price: string;
}

export interface UpdateProductInput {
  actorId: string;
  id: string;
  patch: {
    name?: string;
    description?: string | undefined;
    price?: string;
  };
}

export interface DeleteProductInput {
  actorId: string;
  id: string;
}

export interface ListProductsInput {
  limit: number;
  cursor?: string | undefined;
}

export class ProductService {
  constructor(private readonly products: ProductRepository) {}

  async create(input: CreateProductInput): Promise<Product> {
    return this.products.create({
      ownerId: input.ownerId,
      name: input.name,
      description: input.description ?? null,
      priceCents: decimalToCents(input.price),
    });
  }

  async get(id: string): Promise<Result<Product, NotFoundError>> {
    const product = await this.products.findById(id);
    return product ? ok(product) : err(productNotFound());
  }

  async list(input: ListProductsInput): Promise<ProductPage> {
    return this.products.list(input);
  }

  async update(
    input: UpdateProductInput,
  ): Promise<Result<Product, NotFoundError | ForbiddenError>> {
    const existing = await this.products.findById(input.id);
    if (!existing) return err(productNotFound());
    if (existing.ownerId !== input.actorId) return err(productForbidden());

    const patch: { name?: string; description?: string | null; priceCents?: number } = {};
    if (input.patch.name !== undefined) patch.name = input.patch.name;
    if (input.patch.description !== undefined) patch.description = input.patch.description ?? null;
    if (input.patch.price !== undefined) patch.priceCents = decimalToCents(input.patch.price);

    return ok(await this.products.update(input.id, patch as ProductPatch));
  }

  async delete(input: DeleteProductInput): Promise<Result<true, NotFoundError | ForbiddenError>> {
    const existing = await this.products.findById(input.id);
    if (!existing) return err(productNotFound());
    if (existing.ownerId !== input.actorId) return err(productForbidden());
    await this.products.delete(input.id);
    return ok(true);
  }
}
