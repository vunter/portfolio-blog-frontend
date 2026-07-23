import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { AuthStore } from './auth.store';
import { AuthService } from './auth.service';
import { RefreshTokenState } from '../interceptors/refresh-token.interceptor';

/**
 * Verifies authentication and attempts token refresh if expired.
 * After refresh, also re-fetches user info so role changes are picked up
 * without requiring a full re-login.
 */
function verifyAuth(state: { url: string }) {
  const authStore = inject(AuthStore);
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authStore.isAuthenticated()) {
    router.navigate(['/auth/login'], {
      queryParams: { returnUrl: state.url },
    });
    return false;
  }

  if (authStore.isTokenExpired()) {
    // Route the refresh through the shared single-flight so a guard-triggered refresh
    // and an interceptor-triggered 401 refresh cannot race and issue two rotating-cookie
    // refreshes (which would log the user out). refreshOnce() updates token expiry itself.
    const refreshState = inject(RefreshTokenState);
    return refreshState.refreshOnce().pipe(
      switchMap((success) => {
        if (!success) {
          authStore.logout();
          router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
          return of(false);
        }
        // Re-fetch user info to pick up role changes (VIEWER → DEV, etc.)
        return authService.getCurrentUser().pipe(
          map((user) => {
            authStore.updateUser(user);
            return true as boolean;
          }),
          catchError(() => of(true)), // user-info refresh failure is non-critical
        );
      }),
      catchError(() => {
        authStore.logout();
        router.navigate(['/auth/login'], {
          queryParams: { returnUrl: state.url },
        });
        return of(false);
      }),
    );
  }

  return true;
}

/**
 * Auth Guard - Protects routes that require authentication
 */
export const authGuard: CanActivateFn = (_route, state) => {
  return verifyAuth(state);
};

/**
 * Guest Guard - Protects routes accessible only to unauthenticated users
 */
export const guestGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (!authStore.isAuthenticated()) {
    return true;
  }

  router.navigate(['/']);
  return false;
};

/**
 * Setup Guard - Redirects users to complete-profile when:
 * - No password set (OAuth users who haven't completed setup)
 * Terms acceptance is handled by the global TermsAcceptanceModalComponent.
 */
export const setupGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  const user = authStore.user();
  if (user && user.hasPassword === false) {
    router.navigateByUrl('/auth/complete-profile');
    return false;
  }
  return true;
};

/**
 * LOW-06: Generic role guard factory — eliminates duplication between
 * adminGuard and devGuard.
 */
function roleGuard(checkFn: (store: InstanceType<typeof AuthStore>) => boolean): CanActivateFn {
  return (_route, state) => {
    const authStore = inject(AuthStore);
    const router = inject(Router);
    const result = verifyAuth(state);

    if (result === false) return false;
    if (result === true) {
      if (checkFn(authStore)) return true;
      router.navigate(['/']);
      return false;
    }

    return result.pipe(
      map((authenticated) => {
        if (!authenticated) return false;
        if (checkFn(authStore)) return true;
        router.navigate(['/']);
        return false;
      }),
    );
  };
}

/**
 * Admin Guard - Requer role ADMIN
 */
export const adminGuard: CanActivateFn = roleGuard((store) => store.isAdmin());

/**
 * Dev Guard - Requer role ADMIN ou DEV
 */
export const devGuard: CanActivateFn = roleGuard((store) => store.isDev());
