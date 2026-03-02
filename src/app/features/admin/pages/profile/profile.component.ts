import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy, viewChild, ElementRef, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { ApiService } from '../../../../core/services/api.service';
import { AdminApiService } from '../../services/admin-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { UserResponse } from '../../../../models';
import { HomeCustomizationComponent } from '../../components/home-customization/home-customization.component';
import { ResumeProfileComponent } from '../../../resume/pages/profile/resume-profile.component';

interface ProfileForm {
  name: string;
  email: string;
  username: string;
  avatarUrl: string;
  bio: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

@Component({
  selector: 'app-profile',
  imports: [FormsModule, DatePipe, RouterLink, HomeCustomizationComponent, ResumeProfileComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent implements OnInit {
  private authService = inject(AuthService);
  private authStore = inject(AuthStore);
  private api = inject(ApiService);
  private adminApi = inject(AdminApiService);
  private notification = inject(NotificationService);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  i18n = inject(I18nService);

  resumeProfile = viewChild(ResumeProfileComponent);
  hcRef = viewChild(HomeCustomizationComponent);
  avatarInput = viewChild<ElementRef<HTMLInputElement>>('avatarFileInput');

  loading = signal(true);
  saving = signal(false);
  uploadingAvatar = signal(false);
  user = signal<UserResponse | null>(null);
  fieldErrors = signal<Record<string, string>>({});
  formSubmitted = signal(false);
  isSetupMode = signal(false);

  editingEmail = signal(false);
  editingUsername = signal(false);
  sensitivePassword = signal('');
  private originalEmail = '';
  private originalUsername = '';

  /** Computed signal that reactively reads the resume profile component's field errors */
  rpFieldErrors = computed(() => this.resumeProfile()?.fieldErrors() ?? {});
  rpFormSubmitted = computed(() => this.resumeProfile()?.formSubmitted() ?? false);

  sensitiveFieldChanged = computed(() => {
    const user = this.user();
    if (!user) return false;
    return this.form.email.toLowerCase().trim() !== this.originalEmail.toLowerCase().trim()
      || this.form.username.trim() !== this.originalUsername.trim();
  });

  form: ProfileForm = {
    name: '',
    email: '',
    username: '',
    avatarUrl: '',
    bio: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  };

  ngOnInit(): void {
    this.isSetupMode.set(this.route.snapshot.queryParams['setup'] === 'true');
    this.authService.getCurrentUser().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (user) => {
        this.user.set(user);
        this.form.name = user.name || '';
        this.form.email = user.email || '';
        this.form.username = user.username ?? '';
        this.originalEmail = user.email || '';
        this.originalUsername = user.username ?? '';
        const avatar = user.avatarUrl ?? '';
        this.form.avatarUrl = avatar.startsWith('http') ? avatar : '';
        this.form.bio = user.bio ?? '';
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notification.error(this.i18n.t('admin.profile.loadError'));
      }
    });
  }

  enableEditEmail(): void {
    this.editingEmail.set(true);
  }

  cancelEditEmail(): void {
    this.form.email = this.originalEmail;
    this.editingEmail.set(false);
    this.sensitivePassword.set('');
  }

  enableEditUsername(): void {
    this.editingUsername.set(true);
  }

  cancelEditUsername(): void {
    this.form.username = this.originalUsername;
    this.editingUsername.set(false);
    this.sensitivePassword.set('');
  }

  confirmSensitiveChange(): void {
    if (!this.sensitivePassword()) {
      this.notification.error(this.i18n.t('admin.profile.passwordRequiredForChange'));
      return;
    }
    this.save();
  }

  triggerAvatarUpload(): void {
    this.avatarInput()?.nativeElement.click();
  }

  onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    // Validate client-side
    if (!file.type.startsWith('image/')) {
      this.notification.error(this.i18n.t('admin.profile.avatarInvalidType'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.notification.error(this.i18n.t('admin.profile.avatarTooLarge'));
      return;
    }

    this.uploadingAvatar.set(true);
    this.adminApi.uploadMedia(file, 'AVATAR').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (asset) => {
        this.uploadingAvatar.set(false);
        this.form.avatarUrl = asset.url;
        // Auto-save avatar URL to backend so it persists across refreshes
        this.api.put<UserResponse>('/admin/users/me', { avatarUrl: asset.url })
          .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (updated) => {
            this.user.set(updated);
            this.authStore.login(updated);
            this.notification.success(this.i18n.t('admin.profile.avatarUploaded'));
          },
          error: () => {
            this.form.avatarUrl = this.user()?.avatarUrl ?? '';
            this.notification.error(this.i18n.t('admin.profile.saveError'));
          },
        });
      },
      error: () => {
        this.uploadingAvatar.set(false);
        this.notification.error(this.i18n.t('admin.profile.avatarUploadError'));
      },
    });
  }

  /** Saves account info + resume profile + HC together (used by FABs) */
  saveAll(): void {
    this.save();
    this.resumeProfile()?.save();
    this.hcRef()?.save();
  }

  save(): void {
    this.fieldErrors.set({});
    this.formSubmitted.set(true);

    // Validate required fields
    if (!this.form.name?.trim()) {
      this.fieldErrors.set({ name: 'Name is required' });
      return;
    }
    if (!this.form.email?.trim()) {
      this.fieldErrors.set({ email: 'Email is required' });
      return;
    }

    // Detect sensitive field changes
    const emailChanged = this.form.email.toLowerCase().trim() !== this.originalEmail.toLowerCase().trim();
    const usernameChanged = this.form.username.trim() !== this.originalUsername.trim();
    const sensitiveChanged = emailChanged || usernameChanged;

    // Validate password for sensitive changes
    if (sensitiveChanged && !this.sensitivePassword()) {
      this.notification.error(this.i18n.t('admin.profile.passwordRequiredForChange'));
      return;
    }

    // Validate password change
    if (this.form.newPassword) {
      if (!this.form.currentPassword) {
        this.notification.error(this.i18n.t('admin.profile.currentPasswordRequired'));
        return;
      }
      if (this.form.newPassword !== this.form.confirmPassword) {
        this.notification.error(this.i18n.t('admin.profile.passwordMismatch'));
        return;
      }
      if (this.form.newPassword.length < 12) {
        this.notification.error(this.i18n.t('admin.profile.passwordTooShort'));
        return;
      }
    }

    this.saving.set(true);

    const payload: Record<string, string | undefined> = {
      name: this.form.name || undefined,
      email: this.form.email || undefined,
      username: this.form.username || undefined,
      avatarUrl: this.form.avatarUrl || undefined,
      bio: this.form.bio || undefined,
    };

    // Include password for sensitive changes
    if (sensitiveChanged) {
      payload['currentPassword'] = this.sensitivePassword();
    }

    if (this.form.newPassword) {
      payload['currentPassword'] = this.form.currentPassword;
      payload['newPassword'] = this.form.newPassword;
    }

    this.api.putResponse<UserResponse>('/admin/users/me', payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.saving.set(false);
        const updated = response.body!;
        this.user.set(updated);
        this.originalEmail = updated.email || '';
        this.originalUsername = updated.username ?? '';
        this.form.email = updated.email || '';
        this.form.username = updated.username ?? '';
        this.form.currentPassword = '';
        this.form.newPassword = '';
        this.form.confirmPassword = '';
        this.sensitivePassword.set('');
        this.editingEmail.set(false);
        this.editingUsername.set(false);
        this.authStore.login(updated);

        if (response.status === 202) {
          this.notification.info(this.i18n.t('admin.profile.emailVerificationSent'));
        } else {
          this.notification.success(this.i18n.t('admin.profile.saveSuccess'));
        }
      },
      error: (err) => {
        this.saving.set(false);
        if (err.status === 409) {
          const msg = err.error?.message || '';
          if (msg.includes('username')) {
            this.notification.error(this.i18n.t('admin.profile.usernameInUse'));
          } else {
            this.notification.error(this.i18n.t('admin.profile.emailInUse'));
          }
        } else if (err.status === 429) {
          this.notification.error(this.i18n.t('admin.profile.rateLimitExceeded'));
        } else if (err.status === 400) {
          if (err.error?.validationErrors) {
            this.fieldErrors.set(err.error.validationErrors);
          }
          const msg = err.error?.message || '';
          if (msg.includes('password') && msg.includes('incorrect')) {
            this.notification.error(this.i18n.t('admin.profile.incorrectPassword'));
          } else if (msg.includes('password') && msg.includes('required')) {
            this.notification.error(this.i18n.t('admin.profile.currentPasswordRequired'));
          } else if (!err.error?.validationErrors) {
            this.notification.error(this.i18n.t('admin.profile.saveError'));
          }
        } else {
          this.notification.error(this.i18n.t('admin.profile.saveError'));
        }
      }
    });
  }
}
