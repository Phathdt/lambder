import { expect, type Page } from '@playwright/test';

export class ProductsPageObject {
  constructor(private readonly page: Page) {}

  private get nameInput() {
    return this.page.locator('input#name');
  }
  private get priceInput() {
    return this.page.locator('input#price');
  }
  private get descriptionInput() {
    return this.page.locator('input#description');
  }
  private get addButton() {
    return this.page.getByRole('button', { name: /^add$/i });
  }
  private get signOutButton() {
    return this.page.getByRole('button', { name: /sign out/i });
  }

  async expectVisible() {
    await expect(this.page).toHaveURL(/\/products$/);
    await expect(this.page.getByRole('heading', { name: /^products$/i })).toBeVisible();
  }

  async createProduct(input: { name: string; price: string; description?: string }) {
    await this.nameInput.fill(input.name);
    await this.priceInput.fill(input.price);
    if (input.description) await this.descriptionInput.fill(input.description);
    await this.addButton.click();
  }

  productCard(name: string) {
    return this.page.getByRole('article').filter({ hasText: name }).first();
  }

  async expectProductVisible(name: string) {
    await expect(this.page.getByText(name).first()).toBeVisible();
  }

  async deleteProduct(name: string) {
    // Cards aren't <article> by default; locate via the card title text + scoped delete.
    const card = this.page
      .locator('div')
      .filter({ hasText: new RegExp(`^${name}`) })
      .first();
    await card.getByRole('button', { name: /delete/i }).click();
  }

  async signOut() {
    await this.signOutButton.click();
  }
}
