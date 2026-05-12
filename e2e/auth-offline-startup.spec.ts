import { test, expect } from '@playwright/test';
import { dismissCookieConsent, loginAsAdmin, ADMIN_CREDS } from './helpers';

/**
 * F2/F11: When the backend is unreachable during initFromStorage, the app must NOT
 * grant `isAuthenticated: true` from the cached user blob. A stale localStorage
 * 'user' record (especially with role=ADMIN) cannot bypass guards just because
 * the server is temporarily down.
 */
test.describe('Auth: offline startup behaviour (F2 + F11)', () => {

  test('non-401 backend error during init clears the session and forces re-login', async ({ page }) => {
    await dismissCookieConsent(page);

    // Step 1: log in normally so we have a real localStorage user + isAuthenticated=true
    await loginAsAdmin(page);
    await page.goto('/admin');
    await page.waitForURL('**/admin/**', { timeout: 30000 });

    // Sanity: localStorage now has user + isAuthenticated
    const before = await page.evaluate(() => ({
      user: localStorage.getItem('user'),
      isAuth: localStorage.getItem('isAuthenticated'),
    }));
    expect(before.isAuth).toBe('true');
    expect(before.user).toBeTruthy();

    // Step 2: simulate server-side 5xx for /admin/users/me and /admin/auth/refresh
    // — this is the exact path initFromStorage exercises.
    await page.route('**/api/v1/admin/users/me', route => route.fulfill({ status: 503, body: '' }));
    await page.route('**/api/v1/admin/auth/refresh', route => route.fulfill({ status: 503, body: '' }));

    // Step 3: full reload — this triggers initFromStorage with no live backend.
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');
    // Give APP_INITIALIZER time to settle.
    await page.waitForTimeout(3000);

    // Expectation: the app should NOT trust the cached user. Either the user is
    // bounced to /auth/login, or isAuthenticated is set to false in the store
    // (manifested by the state in localStorage being cleared / falsy).
    const after = await page.evaluate(() => ({
      isAuth: localStorage.getItem('isAuthenticated'),
      url: location.pathname,
    }));

    // F2 assertion: cached user must not have leaked admin access.
    // Either we got bounced to login OR isAuthenticated was flipped to false.
    const accessDenied = after.url.startsWith('/auth/login') || after.isAuth !== 'true';
    expect(accessDenied).toBe(true);
  });
});
