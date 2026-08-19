import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptors,
  HttpClient,
  HttpErrorResponse,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { refreshTokenInterceptor, RefreshTokenState } from './refresh-token.interceptor';
import { AuthStore } from '../auth/auth.store';
import { AuthService } from '../auth/auth.service';

describe('refreshTokenInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let mockAuthStore: { isAuthenticated: ReturnType<typeof signal<boolean>>; isLoading: ReturnType<typeof signal<boolean>>; logout: jasmine.Spy; setTokenExpiry: jasmine.Spy };
  let refreshState: RefreshTokenState;

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['refreshToken']);
    mockAuthStore = {
      isAuthenticated: signal(true),
      isLoading: signal(false),
      logout: jasmine.createSpy('logout'),
      setTokenExpiry: jasmine.createSpy('setTokenExpiry'),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([refreshTokenInterceptor])),
        provideHttpClientTesting(),
        RefreshTokenState,
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    refreshState = TestBed.inject(RefreshTokenState);
  });

  afterEach(() => {
    httpMock.verify();
    refreshState.reset();
  });

  it('should pass through successful requests without interference', () => {
    http.get('/api/v1/articles').subscribe((data) => {
      expect(data).toEqual({ content: [] });
    });

    const req = httpMock.expectOne('/api/v1/articles');
    req.flush({ content: [] });
  });

  it('should pass through non-401 errors without triggering refresh', () => {
    http.get('/api/v1/articles').subscribe({
      error: (err: HttpErrorResponse) => {
        expect(err.status).toBe(500);
      },
    });

    const req = httpMock.expectOne('/api/v1/articles');
    req.flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });

    expect(authServiceSpy.refreshToken).not.toHaveBeenCalled();
  });

  it('should pass through 403 errors without triggering refresh', () => {
    http.get('/api/v1/admin/users').subscribe({
      error: (err: HttpErrorResponse) => {
        expect(err.status).toBe(403);
      },
    });

    const req = httpMock.expectOne('/api/v1/admin/users');
    req.flush(null, { status: 403, statusText: 'Forbidden' });

    expect(authServiceSpy.refreshToken).not.toHaveBeenCalled();
  });

  it('should NOT trigger refresh for 401 on /auth/ endpoints', () => {
    http.post('/api/v1/admin/auth/login', {}).subscribe({
      error: (err: HttpErrorResponse) => {
        expect(err.status).toBe(401);
      },
    });

    const req = httpMock.expectOne('/api/v1/admin/auth/login');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.refreshToken).not.toHaveBeenCalled();
  });

  it('should NOT trigger refresh for 401 on /auth/refresh endpoint', () => {
    http.post('/api/v1/admin/auth/refresh', {}).subscribe({
      error: (err: HttpErrorResponse) => {
        expect(err.status).toBe(401);
      },
    });

    const req = httpMock.expectOne('/api/v1/admin/auth/refresh');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.refreshToken).not.toHaveBeenCalled();
  });

  it('should trigger refresh on 401 for authenticated user and retry the original request', () => {
    authServiceSpy.refreshToken.and.returnValue(of({ token: 'new-token' } as any));

    http.get('/api/v1/admin/dashboard').subscribe((data) => {
      expect(data).toEqual({ stats: {} });
    });

    // First request returns 401
    const req = httpMock.expectOne('/api/v1/admin/dashboard');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.refreshToken).toHaveBeenCalledWith({});

    // Retried request after successful refresh
    const retryReq = httpMock.expectOne('/api/v1/admin/dashboard');
    expect(retryReq.request.withCredentials).toBeTrue();
    retryReq.flush({ stats: {} });
  });

  it('should logout and navigate to login when refresh fails', () => {
    authServiceSpy.refreshToken.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 401 }))
    );

    http.get('/api/v1/admin/dashboard').subscribe({
      error: () => {},
    });

    const req = httpMock.expectOne('/api/v1/admin/dashboard');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.refreshToken).toHaveBeenCalled();
    expect(mockAuthStore.logout).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  // AUD19C-A5FE: an unauthenticated 401 (e.g. wrong MFA code mid-login) has no session
  // to clear — the error must reach the subscriber without any logout/redirect.
  it('should NOT logout on 401 when user is not authenticated — error reaches subscriber', () => {
    mockAuthStore.isAuthenticated.set(false);
    mockAuthStore.isLoading.set(false);

    let received: HttpErrorResponse | null = null;
    http.get('/api/v1/admin/dashboard').subscribe({
      error: (err: HttpErrorResponse) => (received = err),
    });

    const req = httpMock.expectOne('/api/v1/admin/dashboard');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.refreshToken).not.toHaveBeenCalled();
    expect(mockAuthStore.logout).not.toHaveBeenCalled();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
    expect(received!.status).toBe(401);
  });

  // AUD19C-A5FE: a business-level 401 AFTER a successful refresh (e.g. re-auth password
  // check rejected) must propagate to the caller without forcing a logout.
  it('should propagate a 401 from the retried request after successful refresh without logout', () => {
    authServiceSpy.refreshToken.and.returnValue(of({ expiresIn: 900 } as any));

    let received: HttpErrorResponse | null = null;
    http.get('/api/v1/admin/dashboard').subscribe({
      error: (err: HttpErrorResponse) => (received = err),
    });

    const req = httpMock.expectOne('/api/v1/admin/dashboard');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.refreshToken).toHaveBeenCalled();

    // Retried request also 401s — business rejection, not a session failure
    const retryReq = httpMock.expectOne('/api/v1/admin/dashboard');
    retryReq.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(received!.status).toBe(401);
    expect(mockAuthStore.logout).not.toHaveBeenCalled();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('should NOT logout during session restoration (isLoading=true, isAuthenticated=false)', () => {
    mockAuthStore.isAuthenticated.set(false);
    mockAuthStore.isLoading.set(true);

    http.get('/api/v1/admin/users/me').subscribe({
      error: (err: HttpErrorResponse) => {
        expect(err.status).toBe(401);
      },
    });

    const req = httpMock.expectOne('/api/v1/admin/users/me');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.refreshToken).not.toHaveBeenCalled();
    expect(mockAuthStore.logout).not.toHaveBeenCalled();
    expect(routerSpy.navigate).not.toHaveBeenCalledWith(['/auth/login']);
  });

  it('should set isRefreshing back to false after successful refresh', () => {
    authServiceSpy.refreshToken.and.returnValue(of({ token: 'new-token' } as any));

    http.get('/api/v1/admin/dashboard').subscribe();

    const req = httpMock.expectOne('/api/v1/admin/dashboard');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    // After refresh completes, isRefreshing should be false
    expect(refreshState.isRefreshing).toBeFalse();

    const retryReq = httpMock.expectOne('/api/v1/admin/dashboard');
    retryReq.flush({});
  });

  it('should set isRefreshing back to false after failed refresh', () => {
    authServiceSpy.refreshToken.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 401 }))
    );

    http.get('/api/v1/admin/dashboard').subscribe({
      error: () => {},
    });

    const req = httpMock.expectOne('/api/v1/admin/dashboard');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(refreshState.isRefreshing).toBeFalse();
  });

  describe('RefreshTokenState', () => {
    it('should be created with default values', () => {
      expect(refreshState.isRefreshing).toBeFalse();
    });

    it('should reset state correctly', () => {
      refreshState.isRefreshing = true;
      refreshState.refreshSubject$.next(true);

      refreshState.reset();

      expect(refreshState.isRefreshing).toBeFalse();
      // New BehaviorSubject should have null as initial value
      let value: boolean | null = undefined as any;
      refreshState.refreshSubject$.subscribe((v) => (value = v));
      expect(value).toBeNull();
    });
  });
});
