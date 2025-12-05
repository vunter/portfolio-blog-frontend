import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  withComputed,
  patchState,
} from '@ngrx/signals';
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
        const isAuthenticated =
          storage.get<boolean>(STORAGE_KEYS.IS_AUTHENTICATED) ??
          storage.getSession<boolean>(STORAGE_KEYS.IS_AUTHENTICATED);
        const user =
          storage.get<UserResponse>(STORAGE_KEYS.USER) ??
          storage.getSession<UserResponse>(STORAGE_KEYS.USER);
        const tokenExpiresAt =
          storage.get<number>(STORAGE_KEYS.TOKEN_EXPIRES_AT) ??
          storage.getSession<number>(STORAGE_KEYS.TOKEN_EXPIRES_AT);

        if (isAuthenticated && user) {
          patchState(store, { user, isAuthenticated: true, tokenExpiresAt: tokenExpiresAt ?? null });
          // Migrate legacy sessionStorage to localStorage
          storage.set(STORAGE_KEYS.USER, user);
          storage.set(STORAGE_KEYS.IS_AUTHENTICATED, true);
          if (tokenExpiresAt) storage.set(STORAGE_KEYS.TOKEN_EXPIRES_AT, tokenExpiresAt);
          // Background refresh: pick up role changes without requiring re-login.
          // Skip if the access token is already expired to avoid a 401 console error.
          const isExpired = tokenExpiresAt != null && Date.now() >= tokenExpiresAt;
          if (!isExpired) {
            authService.getCurrentUser().subscribe({
              next: (freshUser) => {
                patchState(store, { user: freshUser });
                storage.set(STORAGE_KEYS.USER, freshUser);
              },
              error: () => { /* Non-critical — keep cached user data */ },
            });
          }
        }
      },
    };
  })
);
