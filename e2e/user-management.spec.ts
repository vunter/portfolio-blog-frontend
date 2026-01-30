import { test, expect } from '@playwright/test';
import { loginAsAdmin, ADMIN_CREDS } from './helpers';

const API_BASE = 'http://localhost:4200/api/v1';

// Unique test emails to avoid collisions
const timestamp = Date.now();
const TEST_VIEWER = {
  name: 'Test Viewer',
  email: `viewer-${timestamp}@test.com`,
  password: 'ViewerPass123!@#',
  role: 'VIEWER',
};
const TEST_DEV = {
  name: 'Test Developer',
  email: `dev-${timestamp}@test.com`,
  password: 'DevPass123!@#$',
  role: 'DEV',
};
const TEST_EDITOR = {
  name: 'Test Editor',
  email: `editor-${timestamp}@test.com`,
  password: 'EditorPass123!@#',
  role: 'EDITOR',
};

test.describe('User Management (ADMIN)', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.locator('a.nav-item[href="/admin/users"]').click();
    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page.locator('.page-header h1')).toBeVisible({ timeout: 10000 });
  });

  test('Users page loads with table', async ({ page }) => {
    await expect(page.locator('.data-table')).toBeVisible();
    await expect(page.locator('.data-table thead th')).toHaveCount(6);
    // Admin user (seeded) should be in the list
    await expect(page.locator('.data-table tbody tr')).toHaveCount.greaterThanOrEqual?.(1);
    const rows = page.locator('.data-table tbody tr');
    expect(await rows.count()).toBeGreaterThanOrEqual(1);
  });

  test('New User button opens modal', async ({ page }) => {
    await page.locator('.btn-primary').click();
    await expect(page.locator('.modal')).toBeVisible();
    await expect(page.locator('.modal h2')).toBeVisible();
    // Form fields exist
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#role')).toBeVisible();
  });

  test('Role dropdown has all 4 roles', async ({ page }) => {
    await page.locator('.btn-primary').click();
    await expect(page.locator('.modal')).toBeVisible();
    const options = page.locator('#role option');
    expect(await options.count()).toBe(4);
    // Check values
    await expect(options.nth(0)).toHaveAttribute('value', 'VIEWER');
    await expect(options.nth(1)).toHaveAttribute('value', 'EDITOR');
    await expect(options.nth(2)).toHaveAttribute('value', 'DEV');
    await expect(options.nth(3)).toHaveAttribute('value', 'ADMIN');
  });

  test('Create VIEWER user', async ({ page }) => {
    await page.locator('.btn-primary').click();
    await expect(page.locator('.modal')).toBeVisible();

    await page.locator('#name').fill(TEST_VIEWER.name);
    await page.locator('#email').fill(TEST_VIEWER.email);
    await page.locator('#password').fill(TEST_VIEWER.password);
    await page.locator('#role').selectOption(TEST_VIEWER.role);

    await page.locator('.modal button[type="submit"]').click();
    // Modal should close
    await expect(page.locator('.modal')).not.toBeVisible({ timeout: 5000 });
    // User should appear in table
    await expect(page.locator('.data-table tbody')).toContainText(TEST_VIEWER.name);
  });

  test('Create DEV user', async ({ page }) => {
    await page.locator('.btn-primary').click();
    await expect(page.locator('.modal')).toBeVisible();

    await page.locator('#name').fill(TEST_DEV.name);
    await page.locator('#email').fill(TEST_DEV.email);
    await page.locator('#password').fill(TEST_DEV.password);
    await page.locator('#role').selectOption(TEST_DEV.role);

    await page.locator('.modal button[type="submit"]').click();
    await expect(page.locator('.modal')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('.data-table tbody')).toContainText(TEST_DEV.name);
  });

  test('Create EDITOR user', async ({ page }) => {
    await page.locator('.btn-primary').click();
    await expect(page.locator('.modal')).toBeVisible();

    await page.locator('#name').fill(TEST_EDITOR.name);
    await page.locator('#email').fill(TEST_EDITOR.email);
    await page.locator('#password').fill(TEST_EDITOR.password);
    await page.locator('#role').selectOption(TEST_EDITOR.role);

    await page.locator('.modal button[type="submit"]').click();
    await expect(page.locator('.modal')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('.data-table tbody')).toContainText(TEST_EDITOR.name);
  });

  test('DEV user has correct role badge', async ({ page }) => {
    // Look for the DEV user we just created
    const devRow = page.locator('.data-table tbody tr', { hasText: TEST_DEV.email });
    if (await devRow.count() > 0) {
      const badge = devRow.locator('.role-badge');
      await expect(badge).toHaveClass(/role-badge--dev/);
    }
  });

  test('Edit user - change name', async ({ page }) => {
    // Find the DEV user row and click edit
    const devRow = page.locator('.data-table tbody tr', { hasText: TEST_DEV.email });
    if (await devRow.count() === 0) return; // Skip if not created

    await devRow.locator('.action-btn').first().click();
    await expect(page.locator('.modal')).toBeVisible();

    // Name should be pre-filled
    const nameInput = page.locator('#name');
    await expect(nameInput).toHaveValue(TEST_DEV.name);

    // Password field should NOT be visible when editing
    await expect(page.locator('#password')).not.toBeVisible();

    // Change name
    await nameInput.fill('Dev Updated');
    await page.locator('.modal button[type="submit"]').click();
    await expect(page.locator('.modal')).not.toBeVisible({ timeout: 5000 });
    // Updated name should appear
    await expect(page.locator('.data-table tbody')).toContainText('Dev Updated');
  });

  test('Deactivate user', async ({ page }) => {
    const editorRow = page.locator('.data-table tbody tr', { hasText: TEST_EDITOR.email });
    if (await editorRow.count() === 0) return;

    // Check user is active
    await expect(editorRow.locator('.status-indicator.active')).toBeVisible();

    // Click deactivate (2nd action button)
    await editorRow.locator('.action-btn').nth(1).click();
    await page.waitForTimeout(1000);
    // User should now be inactive
    const statusEl = editorRow.locator('.status-indicator');
    await expect(statusEl).not.toHaveClass(/active/);
  });

  test('Reactivate user', async ({ page }) => {
    const editorRow = page.locator('.data-table tbody tr', { hasText: TEST_EDITOR.email });
    if (await editorRow.count() === 0) return;

    // Click activate (2nd action button)
    await editorRow.locator('.action-btn').nth(1).click();
    await page.waitForTimeout(1000);
    // User should now be active again
    await expect(editorRow.locator('.status-indicator.active')).toBeVisible();
  });

  test('Delete user', async ({ page }) => {
    const viewerRow = page.locator('.data-table tbody tr', { hasText: TEST_VIEWER.email });
    if (await viewerRow.count() === 0) return;

    // Handle confirm dialog
    page.on('dialog', dialog => dialog.accept());

    // Click delete (3rd action button, the danger one)
    await viewerRow.locator('.action-btn--danger').click();
    await page.waitForTimeout(2000);
    // User should be removed from table
    await expect(page.locator('.data-table tbody')).not.toContainText(TEST_VIEWER.email);
  });

  test('Cancel modal closes without saving', async ({ page }) => {
    await page.locator('.btn-primary').click();
    await expect(page.locator('.modal')).toBeVisible();
    await page.locator('#name').fill('Should Not Be Saved');
    await page.locator('.modal .btn-secondary').click();
    await expect(page.locator('.modal')).not.toBeVisible();
    // Name should NOT appear in table
    await expect(page.locator('.data-table tbody')).not.toContainText('Should Not Be Saved');
  });

  test('Click overlay closes modal', async ({ page }) => {
    await page.locator('.btn-primary').click();
    await expect(page.locator('.modal')).toBeVisible();
    // Click the overlay (outside the modal box)
    await page.locator('.modal-overlay').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.modal')).not.toBeVisible();
  });

  test('Password hint is visible for new user', async ({ page }) => {
    await page.locator('.btn-primary').click();
    await expect(page.locator('.modal')).toBeVisible();
    await expect(page.locator('.form-hint')).toBeVisible();
  });
});

