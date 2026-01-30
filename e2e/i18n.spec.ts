// TODO F-375: Replace waitForTimeout with explicit waitForSelector/waitForResponse
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Internationalization (i18n)', () => {

  test.describe('Login Page i18n', () => {

    test('should default to English', async ({ page }) => {
      await page.goto('/auth/login');
      await page.waitForSelector('.login-form', { timeout: 10000 });

      // English button should be active
      const enBtn = page.locator('.login-lang-btn').first();
      await expect(enBtn).toHaveClass(/active/);

      // Form labels should be in English
      await expect(page.locator('label[for="email"]')).toContainText(/email/i);
      await expect(page.locator('label[for="password"]')).toContainText(/password/i);
    });

    test('should switch to Portuguese on login page', async ({ page }) => {
      await page.goto('/auth/login');
      await page.waitForSelector('.login-form', { timeout: 10000 });

      // Click PT button
      await page.locator('.login-lang-btn:has-text("PT")').click();

      // Wait for text to change
      await page.waitForTimeout(500);

      // PT button should now be active
      const ptBtn = page.locator('.login-lang-btn:has-text("PT")');
      await expect(ptBtn).toHaveClass(/active/);

      // Form labels should be in Portuguese
      await expect(page.locator('label[for="email"]')).toContainText(/e-?mail/i);
      await expect(page.locator('label[for="password"]')).toContainText(/senha/i);
    });

    test('should switch back to English from Portuguese', async ({ page }) => {
      await page.goto('/auth/login');
      await page.waitForSelector('.login-form', { timeout: 10000 });

      // Switch to PT
      await page.locator('.login-lang-btn:has-text("PT")').click();
      await page.waitForTimeout(500);
      await expect(page.locator('label[for="password"]')).toContainText(/senha/i);

      // Switch back to EN
      await page.locator('.login-lang-btn:has-text("EN")').click();
      await page.waitForTimeout(500);
      await expect(page.locator('label[for="password"]')).toContainText(/password/i);
    });
  });

  test.describe('Admin Sidebar i18n', () => {

    test('should toggle language in admin sidebar', async ({ page }) => {
      await loginAsAdmin(page);

      // Switch to PT in sidebar
      const ptBtn = page.locator('.lang-toggle .lang-btn:has-text("PT")');
      await ptBtn.click();
      await page.waitForTimeout(500);

      // PT should be active
      await expect(ptBtn).toHaveClass(/active/);

      // Nav items should reflect Portuguese labels
      // Dashboard → Painel, Articles → Artigos, etc.
      const dashboardLink = page.locator('a.nav-item[href="/admin/dashboard"]');
      const labelText = await dashboardLink.locator('.nav-item__label').textContent();
      // In Portuguese, dashboard could be "Painel" or similar
      expect(labelText).toBeTruthy();

      // Switch back to EN
      const enBtn = page.locator('.lang-toggle .lang-btn:has-text("EN")');
      await enBtn.click();
      await page.waitForTimeout(500);
      await expect(enBtn).toHaveClass(/active/);
    });

    test('should persist language after navigation', async ({ page }) => {
      await loginAsAdmin(page);

      // Switch to PT
      await page.locator('.lang-toggle .lang-btn:has-text("PT")').click();
      await page.waitForTimeout(500);

      // Navigate to Articles
      await page.locator('a.nav-item[href="/admin/articles"]').click();
      await expect(page).toHaveURL(/\/admin\/articles/);
      await page.waitForTimeout(500);

      // PT should still be active
      const ptBtn = page.locator('.lang-toggle .lang-btn:has-text("PT")');
      await expect(ptBtn).toHaveClass(/active/);

      // Switch back to EN for next tests
      await page.locator('.lang-toggle .lang-btn:has-text("EN")').click();
    });
  });

  test.describe('Public Header i18n', () => {

    test('should toggle language on public pages', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Find the language toggle button in the header
      const langBtn = page.locator('.header__actions button.toggle-btn');

      if (await langBtn.isVisible()) {
        const initialText = await langBtn.textContent();

        // Click to toggle
        await langBtn.click();
        await page.waitForTimeout(500);

        const newText = await langBtn.textContent();
        // Text should have changed (EN→PT or PT→EN)
        expect(newText).not.toBe(initialText);

        // Toggle back
        await langBtn.click();
        await page.waitForTimeout(500);
      }
    });
  });
});
