import {
  context,
  propagation,
  trace,
  type Context,
  type TextMapGetter,
  type TextMapSetter,
} from '@opentelemetry/api';

// SQS MessageAttributes carry the W3C trace-context across the queue hop.
// Producer uses `injectTraceContextIntoSqsAttrs` before SendMessage; consumer
// reads the attributes via `extractTraceContextFromSqsRecord` to resume the
// distributed trace.

export type SqsMessageAttributes = Record<string, { DataType: string; StringValue?: string }>;

const setter: TextMapSetter<SqsMessageAttributes> = {
  set(carrier, key, value) {
    carrier[key] = { DataType: 'String', StringValue: value };
  },
};

const getter: TextMapGetter<SqsMessageAttributes> = {
  keys: (carrier) => Object.keys(carrier),
  get: (carrier, key) => {
    const attr = carrier[key];
    return attr?.StringValue;
  },
};

export const injectTraceContextIntoSqsAttrs = (
  attrs: SqsMessageAttributes = {},
): SqsMessageAttributes => {
  propagation.inject(context.active(), attrs, setter);
  return attrs;
};

// Extracts the parent context from SQS message attributes (or the standard
// `AWSTraceHeader` system attribute if the X-Ray active tracing header is
// the only thing present).
export const extractTraceContextFromSqsRecord = (record: {
  messageAttributes?: Record<string, { stringValue?: string | undefined; dataType: string }>;
}): Context => {
  const carrier: SqsMessageAttributes = {};
  for (const [k, v] of Object.entries(record.messageAttributes ?? {})) {
    if (v.stringValue) {
      carrier[k] = { DataType: v.dataType, StringValue: v.stringValue };
    }
  }
  return propagation.extract(context.active(), carrier, getter);
};

export { trace };
