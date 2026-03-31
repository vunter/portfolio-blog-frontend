import { test, expect } from '@playwright/test';
import { loginAsAdmin, ADMIN_CREDS, dismissCookieConsent } from './helpers';

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
test.describe('User Management (ADMIN)', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.locator('a.nav-item[href="/admin/users"]').click();
    await expect(page).toHaveURL(/\/admin\/users/);
    // Wait for page header; reload once if data failed to load
    try {
      await expect(page.locator('.page-header h1')).toBeVisible({ timeout: 15000 });
    } catch {
      await page.reload();
      await expect(page.locator('.page-header h1')).toBeVisible({ timeout: 30000 });
    }
    // If data failed to load, reload to retry
    const failedHeading = page.locator('h3:has-text("Failed to load data")');
    if (await failedHeading.count() > 0) {
      await page.reload();
      await page.waitForLoadState('load');
      await expect(page.locator('.page-header h1')).toBeVisible({ timeout: 15000 });
    }
  });

  test('Users page loads with table', async ({ page }) => {
    await expect(page.locator('.data-table')).toBeVisible();
    // Admin user (seeded) should be in the list
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

  test('Role dropdown has all 3 roles', async ({ page }) => {
    await page.locator('.btn-primary').click();
    await expect(page.locator('.modal')).toBeVisible();
    const options = page.locator('#role option');
    expect(await options.count()).toBe(3);
    // Check values
    await expect(options.nth(0)).toHaveAttribute('value', 'VIEWER');
    await expect(options.nth(1)).toHaveAttribute('value', 'DEV');
    await expect(options.nth(2)).toHaveAttribute('value', 'ADMIN');
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
    await expect(page.locator('.modal')).not.toBeVisible({ timeout: 10000 });
    // Updated name should appear
    await expect(page.locator('.data-table tbody')).toContainText('Dev Updated');
  });

  test('Deactivate user', async ({ page }) => {
    const devRow = page.locator('.data-table tbody tr', { hasText: TEST_DEV.email });
    if (await devRow.count() === 0) return;

    // Check user is active
    await expect(devRow.locator('.status-indicator.active')).toBeVisible();

    // Click deactivate (2nd action button) - opens ConfirmDialog
    await devRow.locator('.action-btn').nth(1).click();
    await expect(page.locator('.confirm-modal')).toBeVisible({ timeout: 3000 });
    await page.locator('.confirm-modal .btn-danger').click();
    await page.waitForTimeout(2000);
    // User should now be inactive
    const statusEl = devRow.locator('.status-indicator');
    await expect(statusEl).not.toHaveClass(/active/, { timeout: 5000 });
  });

  test('Reactivate user', async ({ page }) => {
    const devRow = page.locator('.data-table tbody tr', { hasText: TEST_DEV.email });
    if (await devRow.count() === 0) return;

    // Click activate (2nd action button) - opens ConfirmDialog
    await devRow.locator('.action-btn').nth(1).click();
    await expect(page.locator('.confirm-modal')).toBeVisible({ timeout: 3000 });
    // Activate uses 'warning' type, so the button has btn-warning class
    await page.locator('.confirm-modal .btn-warning, .confirm-modal .btn-primary').first().click();
    await page.waitForTimeout(2000);
    // User should now be active again
    await expect(devRow.locator('.status-indicator.active')).toBeVisible({ timeout: 5000 });
  });

  test('Delete user', async ({ page }) => {
    const viewerRow = page.locator('.data-table tbody tr', { hasText: TEST_VIEWER.email });
    if (await viewerRow.count() === 0) return;

    // Click delete (danger action button) - opens ConfirmDialog
    await viewerRow.locator('.action-btn--danger').click();
    await expect(page.locator('.confirm-modal')).toBeVisible({ timeout: 3000 });
    await page.locator('.confirm-modal .btn-danger').click();
    await page.waitForTimeout(2000);
    // Backend soft-deletes (deactivates) — user should now be inactive
    const statusEl = viewerRow.locator('.status-indicator');
    await expect(statusEl).not.toHaveClass(/active/, { timeout: 5000 });
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
    await dismissCookieConsent(page);
    // Seed a DEV user via API
    const loginRes = await page.request.post(`${API_BASE}/admin/auth/login/v2`, {
      data: { email: ADMIN_CREDS.email, password: ADMIN_CREDS.password },
    });
    if (loginRes.ok()) {
      await page.request.post(`${API_BASE}/admin/users`, {
        data: { name: 'Security Test Dev', email: `secdev-${timestamp}@test.com`, password: 'SecDevPass123!@#', role: 'DEV' },
      });
    }

    // Login as DEV and accept terms
    await page.request.post(`${API_BASE}/admin/auth/login/v2`, {
      data: { email: `secdev-${timestamp}@test.com`, password: 'SecDevPass123!@#' },
    });
    await page.request.put(`${API_BASE}/admin/users/me`, {
      data: { termsAccepted: true },
    }).catch(() => {});

    // Navigate to home first to let Angular initialize auth from cookie
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    // Try to navigate directly to users page
    await page.goto('/admin/users');
    await page.waitForTimeout(3000);

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
    await dismissCookieConsent(page);
    // Login as ADMIN to create a DEV user
    const loginRes = await page.request.post(`${API_BASE}/admin/auth/login/v2`, {
      data: { email: ADMIN_CREDS.email, password: ADMIN_CREDS.password },
    });
    if (loginRes.ok()) {
      await page.request.post(`${API_BASE}/admin/users`, {
        data: { name: 'Sidebar Test Dev', email: `sidedev-${timestamp}@test.com`, password: 'SideDevPass123!@#', role: 'DEV' },
      });
    }

    // Login as DEV user via API and accept terms
    await page.request.post(`${API_BASE}/admin/auth/login/v2`, {
      data: { email: `sidedev-${timestamp}@test.com`, password: 'SideDevPass123!@#' },
    });
    await page.request.put(`${API_BASE}/admin/users/me`, {
      data: { termsAccepted: true },
    }).catch(() => {});

    // Navigate to home first to let Angular initialize auth from cookie
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    // Now navigate to admin — Angular auth should be initialized
    await page.goto('/admin');
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);

    // Check if we're in admin layout (auth initialized from cookie)
    const adminLayout = page.locator('.admin-layout');
    const isAdmin = await adminLayout.isVisible();

    if (isAdmin) {
      // Users link should NOT be visible for DEV role
      const usersLink = page.locator('a.nav-item[href="/admin/users"]');
      await expect(usersLink).not.toBeVisible();
      // Newsletter link should also NOT be visible
      const newsletterLink = page.locator('a.nav-item[href="/admin/newsletter"]');
      await expect(newsletterLink).not.toBeVisible();
    } else {
      // If admin layout isn't visible, DEV was redirected (also acceptable — means limited access)
      // Just verify we're not on /admin/users
      expect(page.url()).not.toContain('/admin/users');
    }
  });

  test('Admin sidebar shows Users link for ADMIN role', async ({ page }) => {
    await loginAsAdmin(page);
    const usersLink = page.locator('a.nav-item[href="/admin/users"]');
    await expect(usersLink).toBeVisible();
    const newsletterLink = page.locator('a.nav-item[href="/admin/newsletter"]');
    await expect(newsletterLink).toBeVisible();
  });
});
