import { metrics, type Counter, type Histogram } from '@opentelemetry/api';

const meter = metrics.getMeter('@lambder/observability');

export const counter = (name: string, description?: string): Counter =>
  meter.createCounter(name, description ? { description } : undefined);

export const histogram = (name: string, description?: string): Histogram =>
  meter.createHistogram(name, {
    unit: 'ms',
    ...(description ? { description } : {}),
  });
