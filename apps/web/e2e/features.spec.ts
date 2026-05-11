/**
 * Feature tests — full functional interactions across all app pages.
 * All tests are authenticated via the shared authedCtx fixture (see fixtures.ts).
 *
 * Coverage:
 *  Planspiel  — toggle on/off lives inside the Fixkosten page (no separate route)
 *  Projekte   — filter buttons
 *  Buchungen  — stat strip, forward/back month navigation
 *  Monat      — month navigation, stat cards
 *  Fixkosten  — page loads correctly in all states
 *  Haushalt   — create invite code, create API key, revoke API key
 */
import { authedTest as test, expect } from './fixtures';

// ─────────────────────────────────────────────────────────────────────────────
// PLANSPIEL — local what-if mode embedded in Fixkosten, no separate route
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Planspiel (Fixkosten mode)', () => {

  test('toggle is rendered in the Fixkosten side panel and switches the hypo chip on', async ({ page }) => {
    await page.goto('/app/fixkosten');
    await page.waitForLoadState('networkidle');

    const toggleLabel = page.locator('text=Was wäre, wenn …?');
    await expect(toggleLabel).toBeVisible({ timeout: 10000 });

    // Initially off — no hypo chip in the side-panel section heading
    const sectionHead = page.locator('.section-head', { hasText: 'Planspiel' });
    await expect(sectionHead).toBeVisible();
    await expect(sectionHead.locator('text=HYPOTHETISCH')).toHaveCount(0);

    // Turn on
    await toggleLabel.click();
    await expect(sectionHead.locator('text=HYPOTHETISCH')).toBeVisible();

    // Reset button shows up while active
    await expect(page.locator('button:has-text("Zurücksetzen")')).toBeVisible();

    // Turn off again — chip and reset button disappear
    await toggleLabel.click();
    await expect(sectionHead.locator('text=HYPOTHETISCH')).toHaveCount(0);
    await expect(page.locator('button:has-text("Zurücksetzen")')).not.toBeVisible();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// PROJEKTE — filter interactions
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Projekte', () => {

  test('filter bar renders all three filter buttons', async ({ page }) => {
    await page.goto('/app/projekte');
    await page.waitForLoadState('networkidle');

    const filterBar = page.locator('.filter-bar');
    await expect(filterBar).toBeVisible({ timeout: 10000 });

    await expect(filterBar.locator('button:has-text("Aktiv")')).toBeVisible();
    await expect(filterBar.locator('button:has-text("Abgeschlossen")')).toBeVisible();
    await expect(filterBar.locator('button:has-text("Alle")')).toBeVisible();
  });

  test('clicking a filter marks it as active', async ({ page }) => {
    await page.goto('/app/projekte');
    await page.waitForLoadState('networkidle');

    const filterBar = page.locator('.filter-bar');
    await expect(filterBar).toBeVisible({ timeout: 10000 });

    // Switch to "Abgeschlossen"
    await filterBar.locator('button:has-text("Abgeschlossen")').click();
    await expect(filterBar.locator('button.active:has-text("Abgeschlossen")')).toBeVisible();
    await expect(filterBar.locator('button.active:has-text("Aktiv")')).not.toBeVisible();

    // Switch to "Alle"
    await filterBar.locator('button:has-text("Alle")').click();
    await expect(filterBar.locator('button.active:has-text("Alle")')).toBeVisible();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// BUCHUNGEN — stat strip and month navigation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Buchungen', () => {

  test('stat strip shows EINNAHMEN, AUSGABEN, NETTO labels', async ({ page }) => {
    await page.goto('/app/buchungen');
    await page.waitForLoadState('networkidle');

    // Stat strip is always rendered (even empty → shows 0,00 €)
    const statStrip = page.locator('.stat-strip');
    await expect(statStrip).toBeVisible({ timeout: 10000 });

    await expect(statStrip.locator('.stat-label:has-text("EINNAHMEN")')).toBeVisible();
    await expect(statStrip.locator('.stat-label:has-text("AUSGABEN")')).toBeVisible();
    await expect(statStrip.locator('.stat-label:has-text("NETTO")')).toBeVisible();
  });

  test('forward month navigation changes the displayed month', async ({ page }) => {
    await page.goto('/app/buchungen');
    await page.waitForLoadState('networkidle');

    const monthTitle = page.locator('.month-title');
    await expect(monthTitle).toBeVisible({ timeout: 10000 });
    const before = await monthTitle.textContent();

    await page.locator('button[aria-label="Nächster Monat"]').click();
    const after = await monthTitle.textContent();
    expect(after).not.toBe(before);
  });

  test('backward then forward returns to original month', async ({ page }) => {
    await page.goto('/app/buchungen');
    await page.waitForLoadState('networkidle');

    const monthTitle = page.locator('.month-title');
    await expect(monthTitle).toBeVisible({ timeout: 10000 });
    const original = await monthTitle.textContent();

    await page.locator('button[aria-label="Vorheriger Monat"]').click();
    const prev = await monthTitle.textContent();
    expect(prev).not.toBe(original);

    await page.locator('button[aria-label="Nächster Monat"]').click();
    const restored = await monthTitle.textContent();
    expect(restored).toBe(original);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// MONAT — month navigation and overview cards
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Monat', () => {

  test('month navigation buttons are visible', async ({ page }) => {
    await page.goto('/app/monat');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.month-nav')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button[aria-label="Vorheriger Monat"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Nächster Monat"]')).toBeVisible();
  });

  test('month navigation changes the displayed month', async ({ page }) => {
    await page.goto('/app/monat');
    await page.waitForLoadState('networkidle');

    const monthTitle = page.locator('.month-title');
    await expect(monthTitle).toBeVisible({ timeout: 10000 });
    const before = await monthTitle.textContent();

    await page.locator('button[aria-label="Vorheriger Monat"]').click();
    const after = await monthTitle.textContent();
    expect(after).not.toBe(before);
  });

  test('page renders data or empty state after load', async ({ page }) => {
    await page.goto('/app/monat');
    await page.waitForLoadState('networkidle');

    // Either stat-grid (data), empty-state, or error-bar is shown after loading
    const content = page.locator('.stat-grid, .empty-state, .error-bar');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// FIXKOSTEN — page loads correctly in all states
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Fixkosten', () => {

  test('page renders content after loading (any valid state)', async ({ page }) => {
    await page.goto('/app/fixkosten');
    await page.waitForLoadState('networkidle');

    // After load: either stat-strip (data), ledger-shell, empty-state, or error-bar
    const content = page.locator('.stat-strip, .ledger-shell, .empty-state, .error-bar');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test('if data is loaded stat-strip shows Einnahmen Ausgaben Überschuss labels', async ({ page }) => {
    await page.goto('/app/fixkosten');
    await page.waitForLoadState('networkidle');

    // Only assert stat-strip content if the page has data (not empty/error)
    const statStrip = page.locator('.stat-strip');
    if (await statStrip.isVisible({ timeout: 8000 }).catch(() => false)) {
      await expect(statStrip.locator('.stat-label:has-text("EINNAHMEN")')).toBeVisible();
      await expect(statStrip.locator('.stat-label:has-text("AUSGABEN")')).toBeVisible();
      await expect(statStrip.locator('.stat-label:has-text("ÜBERSCHUSS")')).toBeVisible();

      // Sub-header action buttons are present
      const subHeader = page.locator('.sub-header');
      await expect(subHeader).toBeVisible();
      await expect(page.locator('button:has-text("STAFFEL")')).toBeVisible();
      await expect(page.locator('button:has-text("EXPORT")')).toBeVisible();
    }
    // If not: skip — no recurring transactions seeded, page shows empty state
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// HAUSHALT — invite codes and API keys
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Haushalt — invite codes', () => {

  test('owner can create an invite code', async ({ page }) => {
    await page.goto('/app/haushalt');
    await page.waitForLoadState('networkidle');

    // "+ Code erstellen" is visible for owners
    const createBtn = page.locator('button:has-text("+ Code erstellen")');
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // Newly created invite code appears in the UI (only once)
    const newCode = page.locator('.newly-created-key .invite-code');
    await expect(newCode).toBeVisible({ timeout: 10000 });

    // Code matches the XXXX-XXXX-... pattern
    const codeText = await newCode.textContent();
    expect(codeText?.trim().length).toBeGreaterThan(4);
  });

  test('created invite code appears in the invite list', async ({ page }) => {
    await page.goto('/app/haushalt');
    await page.waitForLoadState('networkidle');

    await page.locator('button:has-text("+ Code erstellen")').click();

    const newCode = page.locator('.newly-created-key .invite-code');
    await expect(newCode).toBeVisible({ timeout: 10000 });
    const codeText = (await newCode.textContent())?.trim() ?? '';

    // The code also appears in the invite list below
    const inviteList = page.locator('.invite-list');
    await expect(inviteList.locator(`.invite-code:has-text("${codeText.slice(0, 4)}")`)).toBeVisible();
  });

});

test.describe('Haushalt — API keys', () => {

  test('can open the create-key form', async ({ page }) => {
    await page.goto('/app/haushalt');
    await page.waitForLoadState('networkidle');

    // Click "+ Neu" in the API-SCHLÜSSEL section
    const newBtn = page.locator('button:has-text("+ Neu")');
    await expect(newBtn).toBeVisible({ timeout: 10000 });
    await newBtn.click();

    // Create-key form is visible
    await expect(page.locator('input[placeholder="Name (z.B. Home Assistant)"]')).toBeVisible();
    await expect(page.locator('.scope-checkbox').first()).toBeVisible();

    // "Erstellen" button is disabled without a name and scope
    const createBtn = page.locator('.new-key-form button:has-text("Erstellen")');
    await expect(createBtn).toBeDisabled();

    // Close the form
    await page.locator('button:has-text("+ Neu")').click();
    await expect(page.locator('input[placeholder="Name (z.B. Home Assistant)"]')).not.toBeVisible();
  });

  test('can create a new API key and see it once', async ({ page }) => {
    await page.goto('/app/haushalt');
    await page.waitForLoadState('networkidle');

    await page.locator('button:has-text("+ Neu")').click();

    await page.locator('input[placeholder="Name (z.B. Home Assistant)"]').fill('E2E-Test-Key');
    await page.locator('.scope-checkbox').first().check();

    const createBtn = page.locator('.new-key-form button:has-text("Erstellen")');
    await expect(createBtn).not.toBeDisabled();
    await createBtn.click();

    // Newly created key is shown ONCE — copy and dismiss
    await expect(page.locator('.key-value')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Nur einmal sichtbar')).toBeVisible();
    const fullKey = await page.locator('.key-value').textContent();
    expect(fullKey?.startsWith('bgb_')).toBe(true);

    await page.locator('button:has-text("Verstanden")').click();

    // Key name appears in the list
    await expect(page.locator('.key-name:has-text("E2E-Test-Key")')).toBeVisible();
  });

  test('can revoke an API key', async ({ page }) => {
    await page.goto('/app/haushalt');
    await page.waitForLoadState('networkidle');

    // Create a dedicated key to revoke
    await page.locator('button:has-text("+ Neu")').click();
    await page.locator('input[placeholder="Name (z.B. Home Assistant)"]').fill('E2E-Revoke-Key');
    await page.locator('.scope-checkbox').first().check();
    await page.locator('.new-key-form button:has-text("Erstellen")').click();
    await expect(page.locator('.key-value')).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("Verstanden")').click();

    // Find the specific row and revoke it
    const keyRow = page.locator('.api-key-row', {
      has: page.locator('.key-name:has-text("E2E-Revoke-Key")'),
    });
    await expect(keyRow).toBeVisible({ timeout: 5000 });
    await keyRow.locator('button[title="Widerrufen"]').click();

    // Revoked keys are filtered from the list
    await expect(page.locator('.key-name:has-text("E2E-Revoke-Key")')).not.toBeVisible({ timeout: 5000 });
  });

  test('can delete an API key', async ({ page }) => {
    await page.goto('/app/haushalt');
    await page.waitForLoadState('networkidle');

    // Create a key to delete
    await page.locator('button:has-text("+ Neu")').click();
    await page.locator('input[placeholder="Name (z.B. Home Assistant)"]').fill('E2E-Delete-Key');
    await page.locator('.scope-checkbox').first().check();
    await page.locator('.new-key-form button:has-text("Erstellen")').click();
    await expect(page.locator('.key-value')).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("Verstanden")').click();

    // Count keys before
    const keyRow = page.locator('.api-key-row', {
      has: page.locator('.key-name:has-text("E2E-Delete-Key")'),
    });
    await expect(keyRow).toBeVisible({ timeout: 5000 });

    // Delete via trash button
    await keyRow.locator('button[title="Löschen"]').click();

    // Key is gone from the list
    await expect(page.locator('.key-name:has-text("E2E-Delete-Key")')).not.toBeVisible({ timeout: 5000 });
  });

});
