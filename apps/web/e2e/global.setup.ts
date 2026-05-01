import { test as setup, expect, request } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth', 'admin.json');

setup('authenticate as admin', async ({ page }) => {
  await page.goto('http://localhost:4200/login');

  // klar-input wraps the real <input>; name attr is on the host element
  const emailInput = page.locator('klar-input[name="email"] input');
  await expect(emailInput).toBeVisible();

  await emailInput.fill('admin@klar.dev');
  await page.locator('klar-input[name="password"] input').fill('password123');

  // Capture the access token from the login response before clicking
  const loginResponsePromise = page.waitForResponse(
    resp => resp.url().includes('/api/v1/auth/login') && resp.status() === 200,
    { timeout: 15000 },
  );

  await page.click('button[type="submit"]');

  const loginResponse = await loginResponsePromise;
  const loginBody = await loginResponse.json() as { accessToken?: string };
  const accessToken = loginBody.accessToken ?? null;

  // Wait for successful navigation to the app shell
  await expect(page).toHaveURL(/\/app\/fixkosten/, { timeout: 15000 });

  // Persist the session (httpOnly cookies + localStorage) so subsequent
  // test projects can reuse it without re-logging in.
  await page.context().storageState({ path: AUTH_FILE });

  // Clean up leftover E2E test keys from previous runs to prevent strict-mode violations.
  // Call the API directly (not through the Angular proxy) to avoid vite interference.
  if (accessToken) {
    const api = await request.newContext({
      baseURL: 'http://localhost:3000',
      extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
    });

    const householdsRes = await api.get('/api/v1/households');
    if (householdsRes.ok()) {
      const households = await householdsRes.json() as Array<{ household: { id: string } }>;
      for (const hh of households) {
        const keysRes = await api.get(`/api/v1/households/${hh.household.id}/api-keys`);
        if (keysRes.ok()) {
          const keys = await keysRes.json() as Array<{ id: string; name: string }>;
          for (const key of keys) {
            if (key.name.startsWith('E2E-')) {
              await api.delete(`/api/v1/households/${hh.household.id}/api-keys/${key.id}`);
            }
          }
        }
      }
    }

    await api.dispose();
  }
});
