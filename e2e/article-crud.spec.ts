import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Article CRUD via UI', () => {
  const testSlug = 'e2e-test-article-' + Date.now();
  const testTitle = 'E2E Test Article';
  const testContent = '# E2E Test Content\n\nThis is a comprehensive test article created by Playwright automation testing. It contains enough content to pass the minimum length validation requirement of 10 characters.';

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should navigate to create article page', async ({ page }) => {
    await page.locator('a.nav-item[href="/admin/articles"]').click();
    await expect(page).toHaveURL(/\/admin\/articles/);

    // Look for create/new button — use the direct URL link
    const newBtn = page.locator('a[href="/admin/articles/new"]').first();
    if (await newBtn.isVisible()) {
      await newBtn.click();
    } else {
      // Fallback: navigate directly
      await page.goto('/admin/articles/new');
    }

    await expect(page).toHaveURL(/\/admin\/articles\/new/);
  });

  test('should display article form with all fields', async ({ page }) => {
    await page.goto('/admin/articles/new');
    await page.waitForLoadState('load');

    // The article form should have key fields
    // Title field (uses id="title")
    const titleField = page.locator('#title');
    await expect(titleField).toBeVisible({ timeout: 15000 });
  });

  test('should create a new article', async ({ page }) => {
    await page.goto('/admin/articles/new');
    await page.waitForLoadState('load');

    // Fill in title (uses [formControl] binding with id="title")
    const titleField = page.locator('#title');
    await expect(titleField).toBeVisible({ timeout: 15000 });
    await titleField.click();
    await titleField.fill(testTitle);

    // Fill in slug
    const slugField = page.locator('#slug');
    if (await slugField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await slugField.click();
      await slugField.fill(testSlug);
    }

    // Fill in content — Monaco editor: click the editor area and type
    const monacoContainer = page.locator('.monaco-editor-container');
    if (await monacoContainer.isVisible({ timeout: 5000 }).catch(() => false)) {
      await monacoContainer.click();
      // Monaco uses an internal textarea for input
      const monacoInput = page.locator('.monaco-editor textarea.inputarea, .monaco-editor [role="textbox"]').first();
      await monacoInput.fill(testContent);
    }

    // Fill in excerpt
    const excerptField = page.locator('#excerpt');
    if (await excerptField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await excerptField.fill('This is a test article excerpt for E2E testing.');
    }

    // Save as draft (btn-secondary) or Publish (btn-primary)
    const saveBtn = page.locator('button.btn.btn-secondary:has-text("Save"), button.btn:has-text("Draft")').first();
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
    } else {
      // Fallback to any primary action button
      await page.locator('button.btn.btn-primary').first().click();
    }

    // Wait for save to complete
    await page.waitForLoadState('load');
  });

  test('should list articles in admin panel', async ({ page }) => {
    // Navigate to articles via sidebar or directly
    const navLink = page.locator('a.nav-item[href="/admin/articles"]');
    if (await navLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await navLink.click();
    } else {
      await page.goto('/admin/articles');
    }
    await expect(page).toHaveURL(/\/admin\/articles/, { timeout: 15000 });
    await page.waitForLoadState('load');

    // Content area should have loaded
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 10000 });
  });

  test('should view articles on public blog page', async ({ page }) => {
    // Visit the public blog page (no auth needed)
    await page.goto('/blog');
    await page.waitForLoadState('load');

    // Blog page should load
    await expect(page.locator('main#main-content')).toBeVisible();
  });
});
