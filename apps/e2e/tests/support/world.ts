import { setDefaultTimeout, setWorldConstructor, World } from '@cucumber/cucumber';
import type { Browser, BrowserContext, Page } from 'playwright';

// Each scenario runs in its own World instance — gives steps access to a
// shared browser/page plus an arbitrary scratchpad for cross-step state
// (e.g. credentials generated in a Given step + asserted in a Then step).
setDefaultTimeout(60_000);

export class BrowserWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
  data: Record<string, unknown> = {};
}

setWorldConstructor(BrowserWorld);
