import { isErr, isOk } from '@lambder/shared-kernel';
import { describe, expect, test } from 'vitest';
import { ProductService } from '../src/application/services/product.service.js';
import type { Product } from '../src/domain/entities/product.entity.js';
import type {
  ProductPage,
  ProductRepository,
} from '../src/domain/interfaces/product.repository.js';

const makeRepo = (): ProductRepository & { _items: Map<string, Product> } => {
  const _items = new Map<string, Product>();
  return {
    _items,
    async findById(id) {
      return _items.get(id) ?? null;
    },
    async list({ limit }): Promise<ProductPage> {
      return { items: [..._items.values()].slice(0, limit), nextCursor: null };
    },
    async create(input) {
      const p: Product = {
        id: crypto.randomUUID(),
        ownerId: input.ownerId,
        name: input.name,
        description: input.description ?? null,
        priceCents: input.priceCents,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      _items.set(p.id, p);
      return p;
    },
    async update(id, patch) {
      const p = _items.get(id);
      if (!p) throw new Error('not found');
      const next: Product = {
        ...p,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.priceCents !== undefined ? { priceCents: patch.priceCents } : {}),
        updatedAt: new Date(),
      };
      _items.set(id, next);
      return next;
    },
    async delete(id) {
      _items.delete(id);
    },
  };
};

describe('ProductService', () => {
  test('create returns a product owned by actor', async () => {
    const svc = new ProductService(makeRepo());
    const p = await svc.create({ ownerId: 'u1', name: 'X', price: '1.50' });
    expect(p.priceCents).toBe(150);
    expect(p.ownerId).toBe('u1');
  });

  test('update fails with FORBIDDEN if actor is not owner', async () => {
    const repo = makeRepo();
    const svc = new ProductService(repo);
    const p = await svc.create({ ownerId: 'u1', name: 'X', price: '1.00' });
    const result = await svc.update({ actorId: 'u2', id: p.id, patch: { name: 'Y' } });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('FORBIDDEN');
  });

  test('delete by owner succeeds', async () => {
    const repo = makeRepo();
    const svc = new ProductService(repo);
    const p = await svc.create({ ownerId: 'u1', name: 'X', price: '1.00' });
    const result = await svc.delete({ actorId: 'u1', id: p.id });
    expect(isOk(result)).toBe(true);
  });
});
