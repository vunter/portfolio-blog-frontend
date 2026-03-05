import { Component, inject, signal, OnInit, ChangeDetectionStrategy, viewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { ApiService } from '../../../core/services/api.service';
import { AdminApiService } from '../../admin/services/admin-api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { I18nService } from '../../../core/services/i18n.service';
import { UserResponse, RoleUpgradeRequestResponse } from '../../../models';

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
  selector: 'app-viewer-profile',
  imports: [FormsModule, DatePipe],
  templateUrl: './viewer-profile.component.html',
  styleUrl: './viewer-profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewerProfileComponent implements OnInit {
  private authService = inject(AuthService);
  private authStore = inject(AuthStore);
  private api = inject(ApiService);
  private adminApi = inject(AdminApiService);
  private notification = inject(NotificationService);
  i18n = inject(I18nService);

  avatarInput = viewChild<ElementRef<HTMLInputElement>>('avatarFileInput');

  loading = signal(true);
  saving = signal(false);
  uploadingAvatar = signal(false);
  user = signal<UserResponse | null>(null);
  fieldErrors = signal<Record<string, string>>({});
  formSubmitted = signal(false);

  // Role upgrade request
  roleRequest = signal<RoleUpgradeRequestResponse | null>(null);
  roleRequestReason = '';
  submittingRoleRequest = signal(false);

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

  /** Whether the user can request a role upgrade (only VIEWER without pending request) */
  get canRequestUpgrade(): boolean {
    const user = this.user();
    const req = this.roleRequest();
    if (!user) return false;
    if (user.role === 'ADMIN' || user.role === 'DEV') return false;
    if (req && req.status === 'PENDING') return false;
    return true;
  }

  ngOnInit(): void {
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.user.set(user);
        this.form.name = user.name || '';
        this.form.email = user.email || '';
        this.form.username = user.username ?? '';
        this.form.avatarUrl = user.avatarUrl ?? '';
        this.form.bio = user.bio ?? '';
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notification.error(this.i18n.t('account.profile.loadError'));
      },
    });

    // Load existing role upgrade request
    this.api.get<RoleUpgradeRequestResponse>('/admin/users/me/role-request').subscribe({
      next: (req) => this.roleRequest.set(req),
      error: () => {}, // 204 No Content or error — no pending request
    });
  }

  triggerAvatarUpload(): void {
    this.avatarInput()?.nativeElement.click();
  }

  onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    if (!file.type.startsWith('image/')) {
      this.notification.error(this.i18n.t('account.profile.avatarInvalidType'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.notification.error(this.i18n.t('account.profile.avatarTooLarge'));
      return;
    }

    this.uploadingAvatar.set(true);
    this.adminApi.uploadMedia(file, 'AVATAR').subscribe({
      next: (asset) => {
        this.uploadingAvatar.set(false);
        this.form.avatarUrl = asset.url;
        this.notification.success(this.i18n.t('account.profile.avatarUploaded'));
      },
      error: () => {
        this.uploadingAvatar.set(false);
        this.notification.error(this.i18n.t('account.profile.avatarUploadError'));
      },
    });
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

    if (this.form.newPassword) {
      if (!this.form.currentPassword) {
        this.notification.error(this.i18n.t('account.profile.currentPasswordRequired'));
        return;
      }
      if (this.form.newPassword !== this.form.confirmPassword) {
        this.notification.error(this.i18n.t('account.profile.passwordMismatch'));
        return;
      }
      if (this.form.newPassword.length < 12) {
        this.notification.error(this.i18n.t('account.profile.passwordTooShort'));
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

    if (this.form.newPassword) {
      payload['currentPassword'] = this.form.currentPassword;
      payload['newPassword'] = this.form.newPassword;
    }

    this.api.put<UserResponse>('/admin/users/me', payload).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.user.set(updated);
        this.form.currentPassword = '';
        this.form.newPassword = '';
        this.form.confirmPassword = '';
        this.authStore.login(updated);
        this.notification.success(this.i18n.t('account.profile.saveSuccess'));
      },
      error: (err) => {
        this.saving.set(false);
        if (err.status === 409) {
          this.notification.error(this.i18n.t('account.profile.emailInUse'));
        } else if (err.status === 400) {
          if (err.error?.validationErrors) {
            this.fieldErrors.set(err.error.validationErrors);
          }
          const msg = err.error?.message || '';
          if (msg.includes('password') && msg.includes('incorrect')) {
            this.notification.error(this.i18n.t('account.profile.incorrectPassword'));
          } else if (msg.includes('password') && msg.includes('required')) {
            this.notification.error(this.i18n.t('account.profile.currentPasswordRequired'));
          } else if (!err.error?.validationErrors) {
            this.notification.error(this.i18n.t('account.profile.saveError'));
          }
        } else {
          this.notification.error(this.i18n.t('account.profile.saveError'));
        }
      },
    });
  }

  submitRoleRequest(): void {
    this.submittingRoleRequest.set(true);
    const body = {
      requestedRole: 'DEV',
      reason: this.roleRequestReason || null,
    };

    this.api.post<RoleUpgradeRequestResponse>('/admin/users/me/role-request', body).subscribe({
      next: (resp) => {
        this.submittingRoleRequest.set(false);
        this.roleRequest.set(resp);
        this.roleRequestReason = '';
        this.notification.success(this.i18n.t('profile.roleRequest.submitted'));
      },
      error: (err) => {
        this.submittingRoleRequest.set(false);
        if (err.status === 409) {
          this.notification.error(this.i18n.t('profile.roleRequest.alreadyPending'));
        } else {
          this.notification.error(this.i18n.t('profile.roleRequest.error'));
        }
      },
    });
  }
}
