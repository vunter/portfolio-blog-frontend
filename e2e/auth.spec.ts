import { test, expect } from '@playwright/test';
import { loginViaUI, loginAsAdmin, logoutFromAdmin, ADMIN_CREDS } from './helpers';

test.describe('Authentication Flows', () => {

  test('should display login page with all form elements', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForSelector('.login-form', { timeout: 10000 });

    // Verify all form elements are present
    await expect(page.locator('.login-header h1')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button.submit-btn')).toBeVisible();
    await expect(page.locator('input[name="remember"]')).toBeVisible();
    await expect(page.locator('a.forgot-link')).toBeVisible();

    // Language toggle buttons
    await expect(page.locator('.login-lang-btn').first()).toBeVisible();
  });

  test('should login successfully with valid admin credentials', async ({ page }) => {
    await loginAsAdmin(page);

    // Should land on admin dashboard
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator('.admin-layout')).toBeVisible();

    // User info should show admin details
    await expect(page.locator('.user-info__name')).toBeVisible();
    await expect(page.locator('.user-info__role')).toContainText('ADMIN');
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await loginViaUI(page, 'admin@catananti.dev', 'wrongpassword123');

    // Wait for error alert to appear
    await expect(page.locator('.error-alert')).toBeVisible({ timeout: 10000 });
  });

  test('should show error with non-existent user', async ({ page }) => {
    await loginViaUI(page, 'nonexistent@test.com', 'somepassword123');

    await expect(page.locator('.error-alert')).toBeVisible({ timeout: 10000 });
  });

  test('should toggle password visibility', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForSelector('.login-form', { timeout: 10000 });

    const passwordInput = page.locator('#password');
    const toggleBtn = page.locator('button.toggle-password');

    // Initially password type
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle — should show password
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click again — should hide
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should check remember me checkbox', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForSelector('.login-form', { timeout: 10000 });

    const checkbox = page.locator('input[name="remember"]');
    await expect(checkbox).not.toBeChecked();

    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });

  test('should logout from admin and redirect to login', async ({ page }) => {
    await loginAsAdmin(page);

    // Verify we're in admin
    await expect(page.locator('.admin-layout')).toBeVisible();

    // Click logout
    await logoutFromAdmin(page);

    // Should redirect to home (logout goes to /)
    await expect(page).toHaveURL('/');

    // Login button should be visible on home page (user logged out)
    await expect(page.locator('a.btn--primary[href="/auth/login"]')).toBeVisible({ timeout: 10000 });
  });

  test('should redirect unauthenticated users from admin to login', async ({ page }) => {
    await page.goto('/admin/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 });
  });

  test('should not allow submit with empty fields', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForSelector('.login-form', { timeout: 10000 });

    const submitBtn = page.locator('button.submit-btn');

    // Click submit without filling fields
    await submitBtn.click();

    // Should still be on login page (form validation prevents submission)
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
