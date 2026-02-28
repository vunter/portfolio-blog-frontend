import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  withComputed,
  patchState,
} from '@ngrx/signals';
import { switchMap } from 'rxjs';
import { UserResponse } from '../../models';
import { StorageService } from '../services/storage.service';
import { AuthService } from './auth.service';

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
    isEditor: computed(() => {
      const role = state.user()?.role;
      return role === 'ADMIN' || role === 'DEV' || role === 'EDITOR';
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
    isTokenExpired: computed(() => {
      const expiresAt = state.tokenExpiresAt();
      if (!expiresAt) return true;
      return Date.now() >= expiresAt;
    }),
  })),
  withMethods((store) => {
    const storage = inject(StorageService);
    const authService = inject(AuthService);

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
        // Invalidate refresh token on backend (clears cookies server-side)
        authService.logout().subscribe({
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

      initFromStorage() {
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

        if (storedAuth && user) {
          // SEC-F-03: Load cached user data optimistically for UI (name, role display),
          // but do NOT set isAuthenticated until the server validates the session.
          // This prevents a stale/stolen localStorage flag from granting access.
          patchState(store, { user, isAuthenticated: false, isLoading: true, tokenExpiresAt: tokenExpiresAt ?? null });

          // Migrate legacy sessionStorage to localStorage
          storage.set(STORAGE_KEYS.USER, user);
          if (tokenExpiresAt) storage.set(STORAGE_KEYS.TOKEN_EXPIRES_AT, tokenExpiresAt);

          // Helper: attempt token refresh, then validate session
          const refreshAndValidate = () => {
            authService.refreshToken({}).pipe(
              switchMap((response) => {
                if (response.expiresIn) {
                  const newExpiry = Date.now() + response.expiresIn * 1000;
                  patchState(store, { tokenExpiresAt: newExpiry });
                  storage.set(STORAGE_KEYS.TOKEN_EXPIRES_AT, newExpiry);
                }
                return authService.getCurrentUser();
              })
            ).subscribe({
              next: (freshUser) => {
                patchState(store, { user: freshUser, isAuthenticated: true, isLoading: false });
                storage.set(STORAGE_KEYS.USER, freshUser);
                storage.set(STORAGE_KEYS.IS_AUTHENTICATED, true);
              },
              error: () => {
                patchState(store, { user: null, isAuthenticated: false, isLoading: false });
                storage.remove(STORAGE_KEYS.USER);
                storage.remove(STORAGE_KEYS.IS_AUTHENTICATED);
                storage.remove(STORAGE_KEYS.TOKEN_EXPIRES_AT);
              },
            });
          };

          // Validate session with the server via /admin/users/me before trusting the token.
          const isExpired = tokenExpiresAt != null && Date.now() >= tokenExpiresAt;
          if (!isExpired) {
            authService.getCurrentUser().subscribe({
              next: (freshUser) => {
                // Server confirmed the session — now mark as authenticated
                patchState(store, { user: freshUser, isAuthenticated: true, isLoading: false });
                storage.set(STORAGE_KEYS.USER, freshUser);
                storage.set(STORAGE_KEYS.IS_AUTHENTICATED, true);
              },
              error: () => {
                // Access token invalid — try refresh before giving up
                refreshAndValidate();
              },
            });
          } else {
            // Access token expired — try refresh token (valid up to 7 days with rememberMe)
            refreshAndValidate();
          }
        }
      },
    };
  })
);
