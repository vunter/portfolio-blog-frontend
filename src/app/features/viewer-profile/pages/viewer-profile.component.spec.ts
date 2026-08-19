import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { ViewerProfileComponent } from './viewer-profile.component';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { ApiService } from '../../../core/services/api.service';
import { AdminApiService } from '../../admin/services/admin-api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { I18nService } from '../../../core/services/i18n.service';
import { UserResponse } from '../../../models';

// AUD19: spec for the resend email verification affordance
describe('ViewerProfileComponent', () => {
  let component: ViewerProfileComponent;
  let fixture: ComponentFixture<ViewerProfileComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockApi: jasmine.SpyObj<ApiService>;
  let mockNotification: jasmine.SpyObj<NotificationService>;

  const buildUser = (overrides: Partial<UserResponse> = {}): UserResponse => ({
    id: '1',
    username: 'leo',
    email: 'leo@example.com',
    name: 'Leo',
    role: 'VIEWER',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  });

  function setup(user: UserResponse): void {
    mockAuthService.getCurrentUser.and.returnValue(of(user));
    fixture = TestBed.createComponent(ViewerProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockAuthService = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    mockApi = jasmine.createSpyObj('ApiService', ['get', 'post', 'put', 'delete']);
    mockNotification = jasmine.createSpyObj('NotificationService', ['success', 'error', 'warning', 'info']);

    // No pending role request on init
    mockApi.get.and.returnValue(throwError(() => new Error('no content')));

    const mockI18n = {
      t: (key: string) => key,
      language: signal('en'),
    };
    const mockAuthStore = {
      user: signal<UserResponse | null>(null),
      login: jasmine.createSpy('login'),
    };

    await TestBed.configureTestingModule({
      imports: [ViewerProfileComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: ApiService, useValue: mockApi },
        { provide: AdminApiService, useValue: jasmine.createSpyObj('AdminApiService', ['uploadMedia']) },
        { provide: NotificationService, useValue: mockNotification },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compileComponents();
  });

  it('shows the resend notice when the email is not verified', () => {
    setup(buildUser({ emailVerified: false }));

    const notice: HTMLElement | null = fixture.nativeElement.querySelector('.email-verify-notice');
    const button: HTMLButtonElement | null = fixture.nativeElement.querySelector('.btn-resend-verification');
    expect(notice).toBeTruthy();
    expect(button).toBeTruthy();
    expect(notice?.textContent).toContain('account.profile.emailNotVerified');
  });

  it('hides the notice when the email is verified', () => {
    setup(buildUser({ emailVerified: true }));

    expect(fixture.nativeElement.querySelector('.email-verify-notice')).toBeNull();
  });

  it('hides the notice when the verification flag is unknown', () => {
    setup(buildUser());

    expect(fixture.nativeElement.querySelector('.email-verify-notice')).toBeNull();
  });

  it('POSTs to the resend endpoint when the button is clicked', () => {
    mockApi.post.and.returnValue(of({ message: 'email.verification_sent' }));
    setup(buildUser({ emailVerified: false }));

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-resend-verification');
    button.click();
    fixture.detectChanges();

    expect(mockApi.post).toHaveBeenCalledWith('/admin/auth/resend-verification', {});
    expect(mockNotification.success).toHaveBeenCalled();
    expect(component.verificationSent()).toBeTrue();
  });

  it('disables the button during a 60s cooldown after success', () => {
    jasmine.clock().install();
    try {
      mockApi.post.and.returnValue(of({ message: 'email.verification_sent' }));
      setup(buildUser({ emailVerified: false }));

      component.resendVerification();
      fixture.detectChanges();

      expect(component.resendCooldown()).toBe(60);
      const button: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-resend-verification');
      expect(button.disabled).toBeTrue();

      // A second call during cooldown must not fire another request
      component.resendVerification();
      expect(mockApi.post).toHaveBeenCalledTimes(1);

      jasmine.clock().tick(60_000);
      fixture.detectChanges();

      expect(component.resendCooldown()).toBe(0);
      expect(button.disabled).toBeFalse();
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('shows the busy state while the request is in flight', () => {
    const pending = new Subject<{ message: string }>();
    mockApi.post.and.returnValue(pending.asObservable());
    setup(buildUser({ emailVerified: false }));

    component.resendVerification();
    fixture.detectChanges();

    expect(component.resendingVerification()).toBeTrue();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-resend-verification');
    expect(button.disabled).toBeTrue();

    pending.next({ message: 'email.verification_sent' });
    pending.complete();
    fixture.detectChanges();

    expect(component.resendingVerification()).toBeFalse();
  });

  it('notifies and re-enables the button on failure (no cooldown)', () => {
    mockApi.post.and.returnValue(throwError(() => new Error('rate limited')));
    setup(buildUser({ emailVerified: false }));

    component.resendVerification();
    fixture.detectChanges();

    expect(mockNotification.error).toHaveBeenCalled();
    expect(component.resendingVerification()).toBeFalse();
    expect(component.resendCooldown()).toBe(0);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-resend-verification');
    expect(button.disabled).toBeFalse();
  });
});
