import { expect, test } from '@playwright/test';
import { ProductsPageObject } from '../page-objects/products.page';
import { SignupPageObject } from '../page-objects/signup.page';
import { buildCredentials, buildProduct } from '../utils/factories';

test.describe('Products CRUD', () => {
  test('owner can add a product and see it in the list', async ({ page }) => {
    const creds = buildCredentials();
    await new SignupPageObject(page).goto();
    await new SignupPageObject(page).fillAndSubmit(creds.email, creds.password);

    const products = new ProductsPageObject(page);
    await products.expectVisible();

    const product = buildProduct();
    await products.createProduct(product);
    await products.expectProductVisible(product.name);
    await expect(page.getByText(`$${product.price}`).first()).toBeVisible();
  });

  test('client-side zod rules block invalid price', async ({ page }) => {
    const creds = buildCredentials();
    await new SignupPageObject(page).goto();
    await new SignupPageObject(page).fillAndSubmit(creds.email, creds.password);

    await new ProductsPageObject(page).expectVisible();
    await page.locator('input#name').fill('Bad price');
    await page.locator('input#price').fill('not-a-number');
    await page.getByRole('button', { name: /^add$/i }).click();
    await expect(page.getByText(/decimal/i)).toBeVisible();
  });
});
