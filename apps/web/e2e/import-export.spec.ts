import { authedTest as test, expect } from './fixtures';
import path from 'path';
import fs from 'fs';
import os from 'os';

test.describe('Import / Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/settings');
    await expect(page.getByText('Import / Export')).toBeVisible({ timeout: 10000 });
  });

  test('Export section renders with checkboxes and export button', async ({ page }) => {
    await expect(page.getByText('Buchungen')).toBeVisible();
    await expect(page.getByText('Fixkosten')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exportieren' })).toBeVisible();
  });

  test('Export button triggers file download with valid JSON', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportieren' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/klar-export-\d{4}-\d{2}-\d{2}\.json/);

    const filePath = await download.path();
    expect(filePath).not.toBeNull();
    const content = JSON.parse(fs.readFileSync(filePath!, 'utf-8')) as { version: string };
    expect(content.version).toBe('1');
  });

  test('Date filter inputs are visible', async ({ page }) => {
    const dateInputs = page.locator('input[type="date"]');
    await expect(dateInputs.first()).toBeVisible();
    await dateInputs.first().fill('2025-01-01');
    await expect(dateInputs.first()).toHaveValue('2025-01-01');
  });

  test('Import section renders with file button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'JSON-Datei wählen' })).toBeVisible();
  });

  test('Import valid export file — shows success toast', async ({ page }) => {
    // Export first to get a valid file
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportieren' }).click(),
    ]);
    const tmpPath = path.join(os.tmpdir(), 'klar-test-import.json');
    await download.saveAs(tmpPath);

    // Import the file via the hidden input
    await page.locator('input[type="file"]').setInputFiles(tmpPath);

    // Wait for success toast
    await expect(page.getByText(/importiert/i)).toBeVisible({ timeout: 15000 });

    fs.unlinkSync(tmpPath);
  });

  test('Import invalid JSON — shows error message', async ({ page }) => {
    const tmpPath = path.join(os.tmpdir(), 'klar-bad.json');
    fs.writeFileSync(tmpPath, '{"not":"a klar file"}');

    await page.locator('input[type="file"]').setInputFiles(tmpPath);

    // Should show either a toast error or the inline error bar
    await expect(
      page.getByText(/ungültige|schema|fehler/i).first()
    ).toBeVisible({ timeout: 10000 });

    fs.unlinkSync(tmpPath);
  });

  test('Mobile layout — Import / Export section visible at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app/settings');
    await expect(page.getByText('Import / Export')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Exportieren' })).toBeVisible();
  });
});
