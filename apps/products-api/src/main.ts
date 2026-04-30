import { handle } from 'hono/aws-lambda';
import { buildProductsApp } from './app';

export const handler = handle(buildProductsApp());
