import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { ProductsPageObject } from '../../../page-objects/products.page';
import { buildProduct } from '../../../utils/factories';
import type { BrowserWorld } from '../../support/world';

When('I add a new random product', async function (this: BrowserWorld) {
  const product = buildProduct();
  this.data.product = product;
  await new ProductsPageObject(this.page).createProduct(product);
});

Then('I should see that product in the list', async function (this: BrowserWorld) {
  const product = this.data.product as { name: string; price: string };
  await new ProductsPageObject(this.page).expectProductVisible(product.name);
  await expect(this.page.getByText(`$${product.price}`).first()).toBeVisible();
});

When(
  'I try to submit a product with price {string}',
  async function (this: BrowserWorld, badPrice: string) {
    await this.page.locator('input#name').fill('Bad price');
    await this.page.locator('input#price').fill(badPrice);
    await this.page.getByRole('button', { name: /^add$/i }).click();
  },
);

Then('I should see a price validation error', async function (this: BrowserWorld) {
  await expect(this.page.getByText(/decimal/i)).toBeVisible();
});
