import { ForbiddenError, NotFoundError } from '@lambder/shared-kernel';

export const productNotFound = () => new NotFoundError('PRODUCT_NOT_FOUND', 'Product not found');

export const productForbidden = () =>
  new ForbiddenError('FORBIDDEN', 'You do not own this product');
