/**
 * Smoke tests for the Daueraufträge (standing orders) page.
 *
 * Covers:
 *   • Empty state renders on the page when no standing orders exist
 *   • "+ Manueller Eintrag" hero button opens the create dialog
 *   • Nav link in the sidebar routes to /app/daueraufträge
 *
 * All tests are independent — none relies on prior test state.
 * Auth is provided by the shared authedCtx fixture (see fixtures.ts).
 */
import { authedTest as test, expect } from './fixtures';

// The URL uses the ä character which browsers encode as %C3%A4.
// Match with a regex to handle both encoded and raw forms.
const DAUERAUFTRAEGE_URL_RE = /dauerauftr/i;

test.describe('Daueraufträge page', () => {

  test('empty state is visible when no standing orders exist', async ({ page }) => {
    await page.goto('/app/dauerauftr%C3%A4ge');
    await page.waitForLoadState('networkidle');

    // klar-empty-state renders the message in a <p> with class text-muted-foreground.
    // The store will be empty in a fresh test fixture without FinTS data,
    // so the empty-state block should be shown.
    const emptyMessage = page.getByText(/Noch keine Daueraufträge/);

    // If the page already has data from the seed, we accept either state and
    // skip the assertion — the page is still expected to load successfully.
    const hasData = await page.locator('ul li').count();
    if (hasData > 0) {
      // Data exists — page loaded fine; empty-state correctly absent.
      await expect(page.locator('klar-empty-state')).not.toBeVisible();
    } else {
      await expect(emptyMessage).toBeVisible({ timeout: 10000 });
    }
  });

  test('hero "Manueller Eintrag" button opens the create dialog', async ({ page }) => {
    await page.goto('/app/dauerauftr%C3%A4ge');
    await page.waitForLoadState('networkidle');

    // The hero action button — rendered as a klar-button containing "Manueller Eintrag"
    const createBtn = page.getByRole('button', { name: /Manueller Eintrag/ });
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // KlarDialogService overlays a dialog with the title "Dauerauftrag anlegen"
    await expect(page.getByText('Dauerauftrag anlegen')).toBeVisible({ timeout: 5000 });

    // The Empfänger / Auftraggeber field (id="sod-name") must be in the dialog
    await expect(page.locator('#sod-name')).toBeVisible();

    // Dismiss
    await page.keyboard.press('Escape');
  });

  test('nav link routes to the Daueraufträge page', async ({ page }) => {
    // Start at the app shell root — the router redirects to /app/fixkosten by default
    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    // The nav item has the label "Daueraufträge" — match by accessible name.
    // On mobile the label may be hidden; use locator for the <a> element whose
    // href matches the encoded path.
    const navLink = page.locator('a[href="/app/dauerauftr%C3%A4ge"], a[href="/app/daueraufträge"]');
    await expect(navLink.first()).toBeVisible({ timeout: 10000 });
    await navLink.first().click();

    // URL must contain "dauerauftr" (handles both raw and %-encoded ä)
    await expect(page).toHaveURL(DAUERAUFTRAEGE_URL_RE, { timeout: 10000 });

    // The hero title should confirm we are on the right page
    await expect(page.getByText('Wiederkehrende Bank-Aufträge')).toBeVisible({ timeout: 10000 });
  });

});
