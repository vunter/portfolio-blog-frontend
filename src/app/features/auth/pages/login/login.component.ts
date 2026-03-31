import { Component, inject, signal, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
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
  imports: [ReactiveFormsModule, RouterLink, ThemeToggleComponent, NgOptimizedImage],
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

  constructor() {
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

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.error.set(this.i18n.t('auth.login.fillAllFields'));
      return;
    }

    const { email, password, rememberMe } = this.loginForm.getRawValue();

    this.loading.set(true);
    this.error.set(null);

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
          this.router.navigate(['/auth/mfa-verify'], {
            state: {
              mfaToken: response.mfaToken,
              email: response.email,
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
          // Prevent open redirect: only allow relative URLs starting with /
          const safeUrl = returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : defaultRoute;
          this.router.navigateByUrl(safeUrl);
        },
        error: (err) => {
          this.loading.set(false);
          if (err.status === 401) {
            this.error.set(this.i18n.t('auth.login.invalidCredentials'));
          } else if (err.status === 429) {
            this.error.set(
              this.i18n.t('auth.login.tooManyAttempts')
            );
          } else {
            this.error.set(this.i18n.t('auth.login.genericError'));
          }
        },
      });
  }
}
