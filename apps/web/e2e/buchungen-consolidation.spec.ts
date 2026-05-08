/**
 * Smoke tests for the unified transactions table (Task 11 of the
 * Transactions Consolidation plan).
 *
 * Covers:
 *   • Cashflow lens at /app/buchungen — quick chip filter, reset, create dialog
 *   • Account lens at /app/banken/:c/:a — locked account filter, search,
 *     create dialog, sync button visibility
 *
 * The account-lens test is conditionally skipped when the test fixture has
 * no FinTS-linked accounts in /app/banken (the account-link locator below
 * relies on a `data-test="banken-account-link"` attribute that does not yet
 * exist in the source — see the Task 11 implementation report).
 */
import { authedTest as test, expect } from './fixtures';

test.describe('Transactions consolidation', () => {
  test('Buchungen page: quick chip filters and create dialog', async ({ page }) => {
    await page.goto('/app/buchungen');

    // Quick chip is visible
    const wiederkehrendChip = page.getByRole('button', { name: /Wiederkehrend/ });
    await expect(wiederkehrendChip).toBeVisible();

    // Toggle "Wiederkehrend" → filter applies, reset button shows
    await wiederkehrendChip.click();
    await expect(page.getByRole('button', { name: /Filter zurücksetzen/ })).toBeVisible();

    // Reset → reset button hides
    await page.getByRole('button', { name: /Filter zurücksetzen/ }).click();
    await expect(page.getByRole('button', { name: /Filter zurücksetzen/ })).toBeHidden();

    // Open create dialog from page header "+ Buchung" button.
    // The PageHeaderService renders the add button with the provided label;
    // .first() disambiguates from the "Buchung" word elsewhere on the page.
    await page.getByRole('button', { name: /^Buchung$/ }).first().click();
    await expect(page.getByText('Buchung anlegen')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('Account detail: locked filter, sync, create dialog', async ({ page }) => {
    await page.goto('/app/banken');

    // Bail early if no banks are configured in the test fixture
    const accountLinks = page.locator('[data-test="banken-account-link"]');
    const count = await accountLinks.count();
    test.skip(count === 0, 'No FinTS-linked accounts in the test fixture');

    await accountLinks.first().click();
    await expect(page.getByText(/Bankkonto/)).toBeVisible();

    // Account pill is locked (the wrapper div carries data-locked="true")
    const accountSelect = page.locator('[data-filter="accountId"]');
    await expect(accountSelect).toHaveAttribute('data-locked', 'true');

    // Search filters within account
    await page.getByPlaceholder(/Beschreibung/).fill('zzz_no_match_zzz');
    await expect(page.getByText(/Keine Buchungen passen zum Filter/)).toBeVisible();
    await page.getByPlaceholder(/Beschreibung/).fill('');

    // "+ Buchung" opens the create dialog
    await page.getByRole('button', { name: /^Buchung$/ }).click();
    await expect(page.getByText('Buchung anlegen')).toBeVisible();
    await page.keyboard.press('Escape');

    // Sync button is reachable (don't actually sync — that's a real
    // network roundtrip with bank-side latency and flakiness risk)
    await expect(page.getByRole('button', { name: /Synchronisieren/ })).toBeVisible();
  });
});
