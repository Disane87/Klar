import { test, expect, type Page } from '@playwright/test';

// All tests in this file run unauthenticated — clear any stored state.
test.use({ storageState: { cookies: [], origins: [] } });

// klar-input renders the actual <input> inside the custom element.
// The name attribute is on the klar-input host, not the inner <input>.
// Use klar-input[name="x"] input to reach the real input.
const emailInput = (page: Page) => page.locator('klar-input[name="email"] input');
const passwordInput = (page: Page) => page.locator('klar-input[name="password"] input');
const displayNameInput = (page: Page) => page.locator('klar-input[name="displayName"] input');
const confirmPasswordInput = (page: Page) => page.locator('klar-input[name="confirmPassword"] input');
// klar-button renders a <button> with [attr.type], text in a <span> inside
const submitBtn = (page: Page) => page.locator('button[type="submit"]');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function navigateToLogin(page: Page) {
  await page.goto('/login');
  await expect(emailInput(page)).toBeVisible({ timeout: 10000 });
}

async function navigateToRegister(page: Page) {
  await page.goto('/register');
  await expect(displayNameInput(page)).toBeVisible({ timeout: 10000 });
}

// ---------------------------------------------------------------------------
// LOGIN PAGE TESTS
// ---------------------------------------------------------------------------

test.describe('Login page', () => {

  test('redirects / to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('redirects /app to /login when unauthenticated', async ({ page }) => {
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('renders login form elements', async ({ page }) => {
    await navigateToLogin(page);

    await expect(emailInput(page)).toBeVisible();
    await expect(passwordInput(page)).toBeVisible();
    await expect(submitBtn(page)).toBeVisible();
    await expect(submitBtn(page)).toContainText('Anmelden');
    await expect(page.locator('a[href="/register"]')).toBeVisible();
  });

  test('shows validation errors when submitting empty form', async ({ page }) => {
    await navigateToLogin(page);

    await submitBtn(page).click();

    // klar-input renders <span class="hint error"> for validation errors
    const errors = page.locator('.hint.error');
    await expect(errors.first()).toBeVisible({ timeout: 5000 });
    await expect(errors.first()).toContainText('Pflichtfeld');
  });

  test('shows error on wrong password', async ({ page }) => {
    await navigateToLogin(page);

    await emailInput(page).fill('admin@klar.dev');
    await passwordInput(page).fill('wrongpassword123');
    await submitBtn(page).click();

    // Wait for the server-error element to appear and contain "falsch"
    const serverError = page.locator('.server-error');
    await expect(serverError).toBeVisible({ timeout: 10000 });
    await expect(serverError).toContainText('falsch');
  });

  test('shows unverified email error on 403', async ({ page }) => {
    // Intercept the login API call and return 403
    await page.route('**/api/v1/auth/login', async route => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 403, message: 'Email not verified' }),
      });
    });

    await navigateToLogin(page);

    await emailInput(page).fill('unverified@klar.dev');
    await passwordInput(page).fill('password123');
    await submitBtn(page).click();

    const serverError = page.locator('.server-error');
    await expect(serverError).toBeVisible({ timeout: 5000 });
    await expect(serverError).toContainText('bestätigt');
  });

  test('redirects to /app after successful login', async ({ page }) => {
    await navigateToLogin(page);

    await emailInput(page).fill('admin@klar.dev');
    await passwordInput(page).fill('password123');
    await submitBtn(page).click();

    // After login the router navigates /app → /app/fixkosten
    await expect(page).toHaveURL(/\/app\//, { timeout: 15000 });
  });

});

// ---------------------------------------------------------------------------
// REGISTER PAGE TESTS
// ---------------------------------------------------------------------------

test.describe('Register page', () => {

  test('renders register form', async ({ page }) => {
    await navigateToRegister(page);

    await expect(emailInput(page)).toBeVisible();
    await expect(displayNameInput(page)).toBeVisible();
    await expect(passwordInput(page)).toBeVisible();
    await expect(confirmPasswordInput(page)).toBeVisible();
    await expect(submitBtn(page)).toBeVisible();
    await expect(submitBtn(page)).toContainText('Registrieren');
  });

  test('shows password mismatch error', async ({ page }) => {
    await navigateToRegister(page);

    await displayNameInput(page).fill('Test User');
    await emailInput(page).fill('test@klar.dev');
    await passwordInput(page).fill('password123');
    await confirmPasswordInput(page).fill('different456');
    await submitBtn(page).click();

    const errors = page.locator('.hint.error');
    await expect(errors.last()).toBeVisible({ timeout: 5000 });
    await expect(errors.last()).toContainText('stimmen nicht überein');
  });

  test('shows duplicate email error via mocked API', async ({ page }) => {
    // Intercept register endpoint and return 409 Conflict
    await page.route('**/api/v1/auth/register', async route => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 409, message: 'Email already exists' }),
      });
    });

    await navigateToRegister(page);

    await displayNameInput(page).fill('Existing User');
    await emailInput(page).fill('admin@klar.dev');
    await passwordInput(page).fill('password123');
    await confirmPasswordInput(page).fill('password123');
    await submitBtn(page).click();

    const serverError = page.locator('.server-error');
    await expect(serverError).toBeVisible({ timeout: 5000 });
    await expect(serverError).toContainText('bereits registriert');
  });

  test('shows success state after registration', async ({ page }) => {
    // Intercept register endpoint and return 201 Created
    await page.route('**/api/v1/auth/register', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Registration successful. Please verify your email.' }),
      });
    });

    await navigateToRegister(page);

    await displayNameInput(page).fill('New User');
    await emailInput(page).fill('newuser@klar.dev');
    await passwordInput(page).fill('password123');
    await confirmPasswordInput(page).fill('password123');
    await submitBtn(page).click();

    // After success the form is replaced by the .success-state block
    await expect(page.locator('.success-state')).toBeVisible({ timeout: 5000 });
    await expect(emailInput(page)).not.toBeVisible();
  });

});
