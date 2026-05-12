import { test, expect } from '@playwright/test';
import { loginAsAdmin, dismissCookieConsent } from './helpers';

test.describe('Modal accessibility (AccessibleModalDirective)', () => {
  test.beforeEach(async ({ page }) => {
    await dismissCookieConsent(page);
    await loginAsAdmin(page);
    await page.goto('/admin/users');
    await page.waitForSelector('.users-page, .admin-layout');
  });

  test('user-list modal: Escape key closes the modal', async ({ page }) => {
    // Open the "New User" modal
    const newUserBtn = page.locator('button.btn-primary', { hasText: /new user/i }).first();
    await newUserBtn.click();
    const modal = page.locator('.modal-overlay');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Press Escape on the modal — the directive should emit (close) → component closes it
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test('user-list modal: has role=dialog and aria-modal', async ({ page }) => {
    const newUserBtn = page.locator('button.btn-primary', { hasText: /new user/i }).first();
    await newUserBtn.click();
    const modal = page.locator('.modal-overlay');
    await expect(modal).toBeVisible();

    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    // labelledby points to the heading
    const labelledBy = await modal.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    if (labelledBy) {
      await expect(page.locator(`#${labelledBy}`)).toBeVisible();
    }

    // Cleanup
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('user-list modal: clicking overlay closes (and Escape works after re-open)', async ({ page }) => {
    const newUserBtn = page.locator('button.btn-primary', { hasText: /new user/i }).first();

    // First open: click overlay to close
    await newUserBtn.click();
    const modal = page.locator('.modal-overlay');
    await expect(modal).toBeVisible();
    // Click on the overlay (not inside the .modal child)
    await modal.click({ position: { x: 5, y: 5 } });
    await expect(modal).not.toBeVisible();

    // Second open: Escape close
    await newUserBtn.click();
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('user-list modal: focus moves into modal on open', async ({ page }) => {
    const newUserBtn = page.locator('button.btn-primary', { hasText: /new user/i }).first();
    await newUserBtn.click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    // The directive should auto-focus the first focusable element. Wait briefly for the
    // setTimeout(..., 0) inside the directive to run.
    await page.waitForTimeout(50);
    const activeTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA']).toContain(activeTag);

    // Verify the focused element is INSIDE the modal, not outside
    const focusedInsideModal = await page.evaluate(() => {
      const modal = document.querySelector('.modal-overlay');
      return modal?.contains(document.activeElement) ?? false;
    });
    expect(focusedInsideModal).toBe(true);

    await page.keyboard.press('Escape');
  });
});
