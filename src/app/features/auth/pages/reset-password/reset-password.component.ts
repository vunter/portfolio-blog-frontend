import { Component, signal, OnInit, inject, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../../core/auth/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ThemeToggleComponent } from '../../../../shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, ThemeToggleComponent],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private notification = inject(NotificationService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  i18n = inject(I18nService);

  // Password must have: uppercase, lowercase, digit, special char (anything non-alphanumeric)
  private static readonly PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

  token: string | null = null;

  resetForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(12), Validators.pattern(ResetPasswordComponent.PASSWORD_PATTERN)]],
    confirmPassword: ['', [Validators.required]],
  });

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);
  // AUD19C-RESET: server-side pre-validation of the reset token so the user learns the
  // link is dead BEFORE typing a new password (the template shows the "request new
  // link" CTA). Fails open on transport errors — submit still surfaces the real state.
  tokenInvalid = signal(false);

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
    if (this.token) {
      this.authService.validateResetToken(this.token)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            if (res.valid === false) {
              this.tokenInvalid.set(true);
            }
          },
          // Fail open: a transport error must not block a possibly-valid token.
          error: () => {},
        });
    }
  }

  onSubmit(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      this.error.set(this.i18n.t('auth.resetPassword.fillFields'));
      return;
    }

    const { password, confirmPassword } = this.resetForm.getRawValue();

    if (password !== confirmPassword) {
      this.error.set(this.i18n.t('auth.resetPassword.mismatch'));
      return;
    }

    if (!this.token) {
      this.error.set(this.i18n.t('auth.resetPassword.invalidToken'));
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.authService
      .confirmPasswordReset({
        token: this.token,
        newPassword: password!,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.success.set(true);
        },
        error: (err) => {
          this.loading.set(false);
          // AUD19C-RESET: 401 = invalid/expired token; 400 = the backend rejected the
          // new password (policy) and localizes the reason in `message` — showing the
          // expired-token text for a weak password sent users chasing a new link.
          if (err.status === 401) {
            this.error.set(this.i18n.t('auth.resetPassword.expiredToken'));
          } else if (err.status === 400) {
            this.error.set(err.error?.message || this.i18n.t('auth.resetPassword.genericError'));
          } else {
            this.error.set(this.i18n.t('auth.resetPassword.genericError'));
          }
        },
      });
  }
}
