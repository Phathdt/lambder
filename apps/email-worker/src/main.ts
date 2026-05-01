// Bootstrap OpenTelemetry BEFORE any instrumented module is imported.
// initOTelSdk is a noop when OTEL_EXPORTER_OTLP_ENDPOINT isn't set.
import { initOTelSdk } from '@lambder/observability';
initOTelSdk({ serviceName: 'email-worker' });

import type { SQSEvent, SQSBatchResponse } from 'aws-lambda';
import { buildEmailWorker } from './app';

const worker = buildEmailWorker();

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  return worker.handle(event);
};
