import { handle } from 'hono/aws-lambda';
import { buildProductsApp } from './app.js';

export const handler = handle(buildProductsApp());
