import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { ApiService } from '../../../../core/services/api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ThemeToggleComponent } from '../../../../shared/components/theme-toggle/theme-toggle.component';
import { UserResponse } from '../../../../models';

@Component({
  selector: 'app-complete-profile',
  imports: [ReactiveFormsModule, ThemeToggleComponent],
  templateUrl: './complete-profile.component.html',
  styleUrl: './complete-profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompleteProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private authStore = inject(AuthStore);
  private api = inject(ApiService);
  private notification = inject(NotificationService);
  i18n = inject(I18nService);

  private static readonly PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

  loading = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  errorMessage = signal('');

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(255)]],
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50),
      Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
    newPassword: ['', [Validators.required, Validators.minLength(12), Validators.pattern(CompleteProfileComponent.PASSWORD_PATTERN)]],
    confirmPassword: ['', [Validators.required]],
  });

  ngOnInit(): void {
    const user = this.authStore.user();
    if (user) {
      this.form.patchValue({
        name: user.name || '',
        username: user.username || this.suggestUsername(user.name || ''),
      });
    }
    if (user?.hasPassword) {
      this.router.navigateByUrl('/');
    }
  }

  private suggestUsername(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, username, newPassword, confirmPassword } = this.form.value;

    if (newPassword !== confirmPassword) {
      this.errorMessage.set(this.i18n.t('auth.register.passwordMismatch'));
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.api.putResponse<UserResponse>('/admin/users/me', {
      name,
      username,
      newPassword,
    }).subscribe({
      next: (res) => {
        const updatedUser = res.body;
        if (updatedUser) {
          this.authStore.updateUser(updatedUser);
        }
        this.notification.success(this.i18n.t('auth.completeProfile.success'));
        this.router.navigateByUrl('/');
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err.error?.message || err.error?.validationErrors?.username
          || this.i18n.t('auth.completeProfile.error');
        this.errorMessage.set(msg);
      },
    });
  }
}
