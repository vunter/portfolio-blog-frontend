import { Component, inject, signal, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { MfaService } from '../../../../core/services/mfa.service';
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
  private authService = inject(AuthService);
  private notification = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  private fb = inject(FormBuilder);
  i18n = inject(I18nService);

  loading = signal(true);
  enabling = signal(false);
  disabling = signal(false);
  verifying = signal(false);

  mfaStatus = signal<MfaStatusResponse | null>(null);
  setupData = signal<MfaSetupResponse | null>(null);
  showSetup = signal(false);

  verifyForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  sessions = signal<SessionInfo[]>([]);
  sessionsLoading = signal(false);
  revokingId = signal<number | null>(null);
  backupCodes = signal<string[]>([]);
  generatingCodes = signal(false);

  ngOnInit(): void {
    this.loadStatus();
    this.loadSessions();
  }

  loadStatus(): void {
    this.mfaService.getStatus().subscribe({
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
    this.mfaService.setup('TOTP').subscribe({
      next: (data) => {
        this.setupData.set(data);
        this.showSetup.set(true);
        this.enabling.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.security.setupFailed'));
        this.enabling.set(false);
      },
    });
  }

  enableEmail(): void {
    this.enabling.set(true);
    this.mfaService.setup('EMAIL').subscribe({
      next: () => {
        this.notification.success(this.i18n.t('admin.security.emailOtpEnabled'));
        this.enabling.set(false);
        this.loadStatus();
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.security.setupFailed'));
        this.enabling.set(false);
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

    this.mfaService.verifySetup({ code, method: 'TOTP' }).subscribe({
      next: (result) => {
        this.verifying.set(false);
        if (result.verified) {
          this.notification.success(this.i18n.t('admin.security.totpVerified'));
          this.showSetup.set(false);
          this.setupData.set(null);
          this.verifyForm.reset();
          this.loadStatus();
        } else {
          this.notification.error(result.message || this.i18n.t('admin.security.invalidCode'));
        }
      },
      error: () => {
        this.verifying.set(false);
        this.notification.error(this.i18n.t('admin.security.invalidCode'));
      },
    });
  }

  async disableMfa(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('admin.security.disableTitle'),
      message: this.i18n.t('admin.security.disableMessage'),
      confirmText: this.i18n.t('admin.security.disableConfirm'),
      type: 'danger',
    });
    if (!confirmed) return;
    this.disabling.set(true);
    this.mfaService.disable().subscribe({
      next: () => {
        this.notification.success(this.i18n.t('admin.security.mfaDisabled'));
        this.disabling.set(false);
        this.showSetup.set(false);
        this.setupData.set(null);
        this.loadStatus();
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.security.disableFailed'));
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
    this.mfaService.generateBackupCodes().subscribe({
      next: (res) => {
        this.backupCodes.set(res.codes);
        this.generatingCodes.set(false);
        this.loadStatus();
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.security.backupCodesFailed'));
        this.generatingCodes.set(false);
      },
    });
  }

  dismissBackupCodes(): void {
    this.backupCodes.set([]);
  }

  loadSessions(): void {
    this.sessionsLoading.set(true);
    this.authService.getActiveSessions().subscribe({
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
    this.authService.revokeSession(sessionId).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('admin.security.sessionRevoked'));
        this.revokingId.set(null);
        this.loadSessions();
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.security.sessionRevokeFailed'));
        this.revokingId.set(null);
      },
    });
  }

  async revokeAllOther(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('admin.security.revokeAllTitle'),
      message: this.i18n.t('admin.security.revokeAllMessage'),
      confirmText: this.i18n.t('admin.security.revokeAllConfirm'),
      type: 'danger',
    });
    if (!confirmed) return;
    this.authService.revokeAllOtherSessions().subscribe({
      next: () => {
        this.notification.success(this.i18n.t('admin.security.allSessionsRevoked'));
        this.loadSessions();
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.security.sessionRevokeFailed'));
      },
    });
  }
}
