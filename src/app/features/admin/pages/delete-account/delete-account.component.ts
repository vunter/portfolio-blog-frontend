import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AccountPrivacyService,
  AccountDeletionMode,
  AccountDeletionPreview,
} from '../../../../core/services/account-privacy.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { AuthStore } from '../../../../core/auth/auth.store';

@Component({
  selector: 'app-delete-account',
  imports: [ReactiveFormsModule],
  templateUrl: './delete-account.component.html',
  styleUrl: './delete-account.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteAccountComponent implements OnInit {
  private readonly accountPrivacy = inject(AccountPrivacyService);
  private readonly notification = inject(NotificationService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly i18n = inject(I18nService);

  readonly previewLoading = signal(true);
  readonly preview = signal<AccountDeletionPreview | null>(null);
  readonly submitting = signal(false);
  /** i18n key of the submit error shown in the form (wrong password etc.). */
  readonly submitErrorKey = signal<string | null>(null);
  readonly mode = signal<AccountDeletionMode>('DEACTIVATE');

  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required]],
    confirmWord: [''],
    cancelNewsletter: [false],
  });

  /** Localized word the user must type to confirm permanent erasure. */
  readonly confirmWord = computed(() => {
    this.i18n.language();
    return this.i18n.t('account.delete.confirmWord');
  });

  ngOnInit(): void {
    this.accountPrivacy
      .getDeletionPreview()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (preview) => {
          this.preview.set(preview);
          this.previewLoading.set(false);
        },
        error: () => {
          // The form still works without the preview; it only loses the summary.
          this.previewLoading.set(false);
        },
      });
  }

  setMode(mode: AccountDeletionMode): void {
    this.mode.set(mode);
    this.submitErrorKey.set(null);
    if (mode === 'DEACTIVATE') {
      this.form.controls.confirmWord.setValue('');
    }
  }

  confirmWordValid(): boolean {
    return (
      this.form.controls.confirmWord.value.trim().toUpperCase() ===
      this.confirmWord().toUpperCase()
    );
  }

  submit(): void {
    this.submitErrorKey.set(null);

    if (this.form.controls.password.invalid) {
      this.form.controls.password.markAsTouched();
      return;
    }
    if (this.mode() === 'ERASE' && !this.confirmWordValid()) {
      this.submitErrorKey.set('account.delete.confirmWordError');
      return;
    }
    if (this.submitting()) return;

    this.submitting.set(true);
    const { password, cancelNewsletter } = this.form.getRawValue();

    this.accountPrivacy
      .deleteAccount({
        password,
        mode: this.mode(),
        cancelNewsletter: (this.preview()?.newsletterLinked ?? false) && cancelNewsletter,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.notification.success(
            this.i18n.t(
              this.mode() === 'ERASE' ? 'account.delete.erased' : 'account.delete.deactivated'
            )
          );
          this.authStore.logout();
          this.router.navigate(['/']);
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403)) {
            this.submitErrorKey.set('account.delete.wrongPassword');
          } else {
            this.submitErrorKey.set('account.delete.failed');
          }
        },
      });
  }
}
