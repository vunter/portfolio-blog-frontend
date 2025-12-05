import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { AuthService } from '../auth/auth.service';

/**
 * BUG-03 FIX: Moved refresh state into an injectable service so that each SSR
 * request gets its own injector-scoped instance — preventing cross-request
 * race conditions in Node.js SSR.
 *
 * Previously `isRefreshing` and `refreshSubject$` were closure-scoped module
 * variables shared across all SSR requests in the same Node process.
 */
@Injectable({ providedIn: 'root' })
export class RefreshTokenState {
  isRefreshing = false;
  refreshSubject$ = new BehaviorSubject<boolean | null>(null);

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
  const authService = inject(AuthService);
  const router = inject(Router);
  const state = inject(RefreshTokenState);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/')) {
        if (authStore.isAuthenticated()) {
          if (!state.isRefreshing) {
            // First 401 — trigger the refresh
            state.isRefreshing = true;
            state.refreshSubject$.next(null);

            return authService.refreshToken({}).pipe(
              switchMap(() => {
                state.isRefreshing = false;
                state.refreshSubject$.next(true);
                return next(req.clone({ withCredentials: true }));
              }),
              catchError((refreshError) => {
                state.isRefreshing = false;
                state.refreshSubject$.next(false);
                authStore.logout();
                router.navigate(['/auth/login']);
                return throwError(() => refreshError);
              })
            );
          } else {
            // Another request hit 401 while refresh is in progress — wait for it
            return state.refreshSubject$.pipe(
              filter((result) => result !== null),
              take(1),
              switchMap((success) => {
                if (success) {
                  return next(req.clone({ withCredentials: true }));
                }
                return throwError(() => error);
              })
            );
          }
        } else {
          authStore.logout();
          router.navigate(['/auth/login']);
        }
      }

      return throwError(() => error);
    })
  );
};
