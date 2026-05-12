import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  withComputed,
  patchState,
} from '@ngrx/signals';
import { switchMap, catchError, tap, of, map, firstValueFrom, throwError, take } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { UserResponse } from '../../models';
import { StorageService } from '../services/storage.service';
import { AuthService } from './auth.service';
import { I18nService } from '../services/i18n.service';

interface AuthState {
  user: UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  tokenExpiresAt: number | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  tokenExpiresAt: null,
};

const STORAGE_KEYS = {
  USER: 'user',
  IS_AUTHENTICATED: 'isAuthenticated',
  TOKEN_EXPIRES_AT: 'tokenExpiresAt',
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((state) => ({
    isAdmin: computed(() => state.user()?.role === 'ADMIN'),
    isDev: computed(() => {
      const role = state.user()?.role;
      return role === 'ADMIN' || role === 'DEV';
    }),
    userDisplayName: computed(
      () => state.user()?.name || state.user()?.username || 'User'
    ),
    userInitials: computed(() => {
      const name = state.user()?.name || state.user()?.username || '';
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }),
    userAvatarUrl: computed(() => state.user()?.avatarUrl || null),
    isTokenExpired: computed(() => {
      const expiresAt = state.tokenExpiresAt();
      if (!expiresAt) return true;
      return Date.now() >= expiresAt;
    }),
  })),
  withMethods((store) => {
    const storage = inject(StorageService);
    const authService = inject(AuthService);
    const i18n = inject(I18nService);
    const isBrowser = typeof window !== 'undefined';

    function roleToTier(role?: string): string {
      switch (role) {
        case 'ADMIN': return 'admin';
        case 'DEV': return 'dev';
        case 'VIEWER': return 'viewer';
        default: return 'public';
      }
    }

    return {
      login(user: UserResponse) {
        // Tokens are stored in HttpOnly cookies by the backend.
        // User info is kept in localStorage so the session survives across tabs.
        patchState(store, {
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        storage.set(STORAGE_KEYS.USER, user);
        storage.set(STORAGE_KEYS.IS_AUTHENTICATED, true);
        // Refresh i18n with role-appropriate translations
        i18n.setAuthTier(roleToTier(user.role));
      },

      logout() {
        // Clear local state immediately
        patchState(store, initialState);
        storage.remove(STORAGE_KEYS.USER);
        storage.remove(STORAGE_KEYS.IS_AUTHENTICATED);
        storage.remove(STORAGE_KEYS.TOKEN_EXPIRES_AT);
        // Clean up legacy sessionStorage keys (migration from session → local)
        storage.removeSession(STORAGE_KEYS.USER);
        storage.removeSession(STORAGE_KEYS.IS_AUTHENTICATED);
        storage.removeSession(STORAGE_KEYS.TOKEN_EXPIRES_AT);
        // Reset i18n to public tier
        i18n.setAuthTier('public');
        // Invalidate refresh token on backend (clears cookies server-side)
        authService.logout().pipe(take(1)).subscribe({
          error: () => { /* Logout API failure is non-critical — local state already cleared */ },
        });
      },

      setAuthenticated() {
        // Tokens are in HttpOnly cookies, nothing to store client-side
        patchState(store, { isAuthenticated: true });
        storage.set(STORAGE_KEYS.IS_AUTHENTICATED, true);
      },

      setTokenExpiry(expiresInSeconds: number) {
        const expiresAt = Date.now() + expiresInSeconds * 1000;
        patchState(store, { tokenExpiresAt: expiresAt });
        storage.set(STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt);
      },

      setLoading(isLoading: boolean) {
        patchState(store, { isLoading });
      },

      setError(error: string | null) {
        patchState(store, { error, isLoading: false });
      },

      updateUser(user: UserResponse) {
        patchState(store, { user });
        storage.set(STORAGE_KEYS.USER, user);
      },

      /**
       * Listen to localStorage 'storage' events so a logout in another tab
       * propagates immediately to this one. Without this, tab B keeps
       * showing the user as authenticated until the next 401 cycles through
       * the refresh interceptor — long enough to render admin chrome
       * briefly with a revoked cookie.
       *
       * 'storage' events only fire in OTHER tabs (not the one that wrote),
       * so this is safe to call alongside the regular login/logout flow.
       */
      subscribeToCrossTabAuthChanges(): void {
        if (!isBrowser) return;
        window.addEventListener('storage', (event: StorageEvent) => {
          if (event.key !== STORAGE_KEYS.IS_AUTHENTICATED) return;
          // Another tab removed the auth flag (logout) — mirror the local
          // state. We don't call authService.logout() because the originating
          // tab already revoked the cookie server-side.
          if (event.newValue == null && store.isAuthenticated()) {
            patchState(store, { ...initialState });
            storage.remove(STORAGE_KEYS.USER);
            storage.remove(STORAGE_KEYS.TOKEN_EXPIRES_AT);
            i18n.setAuthTier('public');
          }
        });
      },

      initFromStorage(): Promise<void> {
        // Try localStorage first, fall back to legacy sessionStorage
        const storedAuth =
          storage.get<boolean>(STORAGE_KEYS.IS_AUTHENTICATED) ??
          storage.getSession<boolean>(STORAGE_KEYS.IS_AUTHENTICATED);
        const user =
          storage.get<UserResponse>(STORAGE_KEYS.USER) ??
          storage.getSession<UserResponse>(STORAGE_KEYS.USER);
        const tokenExpiresAt =
          storage.get<number>(STORAGE_KEYS.TOKEN_EXPIRES_AT) ??
          storage.getSession<number>(STORAGE_KEYS.TOKEN_EXPIRES_AT);

        if (!storedAuth) {
          return Promise.resolve();
        }

        // If auth flag is set but no cached user data (e.g., OAuth callback stored
        // the flag but getCurrentUser() failed), try to recover from cookies.
        if (!user) {
          patchState(store, { isLoading: true });
          return firstValueFrom(
            authService.getCurrentUser().pipe(
              tap((freshUser) => {
                patchState(store, { user: freshUser, isAuthenticated: true, isLoading: false });
                storage.set(STORAGE_KEYS.USER, freshUser);
                storage.set(STORAGE_KEYS.IS_AUTHENTICATED, true);
              }),
              catchError(() => {
                patchState(store, { isLoading: false });
                storage.remove(STORAGE_KEYS.IS_AUTHENTICATED);
                storage.remove(STORAGE_KEYS.TOKEN_EXPIRES_AT);
                return of(null);
              }),
              map(() => void 0)
            )
          );
        }

        // SEC-F-03: Load cached user data optimistically for UI (name, role display),
        // but do NOT set isAuthenticated until the server validates the session.
        // This prevents a stale/stolen localStorage flag from granting access.
        patchState(store, { user, isAuthenticated: false, isLoading: true, tokenExpiresAt: tokenExpiresAt ?? null });

        // Migrate legacy sessionStorage to localStorage
        storage.set(STORAGE_KEYS.USER, user);
        if (tokenExpiresAt) storage.set(STORAGE_KEYS.TOKEN_EXPIRES_AT, tokenExpiresAt);

        // Build the refresh-then-validate observable
        const refreshAndValidate$ = authService.refreshToken({}).pipe(
          tap((response) => {
            if (response.expiresIn) {
              const newExpiry = Date.now() + response.expiresIn * 1000;
              patchState(store, { tokenExpiresAt: newExpiry });
              storage.set(STORAGE_KEYS.TOKEN_EXPIRES_AT, newExpiry);
            }
          }),
          switchMap(() => authService.getCurrentUser())
        );

        // If token is known-expired, skip the 401 round-trip and refresh directly.
        // Otherwise validate first — the interceptor handles 401→refresh transparently.
        const isExpired = tokenExpiresAt != null && Date.now() >= tokenExpiresAt;
        const auth$ = isExpired
          ? refreshAndValidate$
          : authService.getCurrentUser().pipe(
              catchError((err) => {
                // Only attempt refresh if the server explicitly rejected the token (401).
                // Network errors / 5xx mean the backend is down — no point trying refresh.
                if (err instanceof HttpErrorResponse && err.status === 401) {
                  return refreshAndValidate$;
                }
                return throwError(() => err);
              })
            );

        // Return a Promise so APP_INITIALIZER waits for auth to resolve
        // before the app bootstraps and route guards run.
        return firstValueFrom(
          auth$.pipe(
            tap((freshUser) => {
              patchState(store, { user: freshUser, isAuthenticated: true, isLoading: false });
              storage.set(STORAGE_KEYS.USER, freshUser);
              storage.set(STORAGE_KEYS.IS_AUTHENTICATED, true);
            }),
            catchError((err) => {
              if (err instanceof HttpErrorResponse && err.status === 401) {
                // Explicit auth rejection — clear session
                patchState(store, { user: null, isAuthenticated: false, isLoading: false });
                storage.remove(STORAGE_KEYS.USER);
                storage.remove(STORAGE_KEYS.IS_AUTHENTICATED);
                storage.remove(STORAGE_KEYS.TOKEN_EXPIRES_AT);
              } else {
                // Network error / 5xx — refuse to grant access we cannot verify with the
                // server. A previously cached `user` blob (especially with role=ADMIN) must
                // not be trusted while the backend is unreachable, since server-side
                // revocation cannot be observed during an outage. Force a re-login.
                patchState(store, { user: null, isAuthenticated: false, isLoading: false });
                // Mark token as expired so the next successful contact triggers a refresh.
                storage.set(STORAGE_KEYS.TOKEN_EXPIRES_AT, Date.now() - 1);
              }
              return of(null);
            }),
            map(() => void 0)
          )
        );
      },
    };
  })
);
