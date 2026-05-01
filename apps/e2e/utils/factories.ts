import { faker } from '@faker-js/faker';

export const buildCredentials = () => ({
  email: `e2e+${Date.now()}-${faker.string.alphanumeric(6).toLowerCase()}@example.com`,
  password: 'StrongPass1!@#',
});

export const buildProduct = () => ({
  name: faker.commerce.productName().slice(0, 60),
  description: faker.commerce.productDescription().slice(0, 100),
  price: faker.commerce.price({ min: 1, max: 999, dec: 2 }),
});
