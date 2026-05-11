/**
 * Smoke tests for the FinTS account edit + bank delete flow on /app/banken.
 *
 * Covers:
 *   • Banken page loads (empty state OK in seed-less fixture)
 *   • Bank-delete confirmation copy mentions FinTS-Konten / Buchungen
 *
 * The full rename / sync-toggle / cascade flow requires a seeded FinTS
 * connection which is not part of the default fixture, so deeper assertions
 * are gated on connection rows being present.
 */
import { authedTest as test, expect } from './fixtures';

test.describe('Banken page — account edit & delete', () => {
  test('page loads at /app/banken', async ({ page }) => {
    await page.goto('/app/banken');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('klar-banken-page')).toBeVisible({ timeout: 10000 });
  });

  test('edit pencil opens dialog when an account row exists', async ({ page }) => {
    await page.goto('/app/banken');
    await page.waitForLoadState('networkidle');

    // The pencil button is rendered per-account and labelled
    // "Konto <name> umbenennen / Sync ein-aus". If no FinTS connection is
    // attached in the test fixture, skip rather than fail.
    const editBtn = page.getByRole('button', { name: /umbenennen \/ Sync/i }).first();
    if ((await editBtn.count()) === 0) {
      test.skip(true, 'No FinTS account in fixture — UI smoke only');
      return;
    }
    await editBtn.click();
    await expect(page.getByText('Konto bearbeiten')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#account-name')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('delete confirmation surfaces cascade impact wording', async ({ page }) => {
    await page.goto('/app/banken');
    await page.waitForLoadState('networkidle');

    const deleteBtn = page.getByRole('button', { name: /Verbindung löschen|Bank löschen/i }).first();
    if ((await deleteBtn.count()) === 0) {
      test.skip(true, 'No FinTS connection in fixture');
      return;
    }
    await deleteBtn.click();
    // The confirm dialog renders "Verbindung löschen?" and mentions either the
    // dynamic counts ("Konto(en)", "Buchung(en)") or the fallback wording
    // ("FinTS-Konten und ihre Buchungen") — both are acceptable.
    await expect(page.getByText('Verbindung löschen?')).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText(/Konto\(en\)|FinTS-Konten und ihre Buchungen/i),
    ).toBeVisible();
    await page.getByRole('button', { name: /Abbrechen/i }).click();
  });
});
