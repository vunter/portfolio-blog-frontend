import { Component, inject, signal, ChangeDetectionStrategy, OnInit, DestroyRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MfaService } from '../../../../core/services/mfa.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ThemeToggleComponent } from '../../../../shared/components/theme-toggle/theme-toggle.component';
import { switchMap } from 'rxjs';

@Component({
  selector: 'app-mfa-verify',
  imports: [ReactiveFormsModule, RouterLink, ThemeToggleComponent],
  templateUrl: './mfa-verify.component.html',
  styleUrl: './mfa-verify.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MfaVerifyComponent implements OnInit {
  private mfaService = inject(MfaService);
  private authService = inject(AuthService);
  private authStore = inject(AuthStore);
  private router = inject(Router);
  private notification = inject(NotificationService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  i18n = inject(I18nService);

  mfaForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  loading = signal(false);
  sendingOtp = signal(false);
  error = signal<string | null>(null);
  method = signal<'TOTP' | 'EMAIL' | 'BACKUP'>('TOTP');
  usingBackup = signal(false);
  // AUD19C-MFA-UX: backend invalidated the challenge after too many wrong codes (429).
  // The form stays disabled; the only way forward is the "back to login" CTA.
  lockedOut = signal(false);

  private mfaToken = '';
  private email = '';
  private returnUrl = '/';
  private static readonly MFA_STORAGE_KEY = 'mfa_challenge';
  // AUD19C-C1a: TTL matches the backend's 5-minute Redis MFA challenge TTL. A longer
  // client-side window would keep users on this page with a token the backend has
  // already expired — every submit would 401 until the sessionStorage entry lapsed.
  private static readonly MFA_TTL_MS = 5 * 60 * 1000;

  ngOnInit(): void {
    // AUD19C-C1a: read the challenge from history.state, not getCurrentNavigation() —
    // by the time ngOnInit runs the navigation has completed and getCurrentNavigation()
    // returns null. history.state carries the router's extras.state and survives F5.
    const nav = (typeof window !== 'undefined' ? window.history.state : null) as
      Record<string, unknown> | null;
    this.mfaToken = (nav?.['mfaToken'] as string) ?? '';
    this.email = (nav?.['email'] as string) ?? '';
    this.returnUrl = (nav?.['returnUrl'] as string) ?? '/';
    const preferredMethod = (nav?.['method'] as 'TOTP' | 'EMAIL' | 'BACKUP') ?? 'TOTP';
    this.method.set(preferredMethod);

    let sessionExpired = false;

    // Q9.1: If navigation state is present, persist to sessionStorage with TTL
    if (this.mfaToken) {
      sessionStorage.setItem(MfaVerifyComponent.MFA_STORAGE_KEY, JSON.stringify({
        mfaToken: this.mfaToken,
        email: this.email,
        method: preferredMethod,
        returnUrl: this.returnUrl,
        expiresAt: Date.now() + MfaVerifyComponent.MFA_TTL_MS,
      }));
    } else {
      // Recover from sessionStorage on page refresh
      try {
        const stored = JSON.parse(sessionStorage.getItem(MfaVerifyComponent.MFA_STORAGE_KEY) || '');
        if (stored && stored.expiresAt > Date.now()) {
          this.mfaToken = stored.mfaToken;
          this.email = stored.email;
          this.method.set(stored.method ?? 'TOTP');
          this.returnUrl = stored.returnUrl ?? '/';
        } else if (stored && stored.mfaToken) {
          // A challenge existed but its TTL lapsed — explain the bounce to login.
          sessionExpired = true;
        }
      } catch { /* invalid or missing — redirect below */ }
    }

    if (!this.mfaToken) {
      sessionStorage.removeItem(MfaVerifyComponent.MFA_STORAGE_KEY);
      if (sessionExpired) {
        this.notification.warning(this.i18n.t('auth.mfa.sessionExpired'));
      }
      this.router.navigate(['/auth/login']);
    }
  }

  /** Accept only relative same-origin paths as a post-verify redirect target. */
  private isSafeRedirect(url: string): boolean {
    return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//');
  }

  onSubmit(): void {
    if (this.lockedOut()) return;
    if (this.mfaForm.invalid) {
      this.mfaForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.mfaForm.disable();

    const code = this.mfaForm.getRawValue().code!;

    this.mfaService.verifyLogin({
      mfaToken: this.mfaToken,
      code,
      method: this.method(),
    }).pipe(
      switchMap((response) => {
        this.authStore.setAuthenticated();
        if (response.expiresIn) {
          this.authStore.setTokenExpiry(response.expiresIn);
        }
        return this.authService.getCurrentUser();
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (user) => {
        sessionStorage.removeItem(MfaVerifyComponent.MFA_STORAGE_KEY);
        this.authStore.login(user);
        this.notification.success(this.i18n.t('auth.login.success'));
        // Honor the original returnUrl (validated) when present; otherwise fall back
        // to the role-based default, matching the password-only login flow.
        const defaultRoute = user.role === 'VIEWER' ? '/profile' : '/admin';
        const target = this.returnUrl !== '/' && this.isSafeRedirect(this.returnUrl)
          ? this.returnUrl
          : defaultRoute;
        this.router.navigateByUrl(target);
      },
      error: (err) => {
        this.loading.set(false);
        // AUD19C-MFA-UX: 429 — too many wrong codes; the backend deleted the challenge.
        // Keep the form disabled and point the user back to login (footer CTA).
        if (err.status === 429) {
          sessionStorage.removeItem(MfaVerifyComponent.MFA_STORAGE_KEY);
          this.lockedOut.set(true);
          this.error.set(this.i18n.t('auth.mfa.tooManyAttempts'));
          return;
        }
        // AUD19C-MFA-UX: the challenge token itself is invalid/expired (backend sends a
        // machine-readable `code` on error bodies) — mirror the ngOnInit expiry path.
        if (err.error?.code === 'error.mfa_token_invalid') {
          sessionStorage.removeItem(MfaVerifyComponent.MFA_STORAGE_KEY);
          this.notification.warning(this.i18n.t('auth.mfa.sessionExpired'));
          this.router.navigate(['/auth/login']);
          return;
        }
        this.mfaForm.enable();
        if (err.status === 401) {
          this.error.set(this.i18n.t('auth.mfa.invalidCode'));
        } else {
          this.error.set(this.i18n.t('auth.mfa.genericError'));
        }
      },
    });
  }

  resendEmailOtp(): void {
    if (!this.mfaToken) return;
    this.sendingOtp.set(true);
    this.mfaService.sendEmailOtp(this.mfaToken).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.sendingOtp.set(false);
        this.notification.success(this.i18n.t('auth.mfa.otpSent'));
      },
      error: () => {
        this.sendingOtp.set(false);
        this.error.set(this.i18n.t('auth.mfa.sendFailed'));
      },
    });
  }

  switchMethod(): void {
    this.method.update(m => m === 'TOTP' ? 'EMAIL' : 'TOTP');
    this.usingBackup.set(false);
    this.mfaForm.get('code')?.setValidators([Validators.required, Validators.minLength(6), Validators.maxLength(6)]);
    this.mfaForm.get('code')?.updateValueAndValidity();
    if (this.method() === 'EMAIL') {
      this.resendEmailOtp();
    }
  }

  useBackupCode(): void {
    this.usingBackup.set(true);
    this.method.set('BACKUP');
    this.mfaForm.get('code')?.setValidators([Validators.required, Validators.minLength(9), Validators.maxLength(9)]);
    this.mfaForm.get('code')?.updateValueAndValidity();
  }
}
