import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    // Run headed with slowMo so the user can watch the browser operate
    headless: false,
    launchOptions: {
      slowMo: 400,
    },
  },
  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
      use: {
        headless: false,
        launchOptions: { slowMo: 200 },
      },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
        headless: false,
        launchOptions: { slowMo: 400 },
      },
      dependencies: ['setup'],
      testIgnore: /global\.setup\.ts/,
    },
  ],
});
