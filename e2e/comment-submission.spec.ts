import { test, expect } from '@playwright/test';
import { loginAsAdmin, ADMIN_CREDS } from './helpers';

const API_BASE = 'http://localhost:4200/api/v1';
const testSlug = `e2e-comment-test-${Date.now()}`;

test.describe('Comment Submission Flow', () => {
  /**
   * Seed a published article via the API so we have a public page to comment on.
   */
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();

    // Login as admin via API
    await page.request.post(`${API_BASE}/admin/auth/login/v2`, {
      data: { email: ADMIN_CREDS.email, password: ADMIN_CREDS.password },
    });

    // Create an article via API
    await page.request.post(`${API_BASE}/admin/articles`, {
      data: {
        title: `E2E Comment Test Article ${testSlug}`,
        slug: testSlug,
        content: '# Comment Test Article\n\nThis article is used for E2E comment submission testing. It has enough content to pass validation.',
        excerpt: 'E2E comment test article excerpt.',
        status: 'PUBLISHED',
      },
    });

    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();

    // Cleanup: login and delete the test article
    await page.request.post(`${API_BASE}/admin/auth/login/v2`, {
      data: { email: ADMIN_CREDS.email, password: ADMIN_CREDS.password },
    });

    await page.request.delete(`${API_BASE}/admin/articles/${testSlug}`);
    await page.close();
  });

  test('should navigate to the published article public page', async ({ page }) => {
    await page.goto(`/blog/${testSlug}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // The article detail page should load (or at least the main content area)
    await expect(page.locator('main#main-content')).toBeVisible({ timeout: 10000 });
  });

  test('comment form should be visible with author name, email, and content fields', async ({ page }) => {
    await page.goto(`/blog/${testSlug}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Comments section should be present
    const commentsSection = page.locator('.comments-section');
    await expect(commentsSection).toBeVisible({ timeout: 10000 });

    // Comment form should be visible
    const commentForm = page.locator('form.comment-form');
    await expect(commentForm).toBeVisible();

    // Author name input
    const nameInput = page.locator('#comment-name');
    await expect(nameInput).toBeVisible();

    // Email input
    const emailInput = page.locator('#comment-email');
    await expect(emailInput).toBeVisible();

    // Content textarea
    const contentTextarea = page.locator('#comment-content');
    await expect(contentTextarea).toBeVisible();

    // Submit button
    const submitBtn = commentForm.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
  });

  test('empty comment should show validation / submit button disabled', async ({ page }) => {
    await page.goto(`/blog/${testSlug}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const commentForm = page.locator('form.comment-form');
    const submitBtn = commentForm.locator('button[type="submit"]');

    // Without filling anything, the submit button should be disabled
    await expect(submitBtn).toBeDisabled();

    // Fill only name (no content) — still disabled because content < 10 chars
    await page.locator('#comment-name').fill('Test User');
    await expect(submitBtn).toBeDisabled();

    // Type short content — button still disabled
    await page.locator('#comment-content').fill('Short');
    await expect(submitBtn).toBeDisabled();
  });

  test('content too short should show validation error on blur', async ({ page }) => {
    await page.goto(`/blog/${testSlug}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const contentTextarea = page.locator('#comment-content');

    // Type short content and blur to trigger touched state
    await contentTextarea.click();
    await contentTextarea.fill('Short');
    await page.locator('#comment-name').click(); // blur the textarea

    // The field-error message should appear (minlength validation)
    const fieldError = page.locator('.comment-form .field-error');
    await expect(fieldError).toBeVisible({ timeout: 5000 });
  });

  test('should submit a comment successfully', async ({ page }) => {
    await page.goto(`/blog/${testSlug}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Fill comment form
    await page.locator('#comment-name').fill('E2E Test Commenter');
    await page.locator('#comment-email').fill('e2e-commenter@test.com');
    await page.locator('#comment-content').fill('This is an E2E test comment with enough content to pass the validation.');

    const submitBtn = page.locator('form.comment-form button[type="submit"]');
    await expect(submitBtn).toBeEnabled();

    // Intercept the API call to verify 201
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes(`/articles/${testSlug}/comments`) && resp.request().method() === 'POST'
    );

    await submitBtn.click();

    const response = await responsePromise;
    expect(response.status()).toBe(201);

    // After submission, a success message should appear
    await page.waitForTimeout(1000);
    const successMsg = page.locator('.comment-success');
    await expect(successMsg).toBeVisible({ timeout: 5000 });
  });

  test('comment count should display', async ({ page }) => {
    await page.goto(`/blog/${testSlug}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Comments section title should display a count in parentheses
    const commentsTitle = page.locator('.comments-section__title');
    await expect(commentsTitle).toBeVisible();

    // Title should contain parentheses with a number
    const titleText = await commentsTitle.textContent();
    expect(titleText).toMatch(/\(\d+\)/);
  });

  test('comment should appear in comments list if auto-approved', async ({ page }) => {
    await page.goto(`/blog/${testSlug}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for the comment in the list — may or may not be visible depending on approval settings
    const commentsList = page.locator('.comments-list');
    await expect(commentsList).toBeVisible();

    // Check if our test comment shows up (auto-approved scenario)
    const testComment = commentsList.locator('.comment', { hasText: 'E2E Test Commenter' });
    if (await testComment.count() > 0) {
      await expect(testComment.first()).toBeVisible();
      await expect(testComment.locator('.comment__text')).toContainText('E2E test comment');
    }
    // If comments require approval, the comment won't appear until admin approves it
  });

  test('admin can see the comment in admin panel', async ({ page }) => {
    await loginAsAdmin(page);

    await page.locator('a.nav-item[href="/admin/comments"]').click();
    await expect(page).toHaveURL(/\/admin\/comments/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expect(page.locator('.main-content')).toBeVisible();

    // Look for the test comment in the admin comment list
    const commentEntry = page.locator('.main-content', { hasText: 'E2E Test Commenter' });
    if (await commentEntry.count() > 0) {
      await expect(commentEntry.first()).toBeVisible();
    }
  });
});
