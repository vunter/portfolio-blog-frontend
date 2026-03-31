import { Component, inject, signal, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminApiService, TranslationItem, TranslationPage } from '../../services/admin-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-translation-settings',
  standalone: true,
  templateUrl: './translation-settings.component.html',
  styleUrl: './translation-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TranslationSettingsComponent {
  private destroyRef = inject(DestroyRef);
  private adminApi = inject(AdminApiService);
  private notification = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  i18n = inject(I18nService);

  transLocale = signal('en');
  transNamespace = signal<'frontend' | 'backend'>('frontend');
  transSearch = signal('');
  transPage = signal(0);
  transData = signal<TranslationPage | null>(null);
  transLoading = signal(false);
  transEditId = signal<number | null>(null);
  transEditValue = signal('');
  transSaving = signal(false);
  showAddTrans = signal(false);
  newTransKey = signal('');
  newTransValue = signal('');
  newTransVisibility = signal('public');
  transInvalidating = signal(false);

  loadTranslations(): void {
    this.transLoading.set(true);
    const search = this.transSearch().trim() || undefined;
    this.adminApi.getTranslations(this.transLocale(), this.transNamespace(), search, this.transPage())
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (data) => {
          this.transData.set(data);
          this.transLoading.set(false);
        },
        error: () => {
          this.notification.error(this.i18n.t('admin.settings.translationLoadError'));
          this.transLoading.set(false);
        },
      });
  }

  setTransLocale(locale: string): void {
    this.transLocale.set(locale);
    this.transPage.set(0);
    this.loadTranslations();
  }

  setTransNamespace(ns: 'frontend' | 'backend'): void {
    this.transNamespace.set(ns);
    this.transPage.set(0);
    this.loadTranslations();
  }

  searchTranslations(event: Event): void {
    this.transSearch.set((event.target as HTMLInputElement).value);
    this.transPage.set(0);
    this.loadTranslations();
  }

  transPageTo(page: number): void {
    this.transPage.set(page);
    this.loadTranslations();
  }

  startEditTranslation(item: TranslationItem): void {
    this.transEditId.set(item.id);
    this.transEditValue.set(item.value);
  }

  cancelEditTranslation(): void {
    this.transEditId.set(null);
    this.transEditValue.set('');
  }

  saveTranslation(): void {
    const id = this.transEditId();
    if (!id) return;
    this.transSaving.set(true);
    this.adminApi.updateTranslation(id, this.transEditValue())
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.notification.success(this.i18n.t('admin.settings.translationUpdated'));
          this.transSaving.set(false);
          this.transEditId.set(null);
          this.loadTranslations();
        },
        error: () => {
          this.notification.error(this.i18n.t('admin.settings.translationUpdateError'));
          this.transSaving.set(false);
        },
      });
  }

  addTranslation(): void {
    const key = this.newTransKey().trim();
    const value = this.newTransValue().trim();
    if (!key || !value) return;
    this.adminApi.createTranslation({
      translationKey: key,
      locale: this.transLocale(),
      value,
      namespace: this.transNamespace(),
      visibility: this.newTransVisibility(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('admin.settings.translationCreated'));
        this.newTransKey.set('');
        this.newTransValue.set('');
        this.showAddTrans.set(false);
        this.loadTranslations();
      },
      error: () => this.notification.error(this.i18n.t('admin.settings.translationCreateError')),
    });
  }

  async deleteTrans(item: TranslationItem): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('admin.settings.deleteTranslationTitle'),
      message: this.i18n.t('admin.settings.deleteTranslationMessage'),
      confirmText: this.i18n.t('common.delete'),
      cancelText: this.i18n.t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;
    this.adminApi.deleteTranslation(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.notification.success(this.i18n.t('admin.settings.translationDeleted'));
          this.loadTranslations();
        },
        error: () => this.notification.error(this.i18n.t('admin.settings.translationDeleteError')),
      });
  }

  invalidateI18nCache(): void {
    this.transInvalidating.set(true);
    this.adminApi.invalidateI18nCache()
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.notification.success(this.i18n.t('admin.settings.cacheInvalidated'));
          this.transInvalidating.set(false);
        },
        error: () => {
          this.notification.error(this.i18n.t('admin.settings.cacheInvalidateError'));
          this.transInvalidating.set(false);
        },
      });
  }
}
