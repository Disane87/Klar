import { test as base } from '@playwright/test';
import path from 'path';
import type { BrowserContext } from '@playwright/test';

const AUTH_FILE = path.join(__dirname, '.auth', 'admin.json');

// Worker-scoped auth context: all tests in the same worker share one browser
// context, so the rotating refresh token stays valid across tests — each test's
// APP_INITIALIZER call uses the freshly-rotated cookie from the previous test
// instead of the now-invalid original token from the saved auth file.
export const authedTest = base.extend<
  NonNullable<unknown>,
  { authedCtx: BrowserContext }
>({
  authedCtx: [
    async ({ browser }, use) => {
      const ctx = await browser.newContext({ storageState: AUTH_FILE });
      await use(ctx);
      await ctx.close();
    },
    { scope: 'worker' },
  ],
  page: async ({ authedCtx }, use) => {
    const page = await authedCtx.newPage();
    await use(page);
    await page.close();
  },
});

export { expect } from '@playwright/test';
