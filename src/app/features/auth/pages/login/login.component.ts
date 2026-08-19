import { Component, inject, signal, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { NgOptimizedImage, UpperCasePipe } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { from, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { RecaptchaService } from '../../../../core/services/recaptcha.service';
import { ThemeToggleComponent } from '../../../../shared/components/theme-toggle/theme-toggle.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, ThemeToggleComponent, NgOptimizedImage, UpperCasePipe],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private authService = inject(AuthService);
  private authStore = inject(AuthStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private notification = inject(NotificationService);
  private recaptcha = inject(RecaptchaService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  i18n = inject(I18nService);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  showPassword = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);
  googleEnabled = signal(false);
  githubEnabled = signal(false);
  linkedinEnabled = signal(false);

  // Q9.5: Client-side rate limiting UI
  failureCount = signal(0);
  lockedUntil = signal<number | null>(null);
  cooldownSeconds = signal(0);
  private cooldownInterval: ReturnType<typeof setInterval> | null = null;
  private static readonly MAX_FAILURES = 3;
  private static readonly COOLDOWN_SECONDS = 30;

  constructor() {
    // Q7.2: Clean up cooldown interval on component destroy
    this.destroyRef.onDestroy(() => {
      if (this.cooldownInterval) clearInterval(this.cooldownInterval);
    });

    this.authService.getOAuthProviders().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(providers => {
      this.googleEnabled.set(!!providers['google']);
      this.githubEnabled.set(!!providers['github']);
      this.linkedinEnabled.set(!!providers['linkedin']);
    });
  }

  loginWithGoogle(): void {
    window.location.href = `${environment.apiUrl}/${environment.apiVersion}/admin/auth/oauth2/authorize/google`;
  }

  loginWithGithub(): void {
    window.location.href = `${environment.apiUrl}/${environment.apiVersion}/admin/auth/oauth2/authorize/github`;
  }

  loginWithLinkedin(): void {
    window.location.href = `${environment.apiUrl}/${environment.apiVersion}/admin/auth/oauth2/authorize/linkedin`;
  }

  get isLockedOut(): boolean {
    const until = this.lockedUntil();
    return until !== null && Date.now() < until;
  }

  onSubmit(): void {
    // Q9.5: Enforce client-side cooldown
    if (this.isLockedOut) {
      this.error.set(this.i18n.t('auth.login.tooManyAttempts') + ` (${this.cooldownSeconds()}s)`);
      return;
    }

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.error.set(this.i18n.t('auth.login.fillAllFields'));
      return;
    }

    const { email, password, rememberMe } = this.loginForm.getRawValue();

    this.loading.set(true);
    this.error.set(null);
    this.loginForm.disable();

    from(this.recaptcha.execute('login')).pipe(
      switchMap(recaptchaToken => this.authService
        .login({
          email: email!,
          password: password!,
          rememberMe: rememberMe!,
          recaptchaToken: recaptchaToken ?? undefined,
        })
      ),
      tap((response) => {
        // If MFA is required, redirect to MFA verify page instead of completing login
        if (response.mfaRequired && response.mfaToken) {
          this.loading.set(false);
          this.loginForm.enable();
          // Carry the original returnUrl through the MFA challenge so the user lands
          // on the page they were heading to, consistent with the password-only flow.
          const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
          this.router.navigate(['/auth/mfa-verify'], {
            state: {
              mfaToken: response.mfaToken,
              email: response.email,
              returnUrl,
              // AUD19C-MFA-UX: preselect the user's preferred MFA method on the verify page
              method: response.mfaMethod ?? undefined,
            },
          });
          return;
        }
        this.authStore.setAuthenticated();
        if (response.expiresIn) {
          this.authStore.setTokenExpiry(response.expiresIn);
        }
      }),
      // Skip the rest of the pipeline if MFA is required
      switchMap((response) => {
        if (response.mfaRequired) {
          return [];
        }
        return this.authService.getCurrentUser();
      }),
      takeUntilDestroyed(this.destroyRef),
    )
      .subscribe({
        next: (user) => {
          this.authStore.login(user);
          this.notification.success(this.i18n.t('auth.login.success'));

          const defaultRoute = '/';
          const returnUrl =
            this.route.snapshot.queryParams['returnUrl'] || defaultRoute;
          // Q9.2: Robust open redirect validation using URL parser
          const safeUrl = this.isSafeRedirectUrl(returnUrl) ? returnUrl : defaultRoute;
          this.router.navigateByUrl(safeUrl);
        },
        error: (err) => {
          this.loading.set(false);
          this.loginForm.enable();
          if (err.status === 401) {
            this.error.set(this.i18n.t('auth.login.invalidCredentials'));
            this.onLoginFailure();
          } else if (err.status === 429) {
            this.error.set(this.i18n.t('auth.login.tooManyAttempts'));
            this.startCooldown(LoginComponent.COOLDOWN_SECONDS);
          } else {
            this.error.set(this.i18n.t('auth.login.genericError'));
          }
        },
      });
  }

  private onLoginFailure(): void {
    this.failureCount.update(c => c + 1);
    if (this.failureCount() >= LoginComponent.MAX_FAILURES) {
      this.startCooldown(LoginComponent.COOLDOWN_SECONDS);
    }
  }

  private startCooldown(seconds: number): void {
    this.lockedUntil.set(Date.now() + seconds * 1000);
    this.cooldownSeconds.set(seconds);
    if (this.cooldownInterval) clearInterval(this.cooldownInterval);
    this.cooldownInterval = setInterval(() => {
      const remaining = Math.ceil(((this.lockedUntil() ?? 0) - Date.now()) / 1000);
      if (remaining <= 0) {
        this.cooldownSeconds.set(0);
        this.lockedUntil.set(null);
        this.failureCount.set(0);
        if (this.cooldownInterval) {
          clearInterval(this.cooldownInterval);
          this.cooldownInterval = null;
        }
      } else {
        this.cooldownSeconds.set(remaining);
      }
    }, 1000);
  }

  /**
   * Q9.2: Robust open redirect prevention.
   * Validates that the URL is a same-origin relative path.
   * Blocks: //, /\, protocol-relative, encoded slashes, @ authority.
   */
  private isSafeRedirectUrl(url: string): boolean {
    if (!url || !url.startsWith('/')) return false;
    // Block protocol-relative and backslash variants
    if (url.startsWith('//') || url.startsWith('/\\')) return false;
    // Decode and re-check for encoded bypass attempts
    try {
      const decoded = decodeURIComponent(url);
      if (decoded.startsWith('//') || decoded.startsWith('/\\')) return false;
      // Block authority confusion (e.g. /path@evil.com)
      if (decoded.includes('@')) return false;
    } catch {
      return false; // malformed encoding
    }
    // Parse with a dummy base — if the resulting origin differs, it's an open redirect
    try {
      const base = window.location.origin;
      const parsed = new URL(url, base);
      if (parsed.origin !== base) return false;
      if (parsed.username || parsed.password) return false;
    } catch {
      return false;
    }
    return true;
  }
}
