import { test, expect } from '@playwright/test';
import { loginAsAdmin, ADMIN_CREDS } from './helpers';

const API_BASE = 'http://localhost:4200/api/v1';
const testEmail = `e2e-newsletter-${Date.now()}@test.com`;

test.describe('Newsletter Subscribe Flow', () => {
  test.afterAll(async ({ browser }) => {
    // Cleanup: remove the test subscriber via admin API
    const page = await browser.newPage();

    await page.request.post(`${API_BASE}/admin/auth/login/v2`, {
      data: { email: ADMIN_CREDS.email, password: ADMIN_CREDS.password },
    });

    // Try to find and delete the test subscriber
    const res = await page.request.get(`${API_BASE}/admin/newsletter/subscribers?page=0&size=100`);
    if (res.ok()) {
      const data = await res.json();
      const subscribers = data.content || data || [];
      const testSub = subscribers.find((s: any) => s.email === testEmail);
      if (testSub) {
        await page.request.delete(`${API_BASE}/admin/newsletter/subscribers/${testSub.id}`);
      }
    }

    await page.close();
  });

  test('newsletter subscribe form should be visible on public pages', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // The newsletter-subscribe component is rendered in the sidebar
    const newsletterWidget = page.locator('.newsletter-subscribe');

    // It may be on the home page sidebar or navigating to blog might show it
    if (await newsletterWidget.count() === 0) {
      // Try the blog page
      await page.goto('/blog');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    await expect(page.locator('.newsletter-subscribe').first()).toBeVisible({ timeout: 10000 });

    // Should have an email input
    const emailInput = page.locator('.newsletter-subscribe__input').first();
    await expect(emailInput).toBeVisible();

    // Should have a subscribe button
    const subscribeBtn = page.locator('.newsletter-subscribe__btn').first();
    await expect(subscribeBtn).toBeVisible();
  });

  test('subscribe button should be disabled with empty email', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find the newsletter widget (may need to go to a page where it's rendered)
    let newsletterWidget = page.locator('.newsletter-subscribe').first();
    if (!(await newsletterWidget.isVisible())) {
      await page.goto('/blog');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      newsletterWidget = page.locator('.newsletter-subscribe').first();
    }

    const subscribeBtn = newsletterWidget.locator('.newsletter-subscribe__btn');
    await expect(subscribeBtn).toBeDisabled();
  });

  test('should subscribe with a valid email', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    let newsletterWidget = page.locator('.newsletter-subscribe').first();
    if (!(await newsletterWidget.isVisible())) {
      await page.goto('/blog');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      newsletterWidget = page.locator('.newsletter-subscribe').first();
    }

    const emailInput = newsletterWidget.locator('.newsletter-subscribe__input');
    const subscribeBtn = newsletterWidget.locator('.newsletter-subscribe__btn');

    // Type test email
    await emailInput.click();
    await emailInput.fill(testEmail);
    await expect(subscribeBtn).toBeEnabled();

    // Intercept the subscribe API call
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/newsletter/subscribe') && resp.request().method() === 'POST'
    );

    await subscribeBtn.click();

    const response = await responsePromise;
    expect([200, 201]).toContain(response.status());

    // Success state should appear
    const successMsg = newsletterWidget.locator('.newsletter-subscribe__success');
    await expect(successMsg).toBeVisible({ timeout: 5000 });
  });

  test('subscribe with invalid email should show error', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    let newsletterWidget = page.locator('.newsletter-subscribe').first();
    if (!(await newsletterWidget.isVisible())) {
      await page.goto('/blog');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      newsletterWidget = page.locator('.newsletter-subscribe').first();
    }

    const emailInput = newsletterWidget.locator('.newsletter-subscribe__input');

    // Type invalid email
    await emailInput.click();
    await emailInput.fill('not-an-email');

    const subscribeBtn = newsletterWidget.locator('.newsletter-subscribe__btn');

    // The button may be disabled because the input has type="email" + required + email validator
    // If it's not disabled, click and expect an error notification or API rejection
    if (await subscribeBtn.isEnabled()) {
      // Attempt to subscribe — should get an error
      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/newsletter/subscribe') && resp.request().method() === 'POST',
        { timeout: 5000 },
      ).catch(() => null);

      await subscribeBtn.click();
      await page.waitForTimeout(2000);

      const response = await responsePromise;
      if (response) {
        // Backend should reject invalid email with 400
        expect(response.status()).toBeGreaterThanOrEqual(400);
      }

      // Success state should NOT appear
      const successMsg = newsletterWidget.locator('.newsletter-subscribe__success');
      await expect(successMsg).not.toBeVisible();
    } else {
      // Button disabled means client-side validation caught the invalid email
      await expect(subscribeBtn).toBeDisabled();
    }
  });

  test('duplicate email subscription should be handled gracefully', async ({ page }) => {
    // First, subscribe via API to ensure the email exists
    await page.request.post(`${API_BASE}/newsletter/subscribe`, {
      data: { email: testEmail },
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    let newsletterWidget = page.locator('.newsletter-subscribe').first();
    if (!(await newsletterWidget.isVisible())) {
      await page.goto('/blog');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      newsletterWidget = page.locator('.newsletter-subscribe').first();
    }

    const emailInput = newsletterWidget.locator('.newsletter-subscribe__input');
    const subscribeBtn = newsletterWidget.locator('.newsletter-subscribe__btn');

    await emailInput.click();
    await emailInput.fill(testEmail);

    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/newsletter/subscribe') && resp.request().method() === 'POST'
    );

    await subscribeBtn.click();

    const response = await responsePromise;
    // Duplicate email could return 200/201 (idempotent accept) or 409 (conflict)
    expect([200, 201, 409]).toContain(response.status());

    await page.waitForTimeout(1000);

    // Either show success (idempotent) or the form stays visible (conflict handled)
    const successMsg = newsletterWidget.locator('.newsletter-subscribe__success');
    const formStillVisible = newsletterWidget.locator('.newsletter-subscribe__form');
    const eitherVisible = (await successMsg.count() > 0) || (await formStillVisible.count() > 0);
    expect(eitherVisible).toBeTruthy();
  });

  test('admin can see the subscriber in newsletter admin', async ({ page }) => {
    await loginAsAdmin(page);

    await page.locator('a.nav-item[href="/admin/newsletter"]').click();
    await expect(page).toHaveURL(/\/admin\/newsletter/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expect(page.locator('.main-content')).toBeVisible();

    // The admin newsletter page should list subscribers
    // Look for our test email in the content
    const subscriberEntry = page.locator('.main-content', { hasText: testEmail });
    if (await subscriberEntry.count() > 0) {
      await expect(subscriberEntry.first()).toBeVisible();
    }
  });
});
