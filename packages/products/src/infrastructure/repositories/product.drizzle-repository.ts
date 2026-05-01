import type { Database } from '@lambder/db';
import { sql } from 'drizzle-orm';
import type { NewProduct, Product, ProductPatch } from '../../domain/entities/product.entity';
import type { ProductPage, ProductRepository } from '../../domain/interfaces/product.repository';
import { products, type ProductRow } from '../db/products.schema';

const toProduct = (row: ProductRow): Product => ({
  id: row.id,
  ownerId: row.ownerId,
  name: row.name,
  description: row.description,
  priceCents: row.priceCents,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export class ProductDrizzleRepository implements ProductRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Product | null> {
    const rows = await this.db
      .select()
      .from(products)
      .where(sql`${products.id} = ${id}`)
      .limit(1);
    return rows[0] ? toProduct(rows[0]) : null;
  }

  async list(input: { limit: number; cursor?: string | undefined }): Promise<ProductPage> {
    const rows = await this.db
      .select()
      .from(products)
      .where(input.cursor ? sql`${products.id} > ${input.cursor}` : sql`true`)
      .orderBy(products.id)
      .limit(input.limit + 1);
    const hasMore = rows.length > input.limit;
    const items = (hasMore ? rows.slice(0, input.limit) : rows).map(toProduct);
    const last = items.at(-1);
    return { items, nextCursor: hasMore && last ? last.id : null };
  }

  async create(input: NewProduct): Promise<Product> {
    const [row] = await this.db
      .insert(products)
      .values({
        ownerId: input.ownerId,
        name: input.name,
        description: input.description ?? null,
        priceCents: input.priceCents,
      })
      .returning();
    /* c8 ignore next 1 */
    if (!row) throw new Error('Failed to insert product');
    return toProduct(row);
  }

  async update(id: string, patch: ProductPatch): Promise<Product> {
    const [row] = await this.db
      .update(products)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.priceCents !== undefined ? { priceCents: patch.priceCents } : {}),
        updatedAt: new Date(),
      })
      .where(sql`${products.id} = ${id}`)
      .returning();
    /* c8 ignore next 1 */
    if (!row) throw new Error('Failed to update product');
    return toProduct(row);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(products).where(sql`${products.id} = ${id}`);
  }
}
