import { describe, expect, test } from 'vitest';
import { centsToDecimal, toProductDto, decimalToCents } from './product.entity';
import type { Product } from './product.entity';

describe('decimalToCents', () => {
  test('converts "0" to 0 cents', () => {
    expect(decimalToCents('0')).toBe(0);
  });

  test('converts "0.00" to 0 cents', () => {
    expect(decimalToCents('0.00')).toBe(0);
  });

  test('converts "1.50" to 150 cents', () => {
    expect(decimalToCents('1.50')).toBe(150);
  });

  test('converts "42" to 4200 cents', () => {
    expect(decimalToCents('42')).toBe(4200);
  });

  test('converts "0.99" to 99 cents', () => {
    expect(decimalToCents('0.99')).toBe(99);
  });

  test('converts "99.99" to 9999 cents', () => {
    expect(decimalToCents('99.99')).toBe(9999);
  });

  test('converts "10.1" to 1010 cents (single digit fraction)', () => {
    expect(decimalToCents('10.1')).toBe(1010);
  });

  test('converts large decimal like "1000.99" to 100099 cents', () => {
    expect(decimalToCents('1000.99')).toBe(100099);
  });

  test('converts decimal with no fractional part "50" to 5000 cents', () => {
    expect(decimalToCents('50')).toBe(5000);
  });
});

describe('centsToDecimal', () => {
  test('converts 0 cents to "0.00"', () => {
    expect(centsToDecimal(0)).toBe('0.00');
  });

  test('converts 1 cent to "0.01"', () => {
    expect(centsToDecimal(1)).toBe('0.01');
  });

  test('converts 99 cents to "0.99"', () => {
    expect(centsToDecimal(99)).toBe('0.99');
  });

  test('converts 100 cents to "1.00"', () => {
    expect(centsToDecimal(100)).toBe('1.00');
  });

  test('converts 150 cents to "1.50"', () => {
    expect(centsToDecimal(150)).toBe('1.50');
  });

  test('converts 4200 cents to "42.00"', () => {
    expect(centsToDecimal(4200)).toBe('42.00');
  });

  test('converts 9999 cents to "99.99"', () => {
    expect(centsToDecimal(9999)).toBe('99.99');
  });

  test('handles negative cents correctly', () => {
    expect(centsToDecimal(-100)).toBe('-1.00');
    expect(centsToDecimal(-150)).toBe('-1.50');
  });

  test('handles large numbers', () => {
    expect(centsToDecimal(1000000)).toBe('10000.00');
  });
});

describe('toProductDto', () => {
  const baseDate = new Date('2025-04-29T12:00:00Z');
  const updateDate = new Date('2025-04-30T14:30:00Z');

  const createProduct = (overrides = {}): Product => ({
    id: 'prod-123',
    ownerId: 'user-456',
    name: 'Test Product',
    description: 'A test product',
    priceCents: 2999,
    createdAt: baseDate,
    updatedAt: updateDate,
    ...overrides,
  });

  test('converts Product to DTO with all fields', () => {
    const product = createProduct();
    const dto = toProductDto(product);

    expect(dto.id).toBe('prod-123');
    expect(dto.ownerId).toBe('user-456');
    expect(dto.name).toBe('Test Product');
    expect(dto.description).toBe('A test product');
    expect(dto.price).toBe('29.99');
    expect(dto.createdAt).toBe('2025-04-29T12:00:00.000Z');
    expect(dto.updatedAt).toBe('2025-04-30T14:30:00.000Z');
  });

  test('converts priceCents using centsToDecimal', () => {
    const product = createProduct({ priceCents: 150 });
    const dto = toProductDto(product);
    expect(dto.price).toBe('1.50');
  });

  test('handles null description', () => {
    const product = createProduct({ description: null });
    const dto = toProductDto(product);
    expect(dto.description).toBeNull();
  });

  test('converts Date objects to ISO strings', () => {
    const product = createProduct();
    const dto = toProductDto(product);
    expect(typeof dto.createdAt).toBe('string');
    expect(typeof dto.updatedAt).toBe('string');
    expect(dto.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('preserves product id and owner id', () => {
    const product = createProduct({ id: 'custom-id', ownerId: 'custom-owner' });
    const dto = toProductDto(product);
    expect(dto.id).toBe('custom-id');
    expect(dto.ownerId).toBe('custom-owner');
  });

  test('handles zero price', () => {
    const product = createProduct({ priceCents: 0 });
    const dto = toProductDto(product);
    expect(dto.price).toBe('0.00');
  });

  test('handles high prices', () => {
    const product = createProduct({ priceCents: 999999 });
    const dto = toProductDto(product);
    expect(dto.price).toBe('9999.99');
  });
});
