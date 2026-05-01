// Bootstrap OpenTelemetry BEFORE any instrumented module is imported.
// initOTelSdk is a noop when OTEL_EXPORTER_OTLP_ENDPOINT isn't set.
import { initOTelSdk } from '@lambder/observability';
initOTelSdk({ serviceName: 'auth-api' });

import { handle } from 'hono/aws-lambda';
import { buildAuthApp } from './app';

export const handler = handle(buildAuthApp());
