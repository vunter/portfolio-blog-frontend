import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { from, switchMap, tap } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { RecaptchaService } from '../../../../core/services/recaptcha.service';
import { ThemeToggleComponent } from '../../../../shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, ThemeToggleComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private authStore = inject(AuthStore);
  private router = inject(Router);
  private notification = inject(NotificationService);
  private recaptcha = inject(RecaptchaService);
  private fb = inject(FormBuilder);
  i18n = inject(I18nService);

  // Password must have: uppercase, lowercase, digit, special char (anything non-alphanumeric)
  private static readonly PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

  registerForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(12), Validators.pattern(RegisterComponent.PASSWORD_PATTERN)]],
    confirmPassword: ['', [Validators.required]],
    termsAccepted: [false, [Validators.requiredTrue]],
  });

  showPassword = signal(false);
  showConfirmPassword = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});
  googleEnabled = signal(false);
  githubEnabled = signal(false);
  linkedinEnabled = signal(false);

  constructor() {
    this.authService.getOAuthProviders().subscribe(providers => {
      this.googleEnabled.set(!!providers['google']);
      this.githubEnabled.set(!!providers['github']);
      this.linkedinEnabled.set(!!providers['linkedin']);
    });
  }

  loginWithGoogle(): void {
    window.location.href = '/api/v1/admin/auth/oauth2/authorize/google';
  }

  loginWithGithub(): void {
    window.location.href = '/api/v1/admin/auth/oauth2/authorize/github';
  }

  loginWithLinkedin(): void {
    window.location.href = '/api/v1/admin/auth/oauth2/authorize/linkedin';
  }

  onSubmit(): void {
    this.fieldErrors.set({});

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.error.set(this.i18n.t('auth.register.fillAllFields'));
      return;
    }

    const { name, email, password, confirmPassword } = this.registerForm.getRawValue();

    if (password !== confirmPassword) {
      this.error.set(this.i18n.t('auth.register.passwordMismatch'));
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    from(this.recaptcha.execute('register')).pipe(
      switchMap(recaptchaToken => this.authService
        .register({
          name: name!,
          email: email!,
          password: password!,
          termsAccepted: true,
          recaptchaToken: recaptchaToken ?? undefined,
        })
      ),
      tap((response) => {
        this.authStore.setAuthenticated();
        if (response.expiresIn) {
          this.authStore.setTokenExpiry(response.expiresIn);
        }
      }),
      switchMap(() => this.authService.getCurrentUser()),
    )
      .subscribe({
        next: (user) => {
          this.authStore.login(user);
          this.notification.success(this.i18n.t('auth.register.success'));
          this.router.navigateByUrl('/admin');
        },
        error: (err) => {
          this.loading.set(false);
          if (err.status === 409) {
            this.error.set(this.i18n.t('auth.register.emailExists'));
          } else if (err.status === 400 && err.error?.validationErrors) {
            // Display per-field validation errors from the API
            const serverErrors: Record<string, string> = err.error.validationErrors;
            this.fieldErrors.set(serverErrors);
            const messages = Object.values(serverErrors).join('; ');
            this.error.set(messages);
          } else if (err.status === 400) {
            const msg = err.error?.message || this.i18n.t('auth.register.validationError');
            this.error.set(msg);
          } else {
            this.error.set(this.i18n.t('auth.register.genericError'));
          }
        },
      });
  }
}
