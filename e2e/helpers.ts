import { Page, expect } from '@playwright/test';

const API_BASE = 'http://localhost:4200/api/v1';

export const ADMIN_CREDS = { email: 'admin@catananti.dev', password: 'Admin123456789!' };
export const DEV_CREDS = { email: 'dev@test.com', password: 'DevPass123!@#' };
export const VIEWER_CREDS = { email: 'viewer@test.com', password: 'ViewerPass123!@#' };

/**
 * Headers for a mutating API call made through `page.request`.
 *
 * The app is protected by cookie-based CSRF: the server issues an XSRF-TOKEN
 * cookie and requires it echoed back in X-XSRF-TOKEN on every state-changing
 * request. Angular's HttpClient does that automatically, but Playwright's
 * APIRequestContext does not — so a raw page.request.post lands on a 403 and
 * the test reads as a broken feature when the feature is in fact protected.
 *
 * Call this on every post/put/patch/delete issued through page.request, after
 * logging in (the cookie is set by the login response).
 */
export async function csrfHeaders(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  const token = cookies.find((c) => c.name === 'XSRF-TOKEN')?.value;
  return token ? { 'X-XSRF-TOKEN': token } : {};
}

/**
 * Login via the UI form — simulates a real user typing credentials.
 */
export async function loginViaUI(page: Page, email: string, password: string, options?: { waitForNavigation?: boolean }) {
  await dismissCookieConsent(page);
  await page.goto('/auth/login');
  await page.waitForSelector('.auth-form', { timeout: 10000 });

  const emailInput = page.locator('#email');
  const passwordInput = page.locator('#password');
  const submitBtn = page.locator('button.submit-btn');

  // Simulate human-like typing
  await emailInput.click();
  await emailInput.fill('');
  await emailInput.pressSequentially(email, { delay: 30 });

  await passwordInput.click();
  await passwordInput.fill('');
  await passwordInput.pressSequentially(password, { delay: 30 });

  await submitBtn.click();
  if (options?.waitForNavigation !== false) {
    // Wait for login POST to complete and page to navigate away from /auth/login
    await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'), { timeout: 30000 });
    await page.waitForLoadState('load');
  }
  await propagateCsrfToken(page);
}

/**
 * Make the session's CSRF token travel with `page.request` calls.
 *
 * Specs drive the API directly through page.request, which shares the browser's
 * cookies but — unlike Angular's HttpClient — does not echo the XSRF-TOKEN
 * cookie back in the X-XSRF-TOKEN header. Every mutating call then lands on a
 * 403 and the spec reads as a broken feature when CSRF is simply doing its job.
 *
 * Setting it once as an extra context header covers all of them, instead of
 * threading a header argument through ~66 call sites.
 */
export async function propagateCsrfToken(page: Page) {
  const token = (await page.context().cookies()).find((c) => c.name === 'XSRF-TOKEN')?.value;
  if (token) {
    await page.context().setExtraHTTPHeaders({ 'X-XSRF-TOKEN': token });
  }
}

/**
 * Accept Terms & Privacy modal if it appears after login.
 * Waits briefly for the modal to potentially appear, then handles it.
 */
export async function acceptTermsIfVisible(page: Page) {
  // Wait a moment for post-login state to settle
  const modal = page.locator('.terms-overlay');
  try {
    await modal.waitFor({ state: 'visible', timeout: 3000 });
    // Check the agreement checkbox (try multiple selectors for resilience)
    const checkbox = page.locator('.terms-overlay input[type="checkbox"]').first();
    await checkbox.check({ timeout: 3000 });
    // Click the primary accept button
    const acceptBtn = page.locator('.terms-overlay button.btn-primary, .terms-overlay button:has-text("Accept")').first();
    await acceptBtn.click({ timeout: 3000 });
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  } catch {
    // Modal didn't appear or couldn't be dismissed — try API fallback
    await page.request.put(`${API_BASE}/admin/users/me`, {
      data: { termsAccepted: true },
    }).catch(() => {});
    // Reload to clear the modal if it's still visible
    if (await modal.isVisible().catch(() => false)) {
      await page.reload();
      await page.waitForLoadState('load');
    }
  }
}

/**
 * Accept terms for a user via API. Call after API login to ensure
 * the Terms & Privacy modal doesn't block UI tests.
 */
export async function acceptTermsViaAPI(page: Page) {
  await page.request.put(`${API_BASE}/admin/users/me`, {
    data: { termsAccepted: true },
  }).catch(() => {});
}

/**
 * Login and wait for redirect to admin dashboard.
 */
export async function loginAsAdmin(page: Page) {
  await loginViaUI(page, ADMIN_CREDS.email, ADMIN_CREDS.password);
  // Accept terms via API first (ensures the modal won't appear)
  await acceptTermsViaAPI(page);
  await acceptTermsIfVisible(page);
  // Login redirects to home (/), not /admin — navigate explicitly
  await page.goto('/admin');
  await page.waitForURL('**/admin/**', { timeout: 30000 });
  await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 30000 });
}

/**
 * Login with any credentials and wait for admin layout.
 */
