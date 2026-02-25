import { Component, inject, signal, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { MfaService } from '../../../../core/services/mfa.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MfaSetupResponse, MfaStatusResponse } from '../../../../models';

@Component({
  selector: 'app-security-settings',
  imports: [ReactiveFormsModule],
  templateUrl: './security-settings.component.html',
  styleUrl: './security-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecuritySettingsComponent implements OnInit {
  private mfaService = inject(MfaService);
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

  ngOnInit(): void {
    this.loadStatus();
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
}
