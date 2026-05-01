import { expect, type Page } from '@playwright/test';

export class LoginPageObject {
  constructor(private readonly page: Page) {}

  private get emailInput() {
    return this.page.locator('input#email');
  }
  private get passwordInput() {
    return this.page.locator('input#password');
  }
  private get submitButton() {
    return this.page.getByRole('button', { name: /^log in/i });
  }
  private get signupLink() {
    return this.page.getByRole('link', { name: /sign up/i });
  }

  async goto() {
    await this.page.goto('/login');
    await expect(this.page).toHaveURL(/\/login$/);
  }

  async fillAndSubmit(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async clickSignupLink() {
    await this.signupLink.click();
  }
}
