import { DomainError } from '@lambder/shared-kernel';

export class EmailDeliveryError extends DomainError {
  constructor(message: string) {
    super('EMAIL_DELIVERY_FAILED', message);
  }
}

export class EnqueueError extends DomainError {
  constructor(message: string) {
    super('EMAIL_ENQUEUE_FAILED', message);
  }
}