export async function loginAs(page: Page, creds: { email: string; password: string }) {
  await loginViaUI(page, creds.email, creds.password);
  await acceptTermsViaAPI(page);
  await acceptTermsIfVisible(page);
  // Login redirects to home (/), not /admin — navigate explicitly
  await page.goto('/admin');
  await page.waitForURL('**/admin/**', { timeout: 30000 });
  await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 30000 });
}

/**
 * Logout from admin layout.
 */
export async function logoutFromAdmin(page: Page) {
  await page.locator('button.logout-link').click();
  // Logout redirects to home page, then user may go to login
  await page.waitForURL('**/', { timeout: 10000 });
}

/**
 * Logout from public layout via user menu.
 */
export async function logoutFromPublic(page: Page) {
  await page.locator('button.user-menu__trigger').click();
  await page.locator('button.user-menu__item--danger').click();
  await page.waitForURL('**/auth/login**', { timeout: 10000 });
}

/**
 * Seed test users via the API using admin credentials.
 * Uses backend API directly to avoid UI overhead.
 * Handles the case where users were previously soft-deleted by reactivating them.
 */
export async function seedTestUsers(page: Page) {
  // Login as admin via API to get cookie
  const loginRes = await page.request.post(`${API_BASE}/admin/auth/login`, {
    data: { email: ADMIN_CREDS.email, password: ADMIN_CREDS.password },
  });

  if (!loginRes.ok()) {
    console.log('Admin login failed during seeding:', loginRes.status());
    return;
  }
  await propagateCsrfToken(page);

  // Accept terms for admin user so the modal doesn't block UI tests
  await page.request.put(`${API_BASE}/admin/users/me`, {
    data: { termsAccepted: true },
  }).catch(() => {});

  const users = [
    { name: 'Dev User', email: DEV_CREDS.email, password: DEV_CREDS.password, role: 'DEV' },
    { name: 'Viewer User', email: VIEWER_CREDS.email, password: VIEWER_CREDS.password, role: 'VIEWER' },
  ];

  // Get existing users list to check for soft-deleted accounts
  const listRes = await page.request.get(`${API_BASE}/admin/users?size=200`);
  const existingUsers = listRes.ok() ? ((await listRes.json()).content || await listRes.json()) : [];

  for (const user of users) {
    const createRes = await page.request.post(`${API_BASE}/admin/users`, { data: user });

    if (!createRes.ok()) {
      // The account already exists. Re-activate it unconditionally rather than
      // trusting the listing we fetched a moment ago: these two accounts are
      // shared fixtures, and specs that run earlier (user management, the
      // comprehensive suite) deactivate them without restoring. Leaving that
      // to chance makes every later role test fail at login for a reason that
      // has nothing to do with roles.
      const existing = existingUsers.find((u: any) => u.email === user.email);
      if (existing) {
        await page.request.put(`${API_BASE}/admin/users/${existing.id}/activate`).catch(() => {});
      }
    }
  }
}

/**
 * Wait for Angular app to be ready.
 */
export async function waitForApp(page: Page) {
  await page.waitForLoadState('load');
}

/**
 * Seed a minimal resume profile so the public home page renders properly.
 * Creates a resume template with alias 'leonardo-catananti' and a basic profile.
 * Safe to call multiple times (ignores errors if already exists).
 */
export async function seedProfile(page: Page) {
  const loginRes = await page.request.post(`${API_BASE}/admin/auth/login`, {
    data: { email: ADMIN_CREDS.email, password: ADMIN_CREDS.password },
  });
  if (!loginRes.ok()) return;

  // Accept terms for admin user so the modal doesn't block UI tests
  await page.request.put(`${API_BASE}/admin/users/me`, {
    data: { termsAccepted: true },
  }).catch(() => {});

  // Create a resume template with the expected alias
  await page.request.post(`${API_BASE}/resume/templates`, {
    data: {
      name: 'Default Resume',
      htmlContent: '<html><body><h1>Resume</h1></body></html>',
      cssContent: 'body { font-family: sans-serif; }',
    },
  }).catch(() => {});

  // Find the template and set alias + status to ACTIVE
  const templatesRes = await page.request.get(`${API_BASE}/resume/templates`);
  if (templatesRes.ok()) {
    const data = await templatesRes.json();
    const templates = data.content || data || [];
    const template = templates[0];
    if (template) {
      await page.request.put(`${API_BASE}/resume/templates/${template.id}`, {
        data: {
          ...template,
          alias: 'leonardo-catananti',
          status: 'ACTIVE',
        },
      }).catch(() => {});
    }
  }

  // Create resume profile
  await page.request.put(`${API_BASE}/resume/profile?locale=en`, {
    data: {
      fullName: 'Leonardo Catananti',
      title: 'Senior Software Engineer',
      email: 'admin@catananti.dev',
      location: 'São Paulo, Brazil',
      professionalSummary: 'Full-stack developer with expertise in Java, Spring Boot, and Angular.',
    },
  }).catch(() => {});
}

/**
 * Dismiss the cookie consent dialog by pre-setting localStorage.
 * Call this BEFORE navigating to any page.
 */
export async function dismissCookieConsent(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({
      necessary: true,
      functional: true,
      analytics: true,
      timestamp: Date.now(),
    }));
  });
}
