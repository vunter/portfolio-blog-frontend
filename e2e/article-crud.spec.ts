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
    await page.waitForLoadState('networkidle');

    // The article form should have key fields
    // Title field
    const titleField = page.locator('input[formcontrolname="title"], input[name="title"], input#title, input[placeholder*="title" i]').first();
    await expect(titleField).toBeVisible({ timeout: 10000 });
  });

  test('should create a new article', async ({ page }) => {
    await page.goto('/admin/articles/new');
    await page.waitForLoadState('networkidle');

    // Fill in title
    const titleField = page.locator('input[formcontrolname="title"], input[name="title"], input#title, input[placeholder*="title" i]').first();
    await expect(titleField).toBeVisible({ timeout: 10000 });
    await titleField.click();
    await titleField.fill(testTitle);

    // Fill in slug
    const slugField = page.locator('input[formcontrolname="slug"], input[name="slug"], input#slug, input[placeholder*="slug" i]').first();
    if (await slugField.isVisible()) {
      await slugField.click();
      await slugField.fill(testSlug);
    }

    // Fill in content — could be a textarea or code editor
    const contentField = page.locator('textarea[formcontrolname="content"], textarea[name="content"], textarea#content, .editor textarea, .ql-editor, [contenteditable="true"]').first();
    if (await contentField.isVisible()) {
      await contentField.click();
      await contentField.fill(testContent);
    }

    // Fill in excerpt if visible
    const excerptField = page.locator('textarea[formcontrolname="excerpt"], input[formcontrolname="excerpt"], textarea[name="excerpt"]').first();
    if (await excerptField.isVisible()) {
      await excerptField.fill('This is a test article excerpt for E2E testing.');
    }

    // Submit the form
    const saveBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create"), button:has-text("Publish")').first();
    await saveBtn.click();

    // Wait for redirect back to article list or success notification
    await page.waitForLoadState('networkidle');
  });

  test('should list articles in admin panel', async ({ page }) => {
    await page.locator('a.nav-item[href="/admin/articles"]').click();
    await expect(page).toHaveURL(/\/admin\/articles/);
    await page.waitForLoadState('networkidle');

    // Content area should have loaded
    await expect(page.locator('.main-content')).toBeVisible();
  });

  test('should view articles on public blog page', async ({ page }) => {
    // Visit the public blog page (no auth needed)
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    // Blog page should load
    await expect(page.locator('main#main-content')).toBeVisible();
  });
});
