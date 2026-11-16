import { test, expect } from '@playwright/test';

test.describe('Multi-Tenant Messaging Platform E2E Workflows', () => {
  test('1. Dashboard loads and shows tenant indicator and statistics', async ({ page }) => {
    await page.goto('/');

    // Check title / heading
    await expect(page.locator('h2')).toContainText('Platform Overview');

    // Check tenant selector is present
    const tenantSelect = page.locator('select');
    await expect(tenantSelect).toBeVisible();

    // Check KPI cards
    await expect(page.getByText('Total Messages')).toBeVisible();
    await expect(page.getByText('Delivery Status Distribution')).toBeVisible();
  });

  test('2. Create outgoing message and verify in queue', async ({ page }) => {
    await page.goto('/messages');

    // Open Create Message Modal
    await page.getByRole('button', { name: 'Create Message' }).click();

    // Form should appear
    await expect(page.getByText('Create Outgoing Message')).toBeVisible();

    // Fill message text
    await page.locator('textarea[name="text"]').fill('Playwright test dispatch order 9999');

    // Submit
    await page.getByRole('button', { name: 'Create Message' }).last().click();

    // Verify modal closes and message appears in table with QUEUED status
    await expect(page.getByText('Playwright test dispatch order 9999')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Queued').first()).toBeVisible();
  });

  test('3. Simulator dispatches webhook event and applies transition', async ({ page }) => {
    // Navigate to simulator
    await page.goto('/simulator');

    await expect(page.locator('h2')).toContainText('Provider Webhook Simulator');

    // Select the first message from the dropdown if available
    const msgSelect = page.locator('select').first();
    const count = await msgSelect.locator('option').count();

    if (count > 1) {
      // Select the message
      await msgSelect.selectOption({ index: 1 });

      // Click "Send SENT"
      await page.getByRole('button', { name: 'Send SENT' }).click();

      // Verify API response body contains APPLIED or DUPLICATE
      await expect(page.getByText(/APPLIED|DUPLICATE/)).toBeVisible({ timeout: 10000 });
    }
  });

  test('4. Event Logs displays recorded audit events', async ({ page }) => {
    await page.goto('/events');

    await expect(page.locator('h2')).toContainText('Webhook Event Logs');
    await expect(page.locator('table')).toBeVisible();
  });
});
