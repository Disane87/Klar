import { authedTest as test, expect } from './fixtures';

// All tests in this file are authenticated via the shared authedCtx fixture.
// The fixture creates one browser context per worker so the rotating refresh
// token stays valid across tests (each new page re-uses the same cookie jar).

// ─────────────────────────────────────────────────────────────────────────────
// 1. App shell renders
// ─────────────────────────────────────────────────────────────────────────────
test.describe('App shell', () => {
  test('renders the desktop sidebar at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    // klar-side-nav is present in the DOM with class desktop-only
    // At 1280px the CSS shows it (display: flex via @media min-width: 768px)
    const sidebar = page.locator('klar-side-nav.desktop-only');
    await expect(sidebar).toBeAttached();
    await expect(sidebar).toBeVisible();
  });

  test('renders mobile bottom nav at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    const bottomNav = page.locator('nav.bottom-nav');
    await expect(bottomNav).toBeVisible();

    // Bottom nav should contain nav links (tab-items)
    const tabItems = bottomNav.locator('a.tab-item');
    await expect(tabItems).toHaveCount(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Page navigation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Page navigation', () => {
  test('navigates to Fixkosten page', async ({ page }) => {
    await page.goto('/app/fixkosten');
    await page.waitForLoadState('networkidle');

    // Page renders one of: stat-strip, loading skeleton (ledger-shell), or error-bar
    const content = page.locator('.stat-strip, .ledger-shell, .error-bar, .empty-state');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test('navigates to Monat page', async ({ page }) => {
    await page.goto('/app/monat');
    await page.waitForLoadState('networkidle');

    const monthNav = page.locator('.month-nav');
    await expect(monthNav).toBeVisible({ timeout: 10000 });

    await expect(
      page.locator('button[aria-label="Vorheriger Monat"]'),
    ).toBeVisible();
    await expect(
      page.locator('button[aria-label="Nächster Monat"]'),
    ).toBeVisible();
  });

  test('navigates to Buchungen page', async ({ page }) => {
    await page.goto('/app/buchungen');
    await page.waitForLoadState('networkidle');

    const monthNav = page.locator('.month-nav');
    await expect(monthNav).toBeVisible({ timeout: 10000 });
  });

  test('navigates to Projekte page', async ({ page }) => {
    await page.goto('/app/projekte');
    await page.waitForLoadState('networkidle');

    // After load, one of filter-bar, loading skeleton, error or empty-state is shown
    const content = page.locator('.filter-bar, .project-list, .error-bar, .empty-state');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test('navigates to Planspiel page', async ({ page }) => {
    await page.goto('/app/planspiel');
    await page.waitForLoadState('networkidle');

    // Planspiel header "Planspiel" heading is always rendered
    const heading = page.locator('h1', { hasText: 'Planspiel' });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('navigates to Haushalt page', async ({ page }) => {
    await page.goto('/app/haushalt');
    await page.waitForLoadState('networkidle');

    const pageHeader = page.locator('.page-header');
    await expect(pageHeader).toBeVisible({ timeout: 10000 });
    await expect(pageHeader).toContainText('HAUSHALT');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Buchungen interactions
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Buchungen interactions', () => {
  test('month navigation changes the displayed month', async ({ page }) => {
    await page.goto('/app/buchungen');
    await page.waitForLoadState('networkidle');

    const monthTitle = page.locator('.month-title');
    await expect(monthTitle).toBeVisible({ timeout: 10000 });

    const initialMonth = await monthTitle.textContent();

    await page.locator('button[aria-label="Vorheriger Monat"]').click();
    await page.waitForLoadState('networkidle');

    const updatedMonth = await monthTitle.textContent();
    expect(updatedMonth).not.toBe(initialMonth);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Haushalt page interactions
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Haushalt page interactions', () => {
  test('can click Bearbeiten to edit household name', async ({ page }) => {
    await page.goto('/app/haushalt');
    await page.waitForLoadState('networkidle');

    // Wait for the name section to appear before clicking Bearbeiten
    await expect(page.locator('.name-value')).toBeVisible({ timeout: 10000 });

    await page.locator('button:has-text("Bearbeiten")').click();

    // klar-input renders the native <input> with placeholder="Haushaltsname"
    const nameInput = page.locator('input[placeholder="Haushaltsname"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });

    // Speichern and Abbruch buttons should be present
    await expect(page.locator('button:has-text("Speichern")')).toBeVisible();
    await expect(page.locator('button:has-text("Abbruch")')).toBeVisible();
  });

  test('cancel edit restores the view', async ({ page }) => {
    await page.goto('/app/haushalt');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.name-value')).toBeVisible({ timeout: 10000 });

    await page.locator('button:has-text("Bearbeiten")').click();

    // Confirm we are in edit mode — use placeholder-specific selector to avoid
    // matching the always-visible join-by-code input elsewhere on the page
    const nameInput = page.locator('input[placeholder="Haushaltsname"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });

    await page.locator('button:has-text("Abbruch")').click();

    // Bearbeiten button should be visible again, name edit input should be gone
    await expect(page.locator('button:has-text("Bearbeiten")')).toBeVisible();
    await expect(nameInput).not.toBeVisible();
  });
});
