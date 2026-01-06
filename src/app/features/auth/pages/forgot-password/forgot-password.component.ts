import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { I18nService } from '../../../../core/services/i18n.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { RecaptchaService } from '../../../../core/services/recaptcha.service';
import { ThemeToggleComponent } from '../../../../shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, ThemeToggleComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  private authService = inject(AuthService);
  private recaptcha = inject(RecaptchaService);
  private fb = inject(FormBuilder);
  i18n = inject(I18nService);

  forgotForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  loading = signal(false);
  error = signal<string | null>(null);
  submitted = signal(false);

  onSubmit(): void {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      this.error.set(this.i18n.t('auth.forgotPassword.enterEmail'));
      return;
    }

    const { email } = this.forgotForm.getRawValue();

    this.loading.set(true);
    this.error.set(null);

    this.recaptcha.execute('forgot_password').then(recaptchaToken => {
      this.authService.requestPasswordReset({ email: email!, recaptchaToken: recaptchaToken ?? undefined }).subscribe({
        next: () => {
          this.loading.set(false);
          this.submitted.set(true);
        },
        error: () => {
          // Always show success to prevent email enumeration
          this.loading.set(false);
          this.submitted.set(true);
        },
      });
    }).catch(() => {
      this.loading.set(false);
      this.error.set(this.i18n.t('error.unexpected'));
    });
  }
}
