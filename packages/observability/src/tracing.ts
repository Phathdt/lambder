import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { pickInstrumentations } from './instrumentations';

export interface InitOptions {
  serviceName: string;
  endpoint?: string;
}

let sdk: NodeSDK | null = null;

// Idempotent initializer. Call once per cold start, before any instrumented
// import is loaded. Noop when no OTLP endpoint is configured so unit tests
// + scripts don't require a collector.
export const initOTelSdk = (opts: InitOptions): NodeSDK | null => {
  if (sdk) return sdk;
  const endpoint = opts.endpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return null;
  console.log(`[otel] init service=${opts.serviceName} endpoint=${endpoint}`);

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: opts.serviceName,
      [ATTR_SERVICE_VERSION]: process.env.SERVICE_VERSION ?? 'dev',
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    // sdk-metrics + sdk-node ship duplicate `MetricReader` symbols when
    // resolved in pnpm hoisted layout; the cast widens past that TS error.
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
      exportIntervalMillis: 10_000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
    instrumentations: pickInstrumentations(),
  });
  sdk.start();

  // Lambda runtime sends SIGTERM on freeze — flush pending spans/metrics.
  process.once('SIGTERM', () => {
    sdk?.shutdown().catch(() => undefined);
  });
  return sdk;
};

export const shutdownOTelSdk = async (): Promise<void> => {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = null;
};
