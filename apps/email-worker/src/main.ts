import type { SQSEvent, SQSBatchResponse } from 'aws-lambda';
import { buildEmailWorker } from './app';

const worker = buildEmailWorker();

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  return worker.handle(event);
};
