import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Admin Navigation', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should display sidebar with all navigation items', async ({ page }) => {
    const sidebar = page.locator('aside.sidebar');
    await expect(sidebar).toBeVisible();

    // Verify key nav items exist
    const navItems = page.locator('.sidebar__nav a.nav-item');
    const count = await navItems.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('should navigate to Dashboard', async ({ page }) => {
    await page.locator('a.nav-item[href="/admin/dashboard"]').click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.locator('.main-content')).toBeVisible();
  });

  test('should navigate to Articles', async ({ page }) => {
    await page.locator('a.nav-item[href="/admin/articles"]').click();
    await expect(page).toHaveURL(/\/admin\/articles/);
    await expect(page.locator('.main-content')).toBeVisible();
  });

  test('should navigate to Tags', async ({ page }) => {
    await page.locator('a.nav-item[href="/admin/tags"]').click();
    await expect(page).toHaveURL(/\/admin\/tags/);
    await expect(page.locator('.main-content')).toBeVisible();
  });

  test('should navigate to Comments', async ({ page }) => {
    await page.locator('a.nav-item[href="/admin/comments"]').click();
    await expect(page).toHaveURL(/\/admin\/comments/);
    await expect(page.locator('.main-content')).toBeVisible();
  });

  test('should navigate to Users (admin only)', async ({ page }) => {
    await page.locator('a.nav-item[href="/admin/users"]').click();
    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page.locator('.main-content')).toBeVisible();
  });

  test('should navigate to Analytics', async ({ page }) => {
    await page.locator('a.nav-item[href="/admin/analytics"]').click();
    await expect(page).toHaveURL(/\/admin\/analytics/);
    await expect(page.locator('.main-content')).toBeVisible();
  });

  test('should navigate to Newsletter', async ({ page }) => {
    await page.locator('a.nav-item[href="/admin/newsletter"]').click();
    await expect(page).toHaveURL(/\/admin\/newsletter/);
    await expect(page.locator('.main-content')).toBeVisible();
  });

  test('should navigate to Settings', async ({ page }) => {
    await page.locator('a.nav-item[href="/admin/settings"]').click();
    await expect(page).toHaveURL(/\/admin\/settings/);
    await expect(page.locator('.main-content')).toBeVisible();
  });

  test('should highlight active nav item', async ({ page }) => {
    await page.locator('a.nav-item[href="/admin/articles"]').click();
    await expect(page).toHaveURL(/\/admin\/articles/);
    await expect(page.locator('a.nav-item[href="/admin/articles"]')).toHaveClass(/active/);
  });

  test('should toggle sidebar collapse', async ({ page }) => {
    const layout = page.locator('.admin-layout');
    const toggleBtn = page.locator('button.sidebar__toggle');

    // Initially expanded
    await expect(layout).not.toHaveClass(/sidebar-collapsed/);

    // Collapse
    await toggleBtn.click();
    await expect(layout).toHaveClass(/sidebar-collapsed/);

    // Expand
    await toggleBtn.click();
    await expect(layout).not.toHaveClass(/sidebar-collapsed/);
  });

  test('should display user info in sidebar', async ({ page }) => {
    await expect(page.locator('.user-info__name')).toBeVisible();
    await expect(page.locator('.user-info__role')).toContainText('ADMIN');
  });

  test('should navigate back to public site', async ({ page }) => {
    await page.locator('a.back-link').click();
    await expect(page).toHaveURL('/');
  });
});
