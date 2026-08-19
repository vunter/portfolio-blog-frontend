import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MfaVerifyComponent } from './mfa-verify.component';
import { MfaService } from '../../../../core/services/mfa.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { LoginResponse, UserResponse } from '../../../../models';

const MFA_STORAGE_KEY = 'mfa_challenge';

describe('MfaVerifyComponent', () => {
  let fixture: ComponentFixture<MfaVerifyComponent>;
  let component: MfaVerifyComponent;
  let mfaService: jasmine.SpyObj<MfaService>;
  let authService: jasmine.SpyObj<AuthService>;
  let mockAuthStore: { setAuthenticated: jasmine.Spy; setTokenExpiry: jasmine.Spy; login: jasmine.Spy };
  let notification: jasmine.SpyObj<NotificationService>;
  let router: Router;

  function setHistoryState(state: Record<string, unknown> | null): void {
    window.history.replaceState(state, '');
  }

  beforeEach(async () => {
    sessionStorage.clear();
    mfaService = jasmine.createSpyObj('MfaService', ['verifyLogin', 'sendEmailOtp']);
    authService = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    mockAuthStore = {
      setAuthenticated: jasmine.createSpy('setAuthenticated'),
      setTokenExpiry: jasmine.createSpy('setTokenExpiry'),
      login: jasmine.createSpy('login'),
    };
    notification = jasmine.createSpyObj('NotificationService', ['success', 'error', 'warning', 'info']);

    await TestBed.configureTestingModule({
      imports: [MfaVerifyComponent],
      providers: [
        provideRouter([]),
        { provide: MfaService, useValue: mfaService },
        { provide: AuthService, useValue: authService },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: NotificationService, useValue: notification },
        { provide: I18nService, useValue: { t: (key: string) => key, language: signal('en') } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
  });

  afterEach(() => {
    sessionStorage.clear();
    setHistoryState(null);
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(MfaVerifyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // triggers ngOnInit
  }

  // AUD19C-C1a: getCurrentNavigation() is null by the time ngOnInit runs — the
  // challenge must be read from history.state (which also survives F5).
  it('reads the MFA challenge from history.state and persists it to sessionStorage', () => {
    setHistoryState({ mfaToken: 'tok-1', email: 'a@b.c', returnUrl: '/target', method: 'EMAIL', navigationId: 7 });

    createComponent();

    expect(router.navigate).not.toHaveBeenCalledWith(['/auth/login']);
    expect(component.method()).toBe('EMAIL');
    const stored = JSON.parse(sessionStorage.getItem(MFA_STORAGE_KEY)!);
    expect(stored.mfaToken).toBe('tok-1');
    expect(stored.email).toBe('a@b.c');
    expect(stored.returnUrl).toBe('/target');
    // AUD19C-C1a: TTL matches the backend's 5-minute Redis challenge window
    expect(stored.expiresAt).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000);
    expect(stored.expiresAt).toBeGreaterThan(Date.now() + 4 * 60 * 1000);
  });

  it('recovers the challenge from sessionStorage when history.state is empty (F5)', () => {
    setHistoryState({ navigationId: 1 });
    sessionStorage.setItem(MFA_STORAGE_KEY, JSON.stringify({
      mfaToken: 'tok-2', email: 'a@b.c', method: 'TOTP', returnUrl: '/', expiresAt: Date.now() + 60_000,
    }));

    createComponent();

    expect(router.navigate).not.toHaveBeenCalledWith(['/auth/login']);
    expect(component.method()).toBe('TOTP');
  });

  it('redirects to login with a warning when the stored challenge expired', () => {
    setHistoryState({ navigationId: 1 });
    sessionStorage.setItem(MFA_STORAGE_KEY, JSON.stringify({
      mfaToken: 'tok-3', email: 'a@b.c', method: 'TOTP', returnUrl: '/', expiresAt: Date.now() - 1,
    }));

    createComponent();

    expect(notification.warning).toHaveBeenCalledWith('auth.mfa.sessionExpired');
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
    expect(sessionStorage.getItem(MFA_STORAGE_KEY)).toBeNull();
  });

  describe('verification error handling', () => {
    beforeEach(() => {
      setHistoryState({ mfaToken: 'tok-4', email: 'a@b.c', returnUrl: '/', method: 'TOTP', navigationId: 2 });
      createComponent();
      component.mfaForm.setValue({ code: '123456' });
    });

    // AUD19C-MFA-UX: 429 = challenge consumed by too many wrong codes — clear it,
    // lock the form, and point the user back to login.
    it('locks the form and clears the challenge on 429', () => {
      mfaService.verifyLogin.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 429 }))
      );

      component.onSubmit();

      expect(component.lockedOut()).toBeTrue();
      expect(component.error()).toBe('auth.mfa.tooManyAttempts');
      expect(sessionStorage.getItem(MFA_STORAGE_KEY)).toBeNull();
      expect(component.mfaForm.disabled).toBeTrue();
      expect(router.navigate).not.toHaveBeenCalledWith(['/auth/login']);

      // The alternate-method actions must leave the DOM entirely: [hidden] would be
      // overridden by the block's own `display: flex`, leaving them clickable against
      // a challenge the backend already deleted.
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.mfa-actions')).toBeNull();

      // Further submits are ignored while locked out
      mfaService.verifyLogin.calls.reset();
      component.onSubmit();
      expect(mfaService.verifyLogin).not.toHaveBeenCalled();
    });

    // AUD19C-MFA-UX: machine-readable code on the error body — the challenge token
    // itself expired; mirror the ngOnInit expiry path (warn + back to login).
    it('redirects to login when the backend reports error.mfa_token_invalid', () => {
      mfaService.verifyLogin.and.returnValue(
        throwError(() => new HttpErrorResponse({
          status: 401,
          error: { code: 'error.mfa_token_invalid' },
        }))
      );

      component.onSubmit();

      expect(notification.warning).toHaveBeenCalledWith('auth.mfa.sessionExpired');
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
      expect(sessionStorage.getItem(MFA_STORAGE_KEY)).toBeNull();
    });

    it('keeps the plain-401 wrong-code message and re-enables the form', () => {
      mfaService.verifyLogin.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 401, error: {} }))
      );

      component.onSubmit();

      expect(component.error()).toBe('auth.mfa.invalidCode');
      expect(component.lockedOut()).toBeFalse();
      expect(component.mfaForm.enabled).toBeTrue();
      expect(router.navigate).not.toHaveBeenCalledWith(['/auth/login']);
    });

    it('completes login and clears the challenge on success', () => {
      mfaService.verifyLogin.and.returnValue(
        of({ tokenType: 'Bearer', expiresIn: 900, email: 'a@b.c', name: 'A' } as LoginResponse)
      );
      authService.getCurrentUser.and.returnValue(
        of({
          id: '1', username: 'a', email: 'a@b.c', name: 'A', role: 'VIEWER',
          active: true, createdAt: '', updatedAt: '',
        } as UserResponse)
      );

      component.onSubmit();

      expect(mockAuthStore.setAuthenticated).toHaveBeenCalled();
      expect(mockAuthStore.login).toHaveBeenCalled();
      expect(sessionStorage.getItem(MFA_STORAGE_KEY)).toBeNull();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/profile');
    });
  });
});
