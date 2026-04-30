import { handle } from 'hono/aws-lambda';
import { buildAuthApp } from './app.js';

export const handler = handle(buildAuthApp());
