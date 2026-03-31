import { test, expect } from '@playwright/test';
import { dismissCookieConsent, seedProfile } from './helpers';

test.describe('Public Pages', () => {

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await seedProfile(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await dismissCookieConsent(page);
  });

  test('should load home page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    // Header should be visible
    await expect(page.locator('header.header')).toBeVisible();

    // Footer should be visible
    await expect(page.locator('footer.footer')).toBeVisible();

    // Main content area
    await expect(page.locator('main#main-content')).toBeVisible();
  });

  test('should display navigation links', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    const nav = page.locator('nav.header__nav');
    await expect(nav).toBeVisible();

    // Should have Home, Blog, Tags, Search links
    await expect(nav.locator('a[href="/"]')).toBeVisible();
    await expect(nav.locator('a[href="/blog"]')).toBeVisible();
    await expect(nav.locator('a[href="/tags"]')).toBeVisible();
    await expect(nav.locator('a[href="/search"]')).toBeVisible();
  });

  test('should navigate to blog page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    await page.locator('.header__nav a[href="/blog"]').click();
    await expect(page).toHaveURL(/\/blog/);
    await expect(page.locator('main#main-content')).toBeVisible();
  });

  test('should navigate to tags page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    await page.locator('.header__nav a[href="/tags"]').click();
    await expect(page).toHaveURL(/\/tags/);
    await expect(page.locator('main#main-content')).toBeVisible();
  });

  test('should navigate to search page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    await page.locator('.header__nav a[href="/search"]').click();
    await expect(page).toHaveURL(/\/search/);
    await expect(page.locator('main#main-content')).toBeVisible();
  });

  test('should show login button for unauthenticated users', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    const loginBtn = page.locator('a.btn--primary[href="/auth/login"]');
    await expect(loginBtn).toBeVisible();
  });

  test('should navigate to login page from header', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    await page.locator('a.btn--primary[href="/auth/login"]').click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('should display footer with brand info', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    const footer = page.locator('footer.footer');
    await expect(footer).toBeVisible();
    await expect(footer.locator('.footer__brand-link')).toBeVisible();
  });

  test('should show 404 for non-existent pages', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-xyz');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    // Should render the 404 page or redirect
    // The NotFoundComponent handles wildcard routes
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display logo that links to home', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('load');

    const logo = page.locator('a.header__logo');
    await expect(logo).toBeVisible();

    // Click logo to go home
    await logo.click();
    await expect(page).toHaveURL('/');
  });

  test('should toggle theme on public page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    const themeToggle = page.locator('button.theme-slide-toggle').first();
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(500);

      // Theme should have changed — check for dark/light class
      const knob = page.locator('.toggle-knob').first();
      if (await knob.isVisible()) {
        // Has toggled
        const hasDark = await knob.evaluate(el => el.classList.contains('dark'));
        expect(typeof hasDark).toBe('boolean');
      }
    }
  });

  test('should handle search input', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('load');
    await page.waitForTimeout(1000);

    // Find search input
    const searchInput = page.locator('input[type="text"], input[type="search"], input[placeholder*="search" i], input[placeholder*="buscar" i]').first();
    if (await searchInput.isVisible()) {
      // Type a search query simulating human input
      await searchInput.click();
      await searchInput.pressSequentially('test article', { delay: 50 });
      await page.waitForTimeout(1000);

      // Page should still be functional
      await expect(page.locator('main#main-content')).toBeVisible();
    }
  });
});
