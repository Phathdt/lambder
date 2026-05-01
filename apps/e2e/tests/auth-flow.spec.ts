import { expect, test } from '@playwright/test';
import { LoginPageObject } from '../page-objects/login.page';
import { ProductsPageObject } from '../page-objects/products.page';
import { SignupPageObject } from '../page-objects/signup.page';
import { buildCredentials } from '../utils/factories';

test.describe('Auth flow', () => {
  test('signup → land on products → sign out → blocked', async ({ page }) => {
    const creds = buildCredentials();
    const signup = new SignupPageObject(page);
    const products = new ProductsPageObject(page);

    await signup.goto();
    await signup.fillAndSubmit(creds.email, creds.password);
    await products.expectVisible();

    await products.signOut();
    await expect(page).toHaveURL(/\/login$/);

    // Hitting protected route while logged-out redirects.
    await page.goto('/products');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('login with wrong password shows error toast', async ({ page }) => {
    const creds = buildCredentials();
    // Provision the account first.
    await new SignupPageObject(page).goto();
    await new SignupPageObject(page).fillAndSubmit(creds.email, creds.password);
    await new ProductsPageObject(page).signOut();

    const login = new LoginPageObject(page);
    await login.goto();
    await login.fillAndSubmit(creds.email, 'wrong-password');
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });
});
