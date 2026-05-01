import { isErr, isOk } from '@lambder/shared-kernel';
import { describe, expect, test } from 'vitest';
import { ProductService } from './product.service';
import { createFakeProductRepository } from '../../__test-fakes__/fakes';

const makeService = () => new ProductService(createFakeProductRepository());

describe('ProductService — create', () => {
  test('returns a product with priceCents from decimal', async () => {
    const svc = makeService();
    const p = await svc.create({ ownerId: 'u1', name: 'X', price: '1.50' });
    expect(p.priceCents).toBe(150);
    expect(p.ownerId).toBe('u1');
    expect(p.description).toBeNull();
  });

  test('handles whole-number prices', async () => {
    const svc = makeService();
    const p = await svc.create({ ownerId: 'u1', name: 'Y', price: '42' });
    expect(p.priceCents).toBe(4200);
  });

  test('preserves description when provided', async () => {
    const svc = makeService();
    const p = await svc.create({
      ownerId: 'u1',
      name: 'Z',
      description: 'hello',
      price: '0.99',
    });
    expect(p.description).toBe('hello');
  });
});

describe('ProductService — get', () => {
  test('returns NotFoundError for unknown id', async () => {
    const svc = makeService();
    const result = await svc.get('00000000-0000-0000-0000-000000000000');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  test('returns the product when it exists', async () => {
    const svc = makeService();
    const created = await svc.create({ ownerId: 'u1', name: 'X', price: '1.00' });
    const result = await svc.get(created.id);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.id).toBe(created.id);
  });
});

describe('ProductService — update', () => {
  test('owner can update name + price', async () => {
    const svc = makeService();
    const p = await svc.create({ ownerId: 'u1', name: 'Old', price: '1.00' });
    const result = await svc.update({
      actorId: 'u1',
      id: p.id,
      patch: { name: 'New', price: '2.50' },
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.name).toBe('New');
      expect(result.value.priceCents).toBe(250);
    }
  });

  test('FORBIDDEN when actor is not owner', async () => {
    const svc = makeService();
    const p = await svc.create({ ownerId: 'u1', name: 'X', price: '1.00' });
    const result = await svc.update({
      actorId: 'u2',
      id: p.id,
      patch: { name: 'hijack' },
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('FORBIDDEN');
  });

  test('PRODUCT_NOT_FOUND for unknown id', async () => {
    const svc = makeService();
    const result = await svc.update({
      actorId: 'u1',
      id: '00000000-0000-0000-0000-000000000000',
      patch: { name: 'X' },
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  test('description can be cleared by passing null/undefined', async () => {
    const svc = makeService();
    const p = await svc.create({
      ownerId: 'u1',
      name: 'X',
      description: 'original',
      price: '1.00',
    });
    const result = await svc.update({
      actorId: 'u1',
      id: p.id,
      patch: { description: undefined },
    });
    // patch.description undefined → no change; original preserved.
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.description).toBe('original');
  });

  test('description can be updated to new value', async () => {
    const svc = makeService();
    const p = await svc.create({
      ownerId: 'u1',
      name: 'X',
      description: 'original',
      price: '1.00',
    });
    const result = await svc.update({
      actorId: 'u1',
      id: p.id,
      patch: { description: 'updated' },
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.description).toBe('updated');
  });

  test('description can be cleared by passing null', async () => {
    const svc = makeService();
    const p = await svc.create({
      ownerId: 'u1',
      name: 'X',
      description: 'original',
      price: '1.00',
    });
    const result = await svc.update({
      actorId: 'u1',
      id: p.id,
      patch: { description: null },
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.description).toBeNull();
  });
});

describe('ProductService — delete', () => {
  test('owner can delete', async () => {
    const svc = makeService();
    const p = await svc.create({ ownerId: 'u1', name: 'X', price: '1.00' });
    const result = await svc.delete({ actorId: 'u1', id: p.id });
    expect(isOk(result)).toBe(true);
    const after = await svc.get(p.id);
    expect(isErr(after)).toBe(true);
  });

  test('FORBIDDEN when actor is not owner', async () => {
    const svc = makeService();
    const p = await svc.create({ ownerId: 'u1', name: 'X', price: '1.00' });
    const result = await svc.delete({ actorId: 'u2', id: p.id });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('FORBIDDEN');
  });

  test('PRODUCT_NOT_FOUND for unknown id', async () => {
    const svc = makeService();
    const result = await svc.delete({
      actorId: 'u1',
      id: '00000000-0000-0000-0000-000000000000',
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('PRODUCT_NOT_FOUND');
  });
});

describe('ProductService — list', () => {
  test('returns paginated items with cursor', async () => {
    const svc = makeService();
    for (let i = 0; i < 5; i++) {
      await svc.create({ ownerId: 'u1', name: `P${i}`, price: '1.00' });
    }
    const page1 = await svc.list({ limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).toBeTypeOf('string');

    const page2 = await svc.list({ limit: 2, cursor: page1.nextCursor! });
    expect(page2.items).toHaveLength(2);
    expect(page2.nextCursor).toBeTypeOf('string');

    const page3 = await svc.list({ limit: 2, cursor: page2.nextCursor! });
    expect(page3.items).toHaveLength(1);
    expect(page3.nextCursor).toBeNull();
  });
});
