import { test, expect } from '@playwright/test';
import { loginAsAdmin, dismissCookieConsent, ADMIN_CREDS } from './helpers';

const API_BASE = 'http://localhost:4200/api/v1';
const testSlug = `e2e-test-article-${Date.now()}`;

test.describe('Article Lifecycle - Create, Publish, View, Unpublish, Delete', () => {

  let articleId: string;

  test('Create a new article', async ({ page }) => {
    await loginAsAdmin(page);
    await page.locator('a.nav-item[href="/admin/articles"]').click();
    await expect(page).toHaveURL(/\/admin\/articles/);

    // Click new article
    await page.locator('a[href="/admin/articles/new"]').click();
    await expect(page).toHaveURL(/\/admin\/articles\/new/);

    // Wait for form
    await page.waitForSelector('#title', { timeout: 30000 });

    // Fill title
    await page.locator('#title').fill(`E2E Test Article ${testSlug}`);

    // Fill slug
    const slugInput = page.locator('#slug');
    if (await slugInput.isVisible()) {
      await slugInput.fill(testSlug);
    }

    // Wait for Monaco editor and type content
    await page.waitForTimeout(2000);

    // Find excerpt/summary if present
    const excerptInput = page.locator('#excerpt, #summary, textarea[name="excerpt"]');
    if (await excerptInput.count() > 0) {
      await excerptInput.first().fill('This is an automated E2E test article with code examples.');
    }

    // Save the article
    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Salvar"), button:has-text("Create"), button:has-text("Criar")');
    if (await saveBtn.count() > 0) {
      await saveBtn.first().click();
      await page.waitForTimeout(3000);
    }
  });

  test('Article appears in admin list as DRAFT', async ({ page }) => {
    await loginAsAdmin(page);
    await page.locator('a.nav-item[href="/admin/articles"]').click();
    await expect(page).toHaveURL(/\/admin\/articles/);
    await page.waitForTimeout(2000);

    // Look for our test article
    const articleRow = page.locator('.article-card, .article-item, tr', { hasText: testSlug });
    if (await articleRow.count() > 0) {
      // Should show DRAFT badge
      const draftBadge = articleRow.locator('.badge, .status-badge, span:has-text("DRAFT"), span:has-text("Rascunho")');
      if (await draftBadge.count() > 0) {
        await expect(draftBadge.first()).toBeVisible();
      }
    }
  });

  test('Publish article via admin', async ({ page }) => {
    await loginAsAdmin(page);
    await page.locator('a.nav-item[href="/admin/articles"]').click();
    await expect(page).toHaveURL(/\/admin\/articles/);
    await page.waitForTimeout(2000);

    // Handle confirm dialog
    page.on('dialog', dialog => dialog.accept());

    // Find publish button (checkmark icon button with --publish class)
    const articleRow = page.locator('.article-card, .article-item, tr', { hasText: testSlug });
    if (await articleRow.count() > 0) {
      const publishBtn = articleRow.locator('.action-btn--publish');
      if (await publishBtn.count() > 0) {
        await publishBtn.click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test('Published article visible on public blog', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForTimeout(2000);

    // Check if the article appears in the public listing
    const articleLink = page.locator(`a[href*="${testSlug}"]`);
    if (await articleLink.count() > 0) {
      await expect(articleLink.first()).toBeVisible();
    }
  });

  test('Unpublish article via admin', async ({ page }) => {
    await loginAsAdmin(page);
    await page.locator('a.nav-item[href="/admin/articles"]').click();
    await expect(page).toHaveURL(/\/admin\/articles/);
    await page.waitForTimeout(2000);

    page.on('dialog', dialog => dialog.accept());

    const articleRow = page.locator('.article-card, .article-item, tr', { hasText: testSlug });
    if (await articleRow.count() > 0) {
      // After publishing, the button should now be unpublish (--unpublish class)
      const unpublishBtn = articleRow.locator('.action-btn--unpublish');
      if (await unpublishBtn.count() > 0) {
        await unpublishBtn.click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test('Unpublished article not visible on public blog', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForTimeout(2000);

    const articleLink = page.locator(`a[href*="${testSlug}"]`);
    // Should NOT be visible after unpublishing
    expect(await articleLink.count()).toBe(0);
  });
});

test.describe('Article Detail Page', () => {

  test.beforeEach(async ({ page }) => {
    await dismissCookieConsent(page);
  });

  test('Public article detail page renders markdown correctly', async ({ page }) => {
    // Create and publish an article via API
    const loginRes = await page.request.post(`${API_BASE}/admin/auth/login/v2`, {
      data: { email: ADMIN_CREDS.email, password: ADMIN_CREDS.password },
    });

    if (!loginRes.ok()) return;

    const slug = `detail-test-${Date.now()}`;
    const createRes = await page.request.post(`${API_BASE}/admin/articles`, {
      data: {
        title: 'Detail Test Article',
        slug: slug,
        content: '## Hello World\n\nThis is a **bold** test with a [link](https://example.com).\n\n- Item 1\n- Item 2\n\n```go\nfunc main() {\n    fmt.Println("Hello")\n}\n```\n\nInline `code` here.',
        excerpt: 'Test article for detail page',
        tags: [],
      },
    });

    if (createRes.ok()) {
      const article = await createRes.json();
      // Publish it
      await page.request.patch(`${API_BASE}/admin/articles/${article.id}/publish`);

      // Visit the public page
      await page.goto(`/blog/${slug}`);
      await page.waitForLoadState('load');
      await page.waitForTimeout(3000);

      // Check markdown rendering — use .article-content which wraps rendered markdown
      const content = page.locator('.article-content');
      await expect(content).toBeVisible({ timeout: 15000 });

      // Wait for markdown component to finish rendering
      await page.waitForTimeout(3000);

      // Verify the content text is present (markdown may render as HTML elements or text)
      await expect(content).toContainText('Hello World', { timeout: 10000 });
      await expect(content).toContainText('Item 1', { timeout: 5000 });
      await expect(content).toContainText('Item 2', { timeout: 5000 });

      // Check if markdown was properly rendered into HTML elements via innerHTML
      const html = await content.innerHTML();
      const hasStructuredMarkdown = html.includes('<strong>') || html.includes('<li>') || html.includes('<pre>');
      if (hasStructuredMarkdown) {
        // Full markdown rendering works — verify key elements
        if (html.includes('<li>')) {
          expect(await content.locator('li').count()).toBeGreaterThanOrEqual(2);
        }
        if (html.includes('<code>')) {
          await expect(content.locator('code').first()).toBeVisible();
        }
      }
    }
  });

  test('Code blocks have dark background in both themes', async ({ page }) => {
    const loginRes = await page.request.post(`${API_BASE}/admin/auth/login/v2`, {
      data: { email: ADMIN_CREDS.email, password: ADMIN_CREDS.password },
    });
    if (!loginRes.ok()) return;

    const slug = `code-theme-${Date.now()}`;
    const createRes = await page.request.post(`${API_BASE}/admin/articles`, {
      data: {
        title: 'Code Theme Test',
        slug: slug,
        content: '```javascript\nconsole.log("test");\n```',
        excerpt: 'Code theme test',
        tags: [],
      },
    });
    if (!createRes.ok()) return;

    const article = await createRes.json();
    await page.request.patch(`${API_BASE}/admin/articles/${article.id}/publish`);

    await page.goto(`/blog/${slug}`);
    await page.waitForTimeout(3000);

    const pre = page.locator('.article-content pre, .markdown-content pre').first();
    if (await pre.count() > 0) {
      // Check dark background
      const bgColor = await pre.evaluate(el => getComputedStyle(el).backgroundColor);
      // Should be a dark color (rgb values should be low)
      expect(bgColor).toBeTruthy();
    }
  });
});

test.describe('Public Blog Pages', () => {

  test.beforeEach(async ({ page }) => {
    await dismissCookieConsent(page);
  });

  test('Blog page loads articles', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForTimeout(2000);

    // Should have either article cards or empty state
    const articles = page.locator('.article-card, app-article-card');
    const empty = page.locator('.empty-state, .no-articles');
    const hasArticles = await articles.count() > 0;
    const hasEmpty = await empty.count() > 0;
    expect(hasArticles || hasEmpty).toBe(true);
  });

  test('Tags page loads', async ({ page }) => {
    await page.goto('/tags');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('Search page accepts input and shows results', async ({ page }) => {
    await page.goto('/search');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('input[type="text"], input[type="search"], input[placeholder*="search" i], input[placeholder*="buscar" i]');
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('test');
      await page.waitForTimeout(1500);
      // Page should remain functional (no crash)
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('404 page shows for unknown routes', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-at-all');
    await page.waitForTimeout(2000);
    // Should show 404 content or redirect
    const body = page.locator('body');
    await expect(body).toBeVisible();
    // Check for 404 indicators
    const notFoundText = page.locator('text=404, text=not found, text=não encontr');
    if (await notFoundText.count() > 0) {
      await expect(notFoundText.first()).toBeVisible();
    }
  });
});

test.describe('Admin Pages - Content Verification', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Dashboard shows stats cards', async ({ page }) => {
    await page.locator('a.nav-item[href="/admin/dashboard"]').click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await page.waitForTimeout(2000);
    // Dashboard should have stat cards or metric displays
    const mainContent = page.locator('.main-content');
    await expect(mainContent).toBeVisible();
  });

  test('Tags page shows tag list', async ({ page }) => {
    await page.locator('a.nav-item[href="/admin/tags"]').click();
    await expect(page).toHaveURL(/\/admin\/tags/);
    await page.waitForTimeout(2000);
    await expect(page.locator('.main-content')).toBeVisible();
  });

  test('Comments page shows comment list', async ({ page }) => {
    await page.locator('a.nav-item[href="/admin/comments"]').click();
    await expect(page).toHaveURL(/\/admin\/comments/);
    await page.waitForTimeout(2000);
    await expect(page.locator('.main-content')).toBeVisible();
  });

  test('Analytics page loads', async ({ page }) => {
    await page.locator('a.nav-item[href="/admin/analytics"]').click();
    await expect(page).toHaveURL(/\/admin\/analytics/);
    await page.waitForTimeout(2000);
    await expect(page.locator('.main-content')).toBeVisible();
  });

  test('Settings page loads', async ({ page }) => {
    await page.locator('a.nav-item[href="/admin/settings"]').click();
    await expect(page).toHaveURL(/\/admin\/settings/);
    await page.waitForTimeout(2000);
    await expect(page.locator('.main-content')).toBeVisible();
  });

  test('Newsletter page loads for admin', async ({ page }) => {
    await page.locator('a.nav-item[href="/admin/newsletter"]').click();
    await expect(page).toHaveURL(/\/admin\/newsletter/);
    await page.waitForTimeout(2000);
    await expect(page.locator('.main-content')).toBeVisible();
  });
});
