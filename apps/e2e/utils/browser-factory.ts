import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

interface BrowserBundle {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export async function createBrowserContextPage(): Promise<BrowserBundle> {
  const headless = process.env.HEADLESS !== 'false';
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ baseURL: getWebBaseUrl() });
  const page = await context.newPage();
  return { browser, context, page };
}

export async function closeBrowserBundle(bundle: BrowserBundle): Promise<void> {
  try {
    await bundle.page.close();
  } catch {
    /* already closed */
  }
  try {
    await bundle.context.close();
  } catch {
    /* already closed */
  }
  await bundle.browser.close();
}

export const getWebBaseUrl = (): string =>
  process.env.WEB_BASE_URL ?? `http://localhost:${process.env.WEB_PORT ?? '3000'}`;
