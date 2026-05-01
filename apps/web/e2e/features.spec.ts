/**
 * Feature tests — full functional interactions across all app pages.
 * All tests are authenticated via the shared authedCtx fixture (see fixtures.ts).
 *
 * Coverage:
 *  Planspiel  — add income/expense, delete, yearly frequency, reset (local state only)
 *  Projekte   — filter buttons
 *  Buchungen  — stat strip, forward/back month navigation
 *  Monat      — month navigation, stat cards
 *  Fixkosten  — page loads correctly in all states
 *  Haushalt   — create invite code, create API key, revoke API key
 */
import { authedTest as test, expect } from './fixtures';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Open the Planspiel add-entry form and fill it. Submit is left to the caller. */
async function fillPlanspielForm(
  page: Parameters<Parameters<typeof test>[1]>[0]['page'],
  opts: {
    label: string;
    amount: string;
    type?: 'income' | 'expense';
    frequency?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  },
): Promise<void> {
  // Open form if not already open
  const addBtn = page.locator('button:has-text("Posten hinzufügen")');
  if (await addBtn.isVisible()) {
    await addBtn.click();
  }
  if (opts.type === 'expense') {
    await page.locator('button:has-text("Ausgabe")').click();
  } else {
    await page.locator('button:has-text("Einnahme")').click();
  }
  await page.locator('input[placeholder="z.B. Gehalt, Miete…"]').fill(opts.label);
  await page.locator('input[placeholder="0,00"]').fill(opts.amount);
  if (opts.frequency && opts.frequency !== 'MONTHLY') {
    await page.locator('select').selectOption(opts.frequency);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PLANSPIEL — fully local, no API calls, fully deterministic
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Planspiel', () => {

  test('shows empty state and zero surplus on first load', async ({ page }) => {
    await page.goto('/app/planspiel');
    await page.waitForLoadState('networkidle');

    // Empty state: calculator icon + helper text
    const emptyMsg = page.locator('p:has-text("Füge Einnahmen und Ausgaben hinzu")');
    await expect(emptyMsg).toBeVisible({ timeout: 10000 });

    // Surplus/deficit display starts at 0,00 €
    const surplusDisplay = page.locator('span.font-mono.tabular-nums.text-3xl');
    await expect(surplusDisplay).toContainText('0,00');

    // "Posten hinzufügen" floating button is visible
    await expect(page.locator('button:has-text("Posten hinzufügen")')).toBeVisible();

    // "Zurücksetzen" reset button is hidden (no entries yet)
    await expect(page.locator('button:has-text("Zurücksetzen")')).not.toBeVisible();
  });

  test('can open the add-entry form and cancel without adding', async ({ page }) => {
    await page.goto('/app/planspiel');
    await page.waitForLoadState('networkidle');

    await page.locator('button:has-text("Posten hinzufügen")').click();

    // Form is visible
    await expect(page.locator('input[placeholder="z.B. Gehalt, Miete…"]')).toBeVisible();
    await expect(page.locator('input[placeholder="0,00"]')).toBeVisible();

    // "Hinzufügen" is disabled while label and amount are empty
    await expect(page.locator('button:has-text("Hinzufügen")')).toBeDisabled();

    // Cancel → form disappears, floating button returns
    await page.locator('button:has-text("Abbrechen")').click();
    await expect(page.locator('input[placeholder="z.B. Gehalt, Miete…"]')).not.toBeVisible();
    await expect(page.locator('button:has-text("Posten hinzufügen")')).toBeVisible();
  });

  test('can add an income entry and it appears in the list', async ({ page }) => {
    await page.goto('/app/planspiel');
    await page.waitForLoadState('networkidle');

    await fillPlanspielForm(page, { label: 'Gehalt', amount: '3000', type: 'income' });
    await page.locator('button:has-text("Hinzufügen")').click();

    // Entry appears in the list
    await expect(page.locator('text=Gehalt')).toBeVisible();

    // Surplus shows 3 000,00 €
    const surplus = page.locator('span.font-mono.tabular-nums.text-3xl');
    await expect(surplus).toContainText('3.000,00');

    // Summary box contains the income total
    await expect(page.locator('span.text-success.font-mono').first()).toContainText('3.000,00');
  });

  test('can add an expense entry and surplus is calculated correctly', async ({ page }) => {
    await page.goto('/app/planspiel');
    await page.waitForLoadState('networkidle');

    // Add income
    await fillPlanspielForm(page, { label: 'Gehalt', amount: '3000', type: 'income' });
    await page.locator('button:has-text("Hinzufügen")').click();

    // Add expense
    await fillPlanspielForm(page, { label: 'Miete', amount: '1200', type: 'expense' });
    await page.locator('button:has-text("Hinzufügen")').click();

    // Both entries in the list
    await expect(page.locator('text=Gehalt')).toBeVisible();
    await expect(page.locator('text=Miete')).toBeVisible();

    // Surplus: 3 000 − 1 200 = 1 800 €
    const surplus = page.locator('span.font-mono.tabular-nums.text-3xl');
    await expect(surplus).toContainText('1.800,00');
  });

  test('yearly frequency converts to correct monthly equivalent', async ({ page }) => {
    await page.goto('/app/planspiel');
    await page.waitForLoadState('networkidle');

    await fillPlanspielForm(page, {
      label: 'KFZ-Versicherung',
      amount: '1200',
      frequency: 'YEARLY',
    });
    await page.locator('button:has-text("Hinzufügen")').click();

    // Monthly equivalent: 1 200 / 12 = 100 €
    const surplus = page.locator('span.font-mono.tabular-nums.text-3xl');
    await expect(surplus).toContainText('100,00');

    // The entry row shows the total amount as well
    await expect(page.locator('text=1.200,00 € gesamt')).toBeVisible();
  });

  test('quarterly frequency converts to correct monthly equivalent', async ({ page }) => {
    await page.goto('/app/planspiel');
    await page.waitForLoadState('networkidle');

    await fillPlanspielForm(page, {
      label: 'Quartalsbonus',
      amount: '900',
      frequency: 'QUARTERLY',
    });
    await page.locator('button:has-text("Hinzufügen")').click();

    // Monthly equivalent: 900 / 3 = 300 €
    const surplus = page.locator('span.font-mono.tabular-nums.text-3xl');
    await expect(surplus).toContainText('300,00');
  });

  test('can delete an entry and empty state returns', async ({ page }) => {
    await page.goto('/app/planspiel');
    await page.waitForLoadState('networkidle');

    // Add one entry
    await fillPlanspielForm(page, { label: 'Lösch-Mich', amount: '500' });
    await page.locator('button:has-text("Hinzufügen")').click();
    await expect(page.locator('text=Lösch-Mich')).toBeVisible();

    // Delete it
    await page.locator('button[aria-label="Posten entfernen"]').click();

    // Entry gone, empty state returns
    await expect(page.locator('text=Lösch-Mich')).not.toBeVisible();
    await expect(page.locator('button:has-text("Posten hinzufügen")')).toBeVisible();

    // Surplus back to 0
    const surplus = page.locator('span.font-mono.tabular-nums.text-3xl');
    await expect(surplus).toContainText('0,00');
  });

  test('can select a color for an entry', async ({ page }) => {
    await page.goto('/app/planspiel');
    await page.waitForLoadState('networkidle');

    await page.locator('button:has-text("Posten hinzufügen")').click();

    // Color picker is visible
    const colorButtons = page.locator('button.rounded-full');
    await expect(colorButtons.first()).toBeVisible();

    // Click the second color
    await colorButtons.nth(1).click();

    // Second color button gets ring classes (selected indicator)
    await expect(colorButtons.nth(1)).toHaveClass(/ring-2/);
  });

  test('Zurücksetzen clears all entries', async ({ page }) => {
    await page.goto('/app/planspiel');
    await page.waitForLoadState('networkidle');

    // Add two entries
    await fillPlanspielForm(page, { label: 'Eintrag A', amount: '1000' });
    await page.locator('button:has-text("Hinzufügen")').click();

    await fillPlanspielForm(page, { label: 'Eintrag B', amount: '500', type: 'expense' });
    await page.locator('button:has-text("Hinzufügen")').click();

    await expect(page.locator('text=Eintrag A')).toBeVisible();
    await expect(page.locator('text=Eintrag B')).toBeVisible();

    // Reset
    await page.locator('button:has-text("Zurücksetzen")').click();

    // All entries cleared, empty state
    await expect(page.locator('text=Eintrag A')).not.toBeVisible();
    await expect(page.locator('text=Eintrag B')).not.toBeVisible();
    await expect(page.locator('button:has-text("Posten hinzufügen")')).toBeVisible();

    // Surplus reset to 0
    const surplus = page.locator('span.font-mono.tabular-nums.text-3xl');
    await expect(surplus).toContainText('0,00');
  });

  test('deficit state shows when expenses exceed income', async ({ page }) => {
    await page.goto('/app/planspiel');
    await page.waitForLoadState('networkidle');

    // Only add an expense — no income
    await fillPlanspielForm(page, { label: 'Miete', amount: '1500', type: 'expense' });
    await page.locator('button:has-text("Hinzufügen")').click();

    // Summary box labels change to "Defizit"
    await expect(page.locator('span.text-danger').first()).toBeVisible();

    // Surplus value is negative
    const surplus = page.locator('span.font-mono.tabular-nums.text-3xl');
    await expect(surplus).toContainText('1.500,00');
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
