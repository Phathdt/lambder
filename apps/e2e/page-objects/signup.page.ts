import { expect, type Page } from '@playwright/test';

export class SignupPageObject {
  constructor(private readonly page: Page) {}

  private get emailInput() {
    return this.page.locator('input#email');
  }
  private get passwordInput() {
    return this.page.locator('input#password');
  }
  private get submitButton() {
    return this.page.getByRole('button', { name: /create account/i });
  }

  async goto() {
    await this.page.goto('/signup');
    await expect(this.page).toHaveURL(/\/signup$/);
  }

  async fillAndSubmit(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
