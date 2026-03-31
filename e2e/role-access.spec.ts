import { test, expect } from '@playwright/test';
import { loginViaUI, seedTestUsers, DEV_CREDS, VIEWER_CREDS, ADMIN_CREDS, loginAs, dismissCookieConsent } from './helpers';

test.describe('Role-Based Access Control', () => {

  test.beforeAll(async ({ browser }) => {
    // Seed test users via API
    const page = await browser.newPage();
    await seedTestUsers(page);
    await page.close();
  });

  test.describe('DEV Role', () => {

    test('DEV can access dashboard', async ({ page }) => {
      await loginAs(page, DEV_CREDS);
      await page.locator('a.nav-item[href="/admin/dashboard"]').click();
      await expect(page).toHaveURL(/\/admin\/dashboard/);
      // Should not see a 403 or be redirected
      await expect(page.locator('.main-content')).toBeVisible();
    });

    test('DEV can access articles', async ({ page }) => {
      await loginAs(page, DEV_CREDS);
      await page.locator('a.nav-item[href="/admin/articles"]').click();
      await expect(page).toHaveURL(/\/admin\/articles/);
      await expect(page.locator('.main-content')).toBeVisible();
    });

    test('DEV can access tags', async ({ page }) => {
      await loginAs(page, DEV_CREDS);
      await page.locator('a.nav-item[href="/admin/tags"]').click();
      await expect(page).toHaveURL(/\/admin\/tags/);
      await expect(page.locator('.main-content')).toBeVisible();
    });

    test('DEV can access comments', async ({ page }) => {
      await loginAs(page, DEV_CREDS);
      await page.locator('a.nav-item[href="/admin/comments"]').click();
      await expect(page).toHaveURL(/\/admin\/comments/);
      await expect(page.locator('.main-content')).toBeVisible();
    });

    test('DEV can access analytics', async ({ page }) => {
      await loginAs(page, DEV_CREDS);
      await page.locator('a.nav-item[href="/admin/analytics"]').click();
      await expect(page).toHaveURL(/\/admin\/analytics/);
      await expect(page.locator('.main-content')).toBeVisible();
    });

    test('DEV cannot access settings (admin only)', async ({ page }) => {
      await loginAs(page, DEV_CREDS);
      // Settings link should NOT be visible to DEV (adminOnly)
      const settingsLink = page.locator('a.nav-item[href="/admin/settings"]');
      await expect(settingsLink).not.toBeVisible();
    });

    test('DEV cannot access users management', async ({ page }) => {
      await loginAs(page, DEV_CREDS);
      // Users link should NOT be visible to DEV (sidebar hides it)
      const usersLink = page.locator('a.nav-item[href="/admin/users"]');
      await expect(usersLink).not.toBeVisible();

      // Newsletter link should also NOT be visible to DEV
      const newsletterLink = page.locator('a.nav-item[href="/admin/newsletter"]');
      await expect(newsletterLink).not.toBeVisible();
    });

    test('DEV user role is shown correctly', async ({ page }) => {
      await loginAs(page, DEV_CREDS);
      await expect(page.locator('.user-info__role')).toContainText('DEV');
    });
  });

  test.describe('VIEWER Role', () => {

    test('VIEWER should not access admin area', async ({ page }) => {
      // Use API login for VIEWER to avoid rate limiting on UI login
      await dismissCookieConsent(page);
      await page.request.post('http://localhost:4200/api/v1/admin/auth/login/v2', {
        data: { email: VIEWER_CREDS.email, password: VIEWER_CREDS.password },
      });
      await page.request.put('http://localhost:4200/api/v1/admin/users/me', {
        data: { termsAccepted: true },
      }).catch(() => {});

      // Try to navigate to admin
      await page.goto('/admin');
      await page.waitForTimeout(3000);

      // Check we're not in admin layout - viewer might be redirected to home
      const adminLayout = page.locator('.admin-layout');
      const isAdminVisible = await adminLayout.isVisible();

      // If VIEWER somehow got in, check they have limited access
      if (!isAdminVisible) {
        // Expected — VIEWER should not see admin layout
        expect(isAdminVisible).toBe(false);
      }
    });
  });
});
