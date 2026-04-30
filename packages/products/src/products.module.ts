import { getDb } from '@lambder/db';
import { ProductService } from './application/services/product.service.js';
import { ProductDrizzleRepository } from './infrastructure/repositories/product.drizzle-repository.js';

export interface ProductsModuleConfig {
  databaseUrl: string;
}

export interface ProductsModule {
  products: ProductService;
}

export const buildProductsModule = (config: ProductsModuleConfig): ProductsModule => {
  const db = getDb(config.databaseUrl);
  const repo = new ProductDrizzleRepository(db);
  return { products: new ProductService(repo) };
};
