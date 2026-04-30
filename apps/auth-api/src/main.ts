import { handle } from 'hono/aws-lambda';
import { buildAuthApp } from './app';

export const handler = handle(buildAuthApp());
