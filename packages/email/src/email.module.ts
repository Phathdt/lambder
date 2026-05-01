import type { EmailEnqueuer } from './domain/interfaces/email-enqueuer';
import {
  SqsEmailEnqueuer,
  type SqsEnqueuerConfig,
} from './infrastructure/enqueuers/sqs-email.enqueuer';

export interface EmailModuleConfig extends SqsEnqueuerConfig {}

export interface EmailModule {
  enqueuer: EmailEnqueuer;
}

export const buildEmailModule = (config: EmailModuleConfig): EmailModule => ({
  enqueuer: new SqsEmailEnqueuer(config),
});
