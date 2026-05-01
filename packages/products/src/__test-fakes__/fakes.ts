import { randomUUID } from 'node:crypto';
import type { NewProduct, Product, ProductPatch } from '../domain/entities/product.entity';
import type {
  ProductPage,
  ProductRepository,
} from '../domain/interfaces/product.repository';

export interface FakeProductRepository extends ProductRepository {
  readonly items: Map<string, Product>;
}

export const createFakeProductRepository = (): FakeProductRepository => {
  const items = new Map<string, Product>();
  return {
    items,
    async findById(id) {
      return items.get(id) ?? null;
    },
    async list({ limit, cursor }): Promise<ProductPage> {
      const all = [...items.values()].toSorted((a, b) => a.id.localeCompare(b.id));
      const start = cursor ? all.findIndex((p) => p.id > cursor) : 0;
      const slice = all.slice(start === -1 ? all.length : start, (start === -1 ? all.length : start) + limit + 1);
      const hasMore = slice.length > limit;
      const page = hasMore ? slice.slice(0, limit) : slice;
      const last = page.at(-1);
      return { items: page, nextCursor: hasMore && last ? last.id : null };
    },
    async create(input: NewProduct): Promise<Product> {
      const p: Product = {
        id: randomUUID(),
        ownerId: input.ownerId,
        name: input.name,
        description: input.description ?? null,
        priceCents: input.priceCents,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      items.set(p.id, p);
      return p;
    },
    async update(id, patch: ProductPatch): Promise<Product> {
      const p = items.get(id);
      if (!p) throw new Error('not found');
      const next: Product = {
        ...p,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.priceCents !== undefined ? { priceCents: patch.priceCents } : {}),
        updatedAt: new Date(),
      };
      items.set(id, next);
      return next;
    },
    async delete(id) {
      items.delete(id);
    },
  };
};
