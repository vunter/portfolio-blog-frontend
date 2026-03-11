import { Component, inject, signal, ChangeDetectionStrategy, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MfaService } from '../../../../core/services/mfa.service';
import { ApiService } from '../../../../core/services/api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MfaSetupResponse, MfaStatusResponse } from '../../../../models';
import { AuthService, SessionInfo } from '../../../../core/auth/auth.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-security-settings',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './security-settings.component.html',
  styleUrl: './security-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecuritySettingsComponent implements OnInit {
  private mfaService = inject(MfaService);
  private api = inject(ApiService);
  private authService = inject(AuthService);
  private notification = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  i18n = inject(I18nService);

  loading = signal(true);
  enabling = signal(false);
  disabling = signal(false);
  verifying = signal(false);
  emailSetupPending = signal(false);
  removingMethod = signal<string | null>(null);
  removingMethodLoading = signal(false);

  mfaStatus = signal<MfaStatusResponse | null>(null);
  setupData = signal<MfaSetupResponse | null>(null);
  showSetup = signal(false);

  verifyForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  emailVerifyForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  removeMethodForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  sessions = signal<SessionInfo[]>([]);
  sessionsLoading = signal(false);
  revokingId = signal<number | null>(null);
  backupCodes = signal<string[]>([]);
  generatingCodes = signal(false);
  socialAccounts = signal<any[]>([]);
  socialLoading = signal(false);
  unlinking = signal<string | null>(null);
  deletingLinkedin = signal(false);

  ngOnInit(): void {
    this.loadStatus();
    this.loadSessions();
    this.loadSocialAccounts();
  }

  loadStatus(): void {
    this.mfaService.getStatus().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (status) => {
        this.mfaStatus.set(status);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  setupTotp(): void {
    this.enabling.set(true);
    this.mfaService.setup('TOTP').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.setupData.set(data);
        this.showSetup.set(true);
        this.enabling.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('account.security.setupFailed'));
        this.enabling.set(false);
      },
    });
  }

  enableEmail(): void {
    this.enabling.set(true);
    this.mfaService.setup('EMAIL').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('account.security.emailCodeSent'));
        this.enabling.set(false);
        this.emailSetupPending.set(true);
      },
      error: () => {
        this.notification.error(this.i18n.t('account.security.setupFailed'));
        this.enabling.set(false);
      },
    });
  }

  verifyEmailSetup(): void {
    if (this.emailVerifyForm.invalid) {
      this.emailVerifyForm.markAllAsTouched();
      return;
    }

    this.verifying.set(true);
    const code = this.emailVerifyForm.getRawValue().code!;

    this.mfaService.verifySetup({ code, method: 'EMAIL' }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.verifying.set(false);
        if (result.verified) {
          this.notification.success(this.i18n.t('account.security.emailOtpEnabled'));
          this.emailSetupPending.set(false);
          this.emailVerifyForm.reset();
          if (result.backupCodes?.length) {
            this.backupCodes.set(result.backupCodes);
          }
          this.loadStatus();
        } else {
          this.notification.error(result.message || this.i18n.t('account.security.invalidCode'));
        }
      },
      error: () => {
        this.verifying.set(false);
        this.notification.error(this.i18n.t('account.security.invalidCode'));
      },
    });
  }

  cancelEmailSetup(): void {
    this.emailSetupPending.set(false);
    this.emailVerifyForm.reset();
  }

  startRemoveMethod(method: string): void {
    this.removingMethod.set(method);
    this.removeMethodForm.reset();
    // Auto-send email OTP if EMAIL is active
    if (this.hasMethod('EMAIL')) {
      this.mfaService.sendAuthenticatedOtp().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => this.notification.success(this.i18n.t('account.security.otpSentForVerification')),
        error: () => {},
      });
    }
  }

  cancelRemoveMethod(): void {
    this.removingMethod.set(null);
    this.removeMethodForm.reset();
  }

  confirmRemoveMethod(): void {
    if (this.removeMethodForm.invalid) {
      this.removeMethodForm.markAllAsTouched();
      return;
    }

    const method = this.removingMethod();
    if (!method) return;

    this.removingMethodLoading.set(true);
    const code = this.removeMethodForm.getRawValue().code!;

    this.mfaService.disableMethod(method, code).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.removingMethodLoading.set(false);
        if (res.success) {
          this.notification.success(this.i18n.t('account.security.methodDisabled'));
          this.removingMethod.set(null);
          this.removeMethodForm.reset();
          this.loadStatus();
        } else {
          this.notification.error(res.message || this.i18n.t('account.security.invalidCode'));
        }
      },
      error: () => {
        this.removingMethodLoading.set(false);
        this.notification.error(this.i18n.t('account.security.invalidCode'));
      },
    });
  }

  verifySetup(): void {
    if (this.verifyForm.invalid) {
      this.verifyForm.markAllAsTouched();
      return;
    }

    this.verifying.set(true);
    const code = this.verifyForm.getRawValue().code!;

    this.mfaService.verifySetup({ code, method: 'TOTP' }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.verifying.set(false);
        if (result.verified) {
          this.notification.success(this.i18n.t('account.security.totpVerified'));
          this.showSetup.set(false);
          this.setupData.set(null);
          this.verifyForm.reset();
          if (result.backupCodes?.length) {
            this.backupCodes.set(result.backupCodes);
          }
          this.loadStatus();
        } else {
          this.notification.error(result.message || this.i18n.t('account.security.invalidCode'));
        }
      },
      error: () => {
        this.verifying.set(false);
        this.notification.error(this.i18n.t('account.security.invalidCode'));
      },
    });
  }

  async disableMfa(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('account.security.disableTitle'),
      message: this.i18n.t('account.security.disableMessage'),
      confirmText: this.i18n.t('account.security.disableConfirm'),
      type: 'danger',
    });
    if (!confirmed) return;
    this.disabling.set(true);
    this.mfaService.disable().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('account.security.mfaDisabled'));
        this.disabling.set(false);
        this.showSetup.set(false);
        this.setupData.set(null);
        this.loadStatus();
      },
      error: () => {
        this.notification.error(this.i18n.t('account.security.disableFailed'));
        this.disabling.set(false);
      },
    });
  }

  cancelSetup(): void {
    this.showSetup.set(false);
    this.setupData.set(null);
    this.verifyForm.reset();
  }

  generateBackupCodes(): void {
    this.generatingCodes.set(true);
    this.mfaService.generateBackupCodes().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.backupCodes.set(res.codes);
        this.generatingCodes.set(false);
        this.loadStatus();
      },
      error: () => {
        this.notification.error(this.i18n.t('account.security.backupCodesFailed'));
        this.generatingCodes.set(false);
      },
    });
  }

  dismissBackupCodes(): void {
    this.backupCodes.set([]);
  }

  hasMethod(method: string): boolean {
    return this.mfaStatus()?.methods?.includes(method) ?? false;
  }

  hasAvailableMethods(): boolean {
    const methods = this.mfaStatus()?.methods ?? [];
    return methods.length < 2;
  }

  copyBackupCodes(): void {
    const text = this.backupCodes().join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.notification.success(this.i18n.t('account.security.codesCopied'));
    });
  }

  downloadBackupCodes(): void {
    const text = 'Catananti Portfolio — MFA Backup Codes\n'
      + '========================================\n\n'
      + this.backupCodes().join('\n')
      + '\n\nGenerated: ' + new Date().toISOString()
      + '\nKeep these codes in a safe place.';
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  loadSessions(): void {
    this.sessionsLoading.set(true);
    this.authService.getActiveSessions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (sessions) => {
        this.sessions.set(sessions);
        this.sessionsLoading.set(false);
      },
      error: () => {
        this.sessionsLoading.set(false);
      },
    });
  }

  revokeSession(sessionId: number): void {
    this.revokingId.set(sessionId);
    this.authService.revokeSession(sessionId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('account.security.sessionRevoked'));
        this.revokingId.set(null);
        this.loadSessions();
      },
      error: () => {
        this.notification.error(this.i18n.t('account.security.sessionRevokeFailed'));
        this.revokingId.set(null);
      },
    });
  }

  async revokeAllOther(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('account.security.revokeAllTitle'),
      message: this.i18n.t('account.security.revokeAllMessage'),
      confirmText: this.i18n.t('account.security.revokeAllConfirm'),
      type: 'danger',
    });
    if (!confirmed) return;
    this.authService.revokeAllOtherSessions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('account.security.allSessionsRevoked'));
        this.loadSessions();
      },
      error: () => {
        this.notification.error(this.i18n.t('account.security.sessionRevokeFailed'));
      },
    });
  }

  loadSocialAccounts(): void {
    this.socialLoading.set(true);
    this.api.get<any[]>('/admin/auth/oauth2/accounts').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (accounts) => {
        this.socialAccounts.set(accounts);
        this.socialLoading.set(false);
      },
      error: () => {
        this.socialLoading.set(false);
      },
    });
  }

  hasProvider(provider: string): boolean {
    return this.socialAccounts().some(a => a.provider === provider);
  }

  linkSocialAccount(provider: string): void {
    const allowedProviders = ['GOOGLE', 'GITHUB', 'LINKEDIN'];
    if (!allowedProviders.includes(provider.toUpperCase())) {
      return;
    }
    window.location.href = `/api/v1/admin/auth/oauth2/authorize/${provider}?link=true`;
  }

  unlinkSocialAccount(provider: string): void {
    this.unlinking.set(provider);
    this.api.delete(`/admin/auth/oauth2/accounts/${provider}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('account.security.accountUnlinked'));
        this.unlinking.set(null);
        this.loadSocialAccounts();
      },
      error: () => {
        this.notification.error(this.i18n.t('account.security.unlinkFailed'));
        this.unlinking.set(null);
      },
    });
  }

  deleteLinkedInData(): void {
    this.confirmDialog.confirm({
      title: this.i18n.t('account.security.deleteLinkedinData'),
      message: this.i18n.t('account.security.deleteLinkedinConfirm'),
      type: 'danger',
    }).then((confirmed) => {
      if (!confirmed) return;
      this.deletingLinkedin.set(true);
      this.api.delete('/resume/profile/linkedin-data').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.notification.success(this.i18n.t('account.security.linkedinDataDeleted'));
          this.deletingLinkedin.set(false);
        },
        error: () => {
          this.notification.error(this.i18n.t('account.security.linkedinDeleteError'));
          this.deletingLinkedin.set(false);
        },
      });
    });
  }
}
