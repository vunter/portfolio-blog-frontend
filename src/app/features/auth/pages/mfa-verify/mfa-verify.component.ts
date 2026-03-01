import { Component, inject, signal, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  i18n = inject(I18nService);

  mfaForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  loading = signal(false);
  sendingOtp = signal(false);
  error = signal<string | null>(null);
  method = signal<'TOTP' | 'EMAIL' | 'BACKUP'>('TOTP');
  usingBackup = signal(false);

  private mfaToken = '';
  private email = '';

  ngOnInit(): void {
    // Get MFA token and method from navigation state
    const nav = this.router.getCurrentNavigation()?.extras?.state ??
                history.state;
    this.mfaToken = nav?.['mfaToken'] ?? '';
    this.email = nav?.['email'] ?? '';
    const preferredMethod = nav?.['method'] ?? 'TOTP';
    this.method.set(preferredMethod);

    if (!this.mfaToken) {
      this.router.navigate(['/auth/login']);
    }
  }

  onSubmit(): void {
    if (this.mfaForm.invalid) {
      this.mfaForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

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
    ).subscribe({
      next: (user) => {
        this.authStore.login(user);
        this.notification.success(this.i18n.t('auth.login.success'));
        const defaultRoute = user.role === 'VIEWER' ? '/profile' : '/admin';
        this.router.navigateByUrl(defaultRoute);
      },
      error: (err) => {
        this.loading.set(false);
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
    this.mfaService.sendEmailOtp(this.mfaToken).subscribe({
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
