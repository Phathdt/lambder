import { After, Before } from '@cucumber/cucumber';
import { closeBrowserBundle, createBrowserContextPage } from '../../utils/browser-factory';
import type { BrowserWorld } from './world';

Before(async function (this: BrowserWorld) {
  const bundle = await createBrowserContextPage();
  this.browser = bundle.browser;
  this.context = bundle.context;
  this.page = bundle.page;
  this.data = {};
});

After(async function (this: BrowserWorld) {
  await closeBrowserBundle({
    browser: this.browser,
    context: this.context,
    page: this.page,
  });
});
