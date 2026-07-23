import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, filter, map, switchMap, take, throwError } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { AuthService } from '../auth/auth.service';

/**
 * BUG-03 FIX: Moved refresh state into an injectable service so that each SSR
 * request gets its own injector-scoped instance — preventing cross-request
 * race conditions in Node.js SSR.
 *
 * Previously `isRefreshing` and `refreshSubject$` were closure-scoped module
 * variables shared across all SSR requests in the same Node process.
 *
 * SEC-F-08: Shared state risk is mitigated because this interceptor only runs
 * in the browser (RenderMode.Client). No request state is shared across SSR requests.
 * The RefreshTokenState service is scoped per-injector, so even if SSR processes
 * multiple requests concurrently, each gets its own isolated state instance.
 */
@Injectable({ providedIn: 'root' })
export class RefreshTokenState {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);

  isRefreshing = false;
  refreshSubject$ = new BehaviorSubject<boolean | null>(null);

  /**
   * Single-flight token refresh shared by BOTH the 401 interceptor and the auth
   * route guard. If a refresh is already in progress (started by either path), the
   * caller waits for its result instead of issuing a second `POST /auth/refresh`
   * with the same rotating cookie — which would make one of them lose the race and
   * spuriously log the user out. Emits `true` on success, `false` if the shared
   * refresh failed; errors only for the initiator (so it can decide to log out).
   */
  refreshOnce(): Observable<boolean> {
    if (this.isRefreshing) {
      return this.refreshSubject$.pipe(
        filter((result) => result !== null),
        take(1),
        map((result) => !!result),
      );
    }

    this.isRefreshing = true;
    this.refreshSubject$.next(null);

    return this.authService.refreshToken({}).pipe(
      map((response) => {
        if (response.expiresIn) {
          this.authStore.setTokenExpiry(response.expiresIn);
        }
        this.isRefreshing = false;
        this.refreshSubject$.next(true);
        return true;
      }),
      catchError((err) => {
        this.isRefreshing = false;
        this.refreshSubject$.next(false);
        return throwError(() => err);
      }),
    );
  }

  reset(): void {
    this.isRefreshing = false;
    this.refreshSubject$ = new BehaviorSubject<boolean | null>(null);
  }
}

export const refreshTokenInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const state = inject(RefreshTokenState);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/')) {
        if (authStore.isAuthenticated()) {
          // Was a refresh already in flight? Only the initiator observes the refresh
          // error and decides whether to log out; waiters just replay/fail the request.
          const isInitiator = !state.isRefreshing;
          return state.refreshOnce().pipe(
            switchMap((success) => {
              if (success) {
                return next(req.clone({ withCredentials: true }));
              }
              return throwError(() => error);
            }),
            catchError((refreshError) => {
              // Only log out if the refresh was explicitly rejected (401/403) and this
              // call initiated it. Network errors mean backend is down — preserve session.
              if (isInitiator && refreshError instanceof HttpErrorResponse &&
                  (refreshError.status === 401 || refreshError.status === 403)) {
                authStore.logout();
                router.navigate(['/auth/login']);
              }
              return throwError(() => refreshError);
            })
          );
        } else if (!authStore.isLoading()) {
          // Only force logout when not in the middle of session restoration.
          // During initFromStorage(), isLoading is true and isAuthenticated is false
          // while the store validates the session — let initFromStorage handle errors.
          authStore.logout();
          router.navigate(['/auth/login']);
        }
      }

      return throwError(() => error);
    })
  );
};