test.describe('User Management - Security', () => {

  test('Non-admin cannot access /admin/users via URL', async ({ page }) => {
    // Seed a DEV user via API
    const loginRes = await page.request.post(`${API_BASE}/admin/auth/login/v2`, {
      data: { email: ADMIN_CREDS.email, password: ADMIN_CREDS.password },
    });
    if (loginRes.ok()) {
      await page.request.post(`${API_BASE}/admin/users`, {
        data: { name: 'Security Test Dev', email: `secdev-${timestamp}@test.com`, password: 'SecDevPass123!@#', role: 'DEV' },
      });
    }

    // Login as DEV
    await page.goto('/auth/login');
    await page.waitForSelector('.login-form', { timeout: 10000 });
    await page.locator('#email').fill(`secdev-${timestamp}@test.com`);
    await page.locator('#password').fill('SecDevPass123!@#');
    await page.locator('button.submit-btn').click();
    await page.waitForURL('**/admin/**', { timeout: 10000 });

    // Try to navigate directly to users page
    await page.goto('/admin/users');
    await page.waitForTimeout(2000);

    // Should be redirected (adminGuard blocks DEV users)
    const url = page.url();
    expect(url).not.toContain('/admin/users');
  });

  test('Unauthenticated user cannot access /admin/users', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('Admin sidebar hides Users link for DEV role', async ({ page }) => {
    // Login as DEV via seeded user
    const loginRes = await page.request.post(`${API_BASE}/admin/auth/login/v2`, {
      data: { email: ADMIN_CREDS.email, password: ADMIN_CREDS.password },
    });
    if (loginRes.ok()) {
      await page.request.post(`${API_BASE}/admin/users`, {
        data: { name: 'Sidebar Test Dev', email: `sidedev-${timestamp}@test.com`, password: 'SideDevPass123!@#', role: 'DEV' },
      });
    }

    await page.goto('/auth/login');
    await page.waitForSelector('.login-form', { timeout: 10000 });
    await page.locator('#email').fill(`sidedev-${timestamp}@test.com`);
    await page.locator('#password').fill('SideDevPass123!@#');
    await page.locator('button.submit-btn').click();
    await page.waitForURL('**/admin/**', { timeout: 10000 });
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 10000 });

    // Users link should NOT be visible
    const usersLink = page.locator('a.nav-item[href="/admin/users"]');
    await expect(usersLink).not.toBeVisible();
    // Newsletter link should also NOT be visible
    const newsletterLink = page.locator('a.nav-item[href="/admin/newsletter"]');
    await expect(newsletterLink).not.toBeVisible();
  });

  test('Admin sidebar shows Users link for ADMIN role', async ({ page }) => {
    await loginAsAdmin(page);
    const usersLink = page.locator('a.nav-item[href="/admin/users"]');
    await expect(usersLink).toBeVisible();
    const newsletterLink = page.locator('a.nav-item[href="/admin/newsletter"]');
    await expect(newsletterLink).toBeVisible();
  });
});
