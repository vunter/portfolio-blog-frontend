import { Component, signal, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  i18n = inject(I18nService);

  token: string | null = null;

  resetForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(12)]],
    confirmPassword: ['', [Validators.required]],
  });

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
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
          if (err.status === 400) {
            this.error.set(this.i18n.t('auth.resetPassword.expiredToken'));
          } else {
            this.error.set(this.i18n.t('auth.resetPassword.genericError'));
          }
        },
      });
  }
}
