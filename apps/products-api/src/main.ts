// Bootstrap OpenTelemetry BEFORE any instrumented module is imported.
// initOTelSdk is a noop when OTEL_EXPORTER_OTLP_ENDPOINT isn't set.
import { initOTelSdk } from '@lambder/observability';
initOTelSdk({ serviceName: 'products-api' });

import { handle } from 'hono/aws-lambda';
import { buildProductsApp } from './app';

export const handler = handle(buildProductsApp());
