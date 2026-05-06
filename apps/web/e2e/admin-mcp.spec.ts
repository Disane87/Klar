import { authedTest as test, expect } from './fixtures';

test.describe('Admin → MCP tab', () => {
  test('renders MCP tab with virtual list and filter bar', async ({ page }) => {
    await page.goto('/app/admin');
    await page.waitForLoadState('networkidle');

    // Switch to MCP tab.
    await page.getByRole('button', { name: 'MCP' }).first().click();

    // Tab subcomponent rendered.
    await expect(page.locator('klar-admin-mcp-tab')).toBeVisible();

    // Filter bar present with tool name input.
    await expect(
      page.locator('klar-admin-mcp-tab input[placeholder*="transactions.list"]'),
    ).toBeVisible();

    // Virtual scroll viewport mounted.
    await expect(
      page.locator('klar-admin-mcp-tab cdk-virtual-scroll-viewport'),
    ).toBeAttached();
  });

  test('typing in tool filter triggers /admin/mcp request with toolName param', async ({ page }) => {
    await page.goto('/app/admin');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'MCP' }).first().click();

    const reqPromise = page.waitForRequest(
      (req) =>
        req.url().includes('/api/v1/admin/mcp') &&
        req.url().includes('toolName=transactions.list'),
      { timeout: 5000 },
    );

    const toolInput = page.locator('klar-admin-mcp-tab input[placeholder*="transactions.list"]');
    await toolInput.fill('transactions.list');

    const req = await reqPromise;
    expect(req.url()).toContain('toolName=transactions.list');
  });

  test('audit tab still works after refactor', async ({ page }) => {
    await page.goto('/app/admin');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('klar-admin-audit-tab')).toBeVisible();
    // Section header reflects total count once loaded.
    await expect(page.locator('klar-admin-audit-tab')).toContainText('Audit Log');
  });
});
