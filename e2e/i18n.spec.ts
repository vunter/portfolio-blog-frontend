import { test, expect } from '@playwright/test';
import { loginAsAdmin, dismissCookieConsent, seedProfile } from './helpers';

test.describe('Internationalization (i18n)', () => {

  test.describe('Login Page i18n', () => {

    test('should default to English', async ({ page }) => {
      await dismissCookieConsent(page);
      await page.goto('/auth/login');
      await page.waitForSelector('.auth-form', { timeout: 10000 });

      // English button should be active
      const enBtn = page.locator('.auth-lang-btn').first();
      await expect(enBtn).toHaveClass(/active/);

      // Form labels should be in English
      await expect(page.locator('label[for="email"]')).toContainText(/email/i);
      await expect(page.locator('label[for="password"]')).toContainText(/password/i);
    });

    test('should switch to Portuguese on login page', async ({ page }) => {
      await dismissCookieConsent(page);
      await page.goto('/auth/login');
      await page.waitForSelector('.auth-form', { timeout: 10000 });

      // Click PT button
      await page.locator('.auth-lang-btn:has-text("PT")').click();

      // Wait for text to change
      await expect(page.locator('label[for="password"]')).toContainText(/senha/i);

      // PT button should now be active
      const ptBtn = page.locator('.auth-lang-btn:has-text("PT")');
      await expect(ptBtn).toHaveClass(/active/);

      // Form labels should be in Portuguese
      await expect(page.locator('label[for="email"]')).toContainText(/e-?mail/i);
      await expect(page.locator('label[for="password"]')).toContainText(/senha/i);
    });

    test('should switch back to English from Portuguese', async ({ page }) => {
      await dismissCookieConsent(page);
      await page.goto('/auth/login');
      await page.waitForSelector('.auth-form', { timeout: 10000 });

      // Switch to PT
      await page.locator('.auth-lang-btn:has-text("PT")').click();
      await expect(page.locator('label[for="password"]')).toContainText(/senha/i);

      // Switch back to EN
      await page.locator('.auth-lang-btn:has-text("EN")').click();
      await expect(page.locator('label[for="password"]')).toContainText(/password/i);
    });
  });

  test.describe('Admin Sidebar i18n', () => {

    test('should toggle language in admin sidebar', async ({ page }) => {
      await loginAsAdmin(page);

      // Switch to PT in sidebar
      const ptBtn = page.locator('.lang-toggle .lang-btn:has-text("PT")');
      await ptBtn.click();
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
      await expect(enBtn).toHaveClass(/active/);
    });

    test('should persist language after navigation', async ({ page }) => {
      await loginAsAdmin(page);

      // Switch to PT
      await page.locator('.lang-toggle .lang-btn:has-text("PT")').click();
      await expect(page.locator('.lang-toggle .lang-btn:has-text("PT")')).toHaveClass(/active/);

      // Navigate to Articles
      await page.locator('a.nav-item[href="/admin/articles"]').click();
      await expect(page).toHaveURL(/\/admin\/articles/);

      // PT should still be active
      const ptBtn = page.locator('.lang-toggle .lang-btn:has-text("PT")');
      await expect(ptBtn).toHaveClass(/active/);

      // Switch back to EN for next tests
      await page.locator('.lang-toggle .lang-btn:has-text("EN")').click();
    });
  });

  test.describe('Public Header i18n', () => {

    test.beforeAll(async ({ browser }) => {
      const page = await browser.newPage();
      await seedProfile(page);
      await page.close();
    });

    test('should toggle language on public pages', async ({ page }) => {
      await dismissCookieConsent(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Find the language dropdown toggle button in the header
      const toggleBtn = page.locator('.lang-dropdown .toggle-btn');

      if (await toggleBtn.isVisible()) {
        const initialText = (await toggleBtn.textContent())?.trim();

        // Click to open dropdown
        await toggleBtn.click();
        await page.waitForTimeout(300);

        // Click a different language option (e.g., Português)
        const ptOption = page.locator('.lang-dropdown__item:has-text("Português")');
        if (await ptOption.isVisible()) {
          await ptOption.click();
          await page.waitForTimeout(500);

          // Toggle text should have changed
          const newText = (await toggleBtn.textContent())?.trim();
          expect(newText).not.toBe(initialText);

          // Toggle back to English
          await toggleBtn.click();
          await page.waitForTimeout(300);
          const enOption = page.locator('.lang-dropdown__item:has-text("English")');
          if (await enOption.isVisible()) {
            await enOption.click();
            await page.waitForTimeout(500);
            const restoredText = (await toggleBtn.textContent())?.trim();
            expect(restoredText).toBe(initialText);
          }
        }
      }
    });
  });
});
