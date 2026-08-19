import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { SecuritySettingsComponent } from './security-settings.component';
import { MfaService } from '../../../../core/services/mfa.service';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService, SessionInfo } from '../../../../core/auth/auth.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { UserResponse } from '../../../../models';

describe('SecuritySettingsComponent', () => {
  let component: SecuritySettingsComponent;
  let fixture: ComponentFixture<SecuritySettingsComponent>;
  let mfaService: jasmine.SpyObj<MfaService>;
  let apiService: jasmine.SpyObj<ApiService>;
  let authService: jasmine.SpyObj<AuthService>;
  let notification: jasmine.SpyObj<NotificationService>;
  let userSignal: ReturnType<typeof signal<UserResponse | null>>;

  const baseUser = {
    id: '1',
    username: 'leo',
    email: 'leo@example.com',
    name: 'Leo',
    role: 'VIEWER',
    active: true,
    hasPassword: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  } as UserResponse;

  // AUD19C-A3FE: Snowflake session ids are strings — exceeding MAX_SAFE_INTEGER.
  const session: SessionInfo = {
    id: '9223372036854775807',
    deviceName: 'Chrome on Windows',
    ipAddress: '10.0.0.1',
    createdAt: '2026-08-01T00:00:00Z',
    lastUsedAt: '2026-08-18T00:00:00Z',
    expiresAt: '2026-09-01T00:00:00Z',
  };

  beforeEach(async () => {
    mfaService = jasmine.createSpyObj('MfaService', [
      'getStatus', 'setup', 'verifySetup', 'disable', 'disableMethod',
      'sendAuthenticatedOtp', 'generateBackupCodes',
    ]);
    apiService = jasmine.createSpyObj('ApiService', ['get', 'delete']);
    authService = jasmine.createSpyObj('AuthService', [
      'getActiveSessions', 'revokeSession', 'revokeAllOtherSessions',
    ]);
    notification = jasmine.createSpyObj('NotificationService', ['success', 'error', 'warning', 'info']);
    userSignal = signal<UserResponse | null>(baseUser);

    mfaService.getStatus.and.returnValue(
      of({ mfaEnabled: true, methods: ['TOTP'], backupCodesRemaining: 5 })
    );
    apiService.get.and.returnValue(of([]));
    authService.getActiveSessions.and.returnValue(of([session]));

    await TestBed.configureTestingModule({
      imports: [SecuritySettingsComponent],
      providers: [
        { provide: MfaService, useValue: mfaService },
        { provide: ApiService, useValue: apiService },
        { provide: AuthService, useValue: authService },
        { provide: AuthStore, useValue: { user: userSignal } },
        { provide: NotificationService, useValue: notification },
        { provide: ConfirmDialogService, useValue: jasmine.createSpyObj('ConfirmDialogService', ['confirm']) },
        { provide: I18nService, useValue: { t: (key: string) => key, language: signal('en') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SecuritySettingsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('disable-MFA inline panel (AUD19C-A3FE)', () => {
    it('is hidden until the disable button is clicked, then shows the password form', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#disable-mfa-password')).toBeFalsy();

      component.startDisableMfa();
      fixture.detectChanges();

      expect(component.disableMfaPanel()).toBeTrue();
      expect(fixture.nativeElement.querySelector('#disable-mfa-password')).toBeTruthy();
    });

    it('hides the password form for social-only users (hasPassword=false) and shows the hint', () => {
      userSignal.set({ ...baseUser, hasPassword: false });
      fixture.detectChanges();

      component.startDisableMfa();
      fixture.detectChanges();

      expect(component.hasPassword()).toBeFalse();
      expect(fixture.nativeElement.querySelector('#disable-mfa-password')).toBeFalsy();
      expect(fixture.nativeElement.textContent).toContain('account.security.disableNoPassword');
    });

    it('treats a user without the hasPassword field as having a password', () => {
      userSignal.set({ ...baseUser, hasPassword: undefined });
      fixture.detectChanges();
      expect(component.hasPassword()).toBeTrue();
    });

    it('does not call the service when the password is empty', () => {
      fixture.detectChanges();
      component.startDisableMfa();

      component.confirmDisableMfa();

      expect(mfaService.disable).not.toHaveBeenCalled();
      expect(component.disableMfaForm.controls.password.touched).toBeTrue();
    });

    it('sends the password to the service and closes the panel on success', () => {
      mfaService.disable.and.returnValue(of(void 0));
      fixture.detectChanges();
      component.startDisableMfa();
      component.disableMfaForm.controls.password.setValue('s3cret');

      component.confirmDisableMfa();

      expect(mfaService.disable).toHaveBeenCalledWith('s3cret');
      expect(component.disableMfaPanel()).toBeFalse();
      expect(notification.success).toHaveBeenCalledWith('account.security.mfaDisabled');
    });

    it('maps 400 to the wrong-password message and keeps the panel open', () => {
      mfaService.disable.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 400 }))
      );
      fixture.detectChanges();
      component.startDisableMfa();
      component.disableMfaForm.controls.password.setValue('wrong');

      component.confirmDisableMfa();

      expect(notification.error).toHaveBeenCalledWith('account.security.wrongPassword');
      expect(component.disableMfaPanel()).toBeTrue();
      expect(component.disabling()).toBeFalse();
    });

    it('maps other errors to the generic disable-failed message', () => {
      mfaService.disable.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 500 }))
      );
      fixture.detectChanges();
      component.startDisableMfa();
      component.disableMfaForm.controls.password.setValue('s3cret');

      component.confirmDisableMfa();

      expect(notification.error).toHaveBeenCalledWith('account.security.disableFailed');
    });
  });

  describe('sessions (Snowflake string ids)', () => {
    it('revokes a session passing the id through as a string', () => {
      authService.revokeSession.and.returnValue(of(void 0));
      fixture.detectChanges();

      component.revokeSession(session.id);

      expect(authService.revokeSession).toHaveBeenCalledWith('9223372036854775807');
      expect(component.revokingId()).toBeNull();
    });

    it('tracks the revoking id as a string while the request is in flight', () => {
      authService.revokeSession.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 500 }))
      );
      fixture.detectChanges();

      component.revokeSession(session.id);

      expect(notification.error).toHaveBeenCalledWith('account.security.sessionRevokeFailed');
      expect(component.revokingId()).toBeNull();
    });
  });
});
