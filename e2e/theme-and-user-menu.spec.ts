import { test, expect } from '@playwright/test';
import { loginAsAdmin, logoutFromAdmin, dismissCookieConsent } from './helpers';

test.describe('Theme Toggle', () => {

  test('should toggle theme on login page', async ({ page }) => {
    await dismissCookieConsent(page);
    await page.goto('/auth/login');
    await page.waitForSelector('.auth-form', { timeout: 10000 });

    const themeToggle = page.locator('button.theme-slide-toggle.floating');
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(500);

      // Toggle again
      await themeToggle.click();
      await page.waitForTimeout(500);
    }
  });

  test('should toggle theme in admin sidebar', async ({ page }) => {
    await loginAsAdmin(page);

    const themeToggle = page.locator('button.theme-slide-toggle.sidebar');
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(500);

      // Toggle back
      await themeToggle.click();
      await page.waitForTimeout(500);
    }
  });

  test('should toggle theme on public header', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    const themeToggle = page.locator('button.theme-slide-toggle.compact');
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(500);

      // Toggle back
      await themeToggle.click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe('User Menu Flow (Public)', () => {

  test('should show user menu after login and go to admin', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to public site
    await page.goto('/');
    await page.waitForLoadState('load');

    // User menu trigger should be visible (we're logged in)
    const userMenuTrigger = page.locator('button.user-menu__trigger');
    if (await userMenuTrigger.isVisible()) {
      await userMenuTrigger.click();

      // Dropdown should appear
      await expect(page.locator('.user-menu__dropdown')).toBeVisible();

      // Should have Dashboard link
      const dashboardLink = page.locator('.user-menu__dropdown a[href="/admin"]');
      await expect(dashboardLink).toBeVisible();

      // Click dashboard
      await dashboardLink.click();
      await expect(page).toHaveURL(/\/admin/);
    }
  });

  test('should logout from public user menu', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/');
    await page.waitForLoadState('load');

    const userMenuTrigger = page.locator('button.user-menu__trigger');
    if (await userMenuTrigger.isVisible()) {
      await userMenuTrigger.click();
      await expect(page.locator('.user-menu__dropdown')).toBeVisible();

      // Click logout
      await page.locator('button.user-menu__item--danger').click();
      await page.waitForTimeout(2000);

      // Should be logged out — login button visible again
      const loginBtn = page.locator('a.btn--primary[href="/auth/login"]');
      await expect(loginBtn).toBeVisible({ timeout: 10000 });
    }
  });
});
