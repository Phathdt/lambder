import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { LoginPageObject } from '../../../page-objects/login.page';
import { ProductsPageObject } from '../../../page-objects/products.page';
import { SignupPageObject } from '../../../page-objects/signup.page';
import { buildCredentials } from '../../../utils/factories';
import type { BrowserWorld } from '../../support/world';

Given('I navigate to the signup page', async function (this: BrowserWorld) {
  await new SignupPageObject(this.page).goto();
});

When('I submit valid signup credentials', async function (this: BrowserWorld) {
  const creds = buildCredentials();
  this.data.creds = creds;
  await new SignupPageObject(this.page).fillAndSubmit(creds.email, creds.password);
});

Then('I should be redirected to the products page', async function (this: BrowserWorld) {
  await new ProductsPageObject(this.page).expectVisible();
});

Given('a fresh user is signed in', async function (this: BrowserWorld) {
  const creds = buildCredentials();
  this.data.creds = creds;
  await new SignupPageObject(this.page).goto();
  await new SignupPageObject(this.page).fillAndSubmit(creds.email, creds.password);
  await new ProductsPageObject(this.page).expectVisible();
});

When('I click the sign out button', async function (this: BrowserWorld) {
  await new ProductsPageObject(this.page).signOut();
});

Then('I should be redirected to the login page', async function (this: BrowserWorld) {
  await expect(this.page).toHaveURL(/\/login$/);
});

Then(
  'visiting the products page should redirect me to the login page',
  async function (this: BrowserWorld) {
    await this.page.goto('/products');
    await expect(this.page).toHaveURL(/\/login$/);
  },
);

Given('a fresh user has signed up and signed out', async function (this: BrowserWorld) {
  const creds = buildCredentials();
  this.data.creds = creds;
  await new SignupPageObject(this.page).goto();
  await new SignupPageObject(this.page).fillAndSubmit(creds.email, creds.password);
  await new ProductsPageObject(this.page).signOut();
  await expect(this.page).toHaveURL(/\/login$/);
});

When('I submit my email with the wrong password', async function (this: BrowserWorld) {
  const creds = this.data.creds as { email: string; password: string };
  await new LoginPageObject(this.page).fillAndSubmit(creds.email, 'wrong-password-123!');
});

Then(
  'I should see an {string} error',
  async function (this: BrowserWorld, _label: string) {
    await expect(this.page.getByText(/invalid email or password/i)).toBeVisible();
  },
);
