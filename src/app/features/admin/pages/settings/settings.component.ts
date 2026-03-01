import { Component, inject, signal, ChangeDetectionStrategy, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AdminApiService } from '../../services/admin-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { DownloadService } from '../../../../core/services/download.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private adminApi = inject(AdminApiService);
  private notification = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  private downloadService = inject(DownloadService);
  private sanitizer = inject(DomSanitizer);
  private fb = inject(FormBuilder);
  i18n = inject(I18nService);

  saving = signal(false);
  clearing = signal(false);
  loading = signal(true);
  exporting = signal(false);
  exportingMd = signal(false);
  importing = signal(false);
  cacheStats = signal({ entries: 0, size: '0 MB' });
  emailTemplates = signal<{ id: string; name: string; description: string }[]>([]);
  emailTemplatesLoading = signal(false);
  previewingTemplate = signal<{ id: string; name: string; description: string } | null>(null);
  previewHtml = signal<SafeHtml>('');

  settingsForm = this.fb.group({
    siteName: ['My Blog'],
    siteDescription: ['A blog about software development'],
    commentsEnabled: [true],
    commentModeration: [true],
    githubUrl: [''],
    linkedinUrl: [''],
    twitterUrl: [''],
  });

  ngOnInit(): void {
    this.loadSettings();
    this.loadCacheStats();
    this.loadEmailTemplates();
  }

  loadSettings(): void {
    this.adminApi.getSettings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (settings) => {
        this.settingsForm.patchValue(settings as Record<string, unknown>);
        this.loading.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.error.loadSettings'));
        this.loading.set(false);
      },
    });
  }

  loadCacheStats(): void {
    this.adminApi.getCacheStats().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (stats) => {
        const totalEntries = (stats.articlesCount ?? 0) + (stats.tagsCount ?? 0) + (stats.commentsCount ?? 0) + (stats.searchCount ?? 0) + (stats.feedCount ?? 0);
        this.cacheStats.set({
          entries: totalEntries,
          size: totalEntries + ' keys',
        });
      },
      error: () => {
        // FEAT-07: Show zeros instead of fabricated data on error
        this.cacheStats.set({ entries: 0, size: '0 keys' });
      },
    });
  }

  saveSettings(): void {
    this.saving.set(true);
    this.adminApi.updateSettings(this.settingsForm.getRawValue() as Record<string, unknown>).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('admin.settings.saveSuccess'));
        this.saving.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.settings.saveError'));
        this.saving.set(false);
      },
    });
  }

  async clearCache(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('admin.settings.clearCacheTitle'),
      message: this.i18n.t('admin.settings.confirmClearCache'),
      confirmText: this.i18n.t('admin.settings.clearCache'),
      cancelText: this.i18n.t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;

    this.clearing.set(true);
    this.adminApi.clearCache().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('admin.settings.clearCacheSuccess'));
        this.clearing.set(false);
        this.loadCacheStats();
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.settings.clearCacheError'));
        this.clearing.set(false);
      },
    });
  }

  // INC-03: Export/Import methods

  exportBlogJson(): void {
    this.exporting.set(true);
    this.adminApi.exportBlogJson().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        this.downloadService.downloadBlob(blob, `blog-export-${new Date().toISOString().slice(0, 10)}.json`);
        this.notification.success(this.i18n.t('admin.settings.exportSuccess'));
        this.exporting.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.settings.exportError'));
        this.exporting.set(false);
      },
    });
  }

  exportMarkdown(): void {
    this.exportingMd.set(true);
    this.adminApi.exportArticlesMarkdown().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        this.downloadService.downloadBlob(blob, `articles-markdown-${new Date().toISOString().slice(0, 10)}.zip`);
        this.notification.success(this.i18n.t('admin.settings.exportSuccess'));
        this.exportingMd.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.settings.exportError'));
        this.exportingMd.set(false);
      },
    });
  }

  async onImportFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('admin.settings.importConfirmTitle'),
      message: this.i18n.t('admin.settings.importConfirmMessage'),
      confirmText: this.i18n.t('admin.settings.import'),
      cancelText: this.i18n.t('common.cancel'),
      type: 'danger',
    });

    if (!confirmed) {
      input.value = '';
      return;
    }

    this.importing.set(true);
    this.adminApi.importBlog(file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.notification.success(this.i18n.t('admin.settings.importSuccess'));
        this.importing.set(false);
        input.value = '';
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.settings.importError'));
        this.importing.set(false);
        input.value = '';
      },
    });
  }

  // Email Template Preview

  loadEmailTemplates(): void {
    this.emailTemplatesLoading.set(true);
    this.adminApi.getEmailTemplates().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (templates) => {
        this.emailTemplates.set(templates);
        this.emailTemplatesLoading.set(false);
      },
      error: () => {
        this.emailTemplatesLoading.set(false);
      },
    });
  }

  previewTemplate(template: { id: string; name: string; description: string }): void {
    this.previewingTemplate.set(template);
    this.adminApi.getEmailTemplatePreview(template.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (html) => {
        this.previewHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.settings.emailTemplatePreviewError'));
        this.previewingTemplate.set(null);
      },
    });
  }

  closePreview(): void {
    this.previewingTemplate.set(null);
    this.previewHtml.set('');
  }

}
