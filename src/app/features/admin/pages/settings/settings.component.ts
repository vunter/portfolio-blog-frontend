import { Component, inject, signal, ChangeDetectionStrategy, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { AdminApiService, CacheInvalidationResult } from '../../services/admin-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { DownloadService } from '../../../../core/services/download.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { ApiService } from '../../../../core/services/api.service';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { EmailTemplatesSettingsComponent } from './email-templates-settings.component';
import { TranslationSettingsComponent } from './translation-settings.component';

interface HealthStatus {
  status: string;
  database?: { status: string; type?: string };
  redis?: { status: string };
  blog?: {
    totalArticles?: number;
    publishedArticles?: number;
    totalComments?: number;
    activeSubscribers?: number;
  };
}

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, FormsModule, SkeletonComponent, EmailTemplatesSettingsComponent, TranslationSettingsComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private adminApi = inject(AdminApiService);
  private apiService = inject(ApiService);
  private notification = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  private downloadService = inject(DownloadService);
  private fb = inject(FormBuilder);
  i18n = inject(I18nService);

  saving = signal(false);
  clearing = signal(false);
  loading = signal(true);
  exporting = signal(false);
  exportingMd = signal(false);
  importing = signal(false);
  cacheStats = signal({ entries: 0, size: '0 MB' });

  // AUD19: granular cache invalidation state
  /** Actions currently in flight — keyed so every button has its own busy state. */
  private granularBusyActions = signal<ReadonlySet<string>>(new Set());
  /** Result of the most recent granular invalidation, surfaced inline. */
  lastGranularResult = signal<{ action: string; entriesRemoved: number } | null>(null);
  articleSlug = '';
  tagSlug = '';
  commentsArticleId = '';

  // AUD19C-04 (A2): overwrite existing articles/tags on import (backend
  // `overwrite` query param; default false = skip existing).
  importOverwrite = false;

  // Health status
  healthLoading = signal(false);
  healthData = signal<HealthStatus | null>(null);

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
  }

  loadSettings(): void {
    this.adminApi.getSettings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (settings) => {
        this.settingsForm.patchValue(settings as Record<string, unknown>);
        this.loading.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('dev.error.loadSettings'));
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
        this.cacheStats.set({ entries: 0, size: '0 keys' });
      },
    });
  }

  checkHealth(): void {
    this.healthLoading.set(true);
    this.apiService.get<HealthStatus>('/status').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.healthData.set(data);
        this.healthLoading.set(false);
      },
      error: () => {
        this.healthData.set({ status: 'ERROR' });
        this.healthLoading.set(false);
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

  // ==================== AUD19: Granular cache invalidation ====================

  isGranularBusy(action: string): boolean {
    return this.granularBusyActions().has(action);
  }

  private setGranularBusy(action: string, busy: boolean): void {
    this.granularBusyActions.update((current) => {
      const next = new Set(current);
      if (busy) {
        next.add(action);
      } else {
        next.delete(action);
      }
      return next;
    });
  }

  private runGranularInvalidation(action: string, call$: Observable<CacheInvalidationResult>): void {
    if (this.isGranularBusy(action)) return;
    this.setGranularBusy(action, true);
    call$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.setGranularBusy(action, false);
        this.lastGranularResult.set({ action, entriesRemoved: result.entriesRemoved ?? 0 });
        this.notification.success(
          this.i18n.t('admin.settings.granularCache.success', { count: result.entriesRemoved ?? 0 })
        );
        this.loadCacheStats();
      },
      error: () => {
        this.setGranularBusy(action, false);
        this.notification.error(this.i18n.t('admin.settings.granularCache.error'));
      },
    });
  }

  clearArticlesCache(): void {
    this.runGranularInvalidation('articles', this.adminApi.clearArticlesCache());
  }

  clearTagsCache(): void {
    this.runGranularInvalidation('tags', this.adminApi.clearTagsCache());
  }

  clearAllCommentsCache(): void {
    this.runGranularInvalidation('comments', this.adminApi.clearCommentsCache());
  }

  clearSearchCache(): void {
    this.runGranularInvalidation('search', this.adminApi.clearSearchCache());
  }

  clearFeedsCache(): void {
    this.runGranularInvalidation('feeds', this.adminApi.clearFeedsCache());
  }

  clearArticleBySlug(): void {
    const slug = this.articleSlug.trim();
    if (!slug) {
      this.notification.error(this.i18n.t('admin.settings.granularCache.valueRequired'));
      return;
    }
    this.runGranularInvalidation('article-slug', this.adminApi.clearArticleCache(slug));
  }

  clearTagBySlug(): void {
    const slug = this.tagSlug.trim();
    if (!slug) {
      this.notification.error(this.i18n.t('admin.settings.granularCache.valueRequired'));
      return;
    }
    this.runGranularInvalidation('tag-slug', this.adminApi.clearTagCache(slug));
  }

  clearCommentsByArticleId(): void {
    const articleId = this.commentsArticleId.trim();
    if (!articleId) {
      this.notification.error(this.i18n.t('admin.settings.granularCache.valueRequired'));
      return;
    }
    this.runGranularInvalidation('comments-id', this.adminApi.clearCommentsCache(articleId));
  }

  // Export/Import methods

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
        // AUD19C-04: the endpoint returns a JSON document (slug → markdown map),
        // not a zip archive — name the download accordingly.
        this.downloadService.downloadBlob(blob, `articles-markdown-${new Date().toISOString().slice(0, 10)}.json`);
        this.notification.success(this.i18n.t('admin.settings.exportSuccess'));
        this.exportingMd.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.settings.exportError'));
        this.exportingMd.set(false);
      },
    });
  }

  /**
   * Q7.9: Validate imported JSON structure and sanitize HTML content
   * to prevent XSS and malformed data from reaching the backend.
   */
  private validateImportData(data: unknown): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { valid: false, error: 'Import file must contain a JSON object' };
    }

    const obj = data as Record<string, unknown>;

    // Validate expected top-level structure
    // AUD19C-04 (A2): 'exportedBy' and 'stats' are part of the export shape —
    // a freshly exported file must validate without manual editing.
    const allowedKeys = new Set([
      'articles', 'tags', 'comments', 'settings', 'subscribers',
      'users', 'metadata', 'version', 'exportedAt', 'exportedBy', 'stats',
    ]);
    const unknownKeys = Object.keys(obj).filter(k => !allowedKeys.has(k));
    if (unknownKeys.length > 0) {
      return { valid: false, error: `Unknown keys in import: ${unknownKeys.join(', ')}` };
    }

    // Validate articles array structure if present
    if (obj['articles'] !== undefined) {
      if (!Array.isArray(obj['articles'])) {
        return { valid: false, error: '"articles" must be an array' };
      }
      for (const article of obj['articles'] as unknown[]) {
        if (!article || typeof article !== 'object') {
          return { valid: false, error: 'Each article must be an object' };
        }
        const a = article as Record<string, unknown>;
        if (typeof a['title'] !== 'string' || !a['title']) {
          return { valid: false, error: 'Each article must have a non-empty title' };
        }
      }
    }

    return { valid: true };
  }

  /** Q7.9: Strip dangerous HTML patterns from string values */
  private sanitizeImportStrings(data: unknown): unknown {
    if (typeof data === 'string') {
      // Remove script tags, event handlers, and javascript: URIs
      return data
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/javascript\s*:/gi, '');
    }
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeImportStrings(item));
    }
    if (data && typeof data === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        result[key] = this.sanitizeImportStrings(value);
      }
      return result;
    }
    return data;
  }

  async onImportFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Q7.9: Size limit (10MB)
    if (file.size > 10 * 1024 * 1024) {
      this.notification.error(this.i18n.t('admin.settings.importFileTooLarge'));
      input.value = '';
      return;
    }

    // Q7.9: Pre-parse and validate JSON structure before confirming
    let parsedData: unknown;
    try {
      const text = await file.text();
      parsedData = JSON.parse(text);
    } catch {
      this.notification.error(this.i18n.t('admin.settings.importInvalidJson'));
      input.value = '';
      return;
    }

    const validation = this.validateImportData(parsedData);
    if (!validation.valid) {
      this.notification.error(validation.error || this.i18n.t('admin.settings.importInvalidStructure'));
      input.value = '';
      return;
    }

    // Q7.9: Sanitize string content to prevent XSS
    const sanitizedData = this.sanitizeImportStrings(parsedData);

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
    // AUD19C-04 (A2): the backend takes @RequestBody String (JSON), not a
    // multipart file — send the sanitized object directly (HttpClient
    // serializes it exactly once) plus the overwrite flag.
    this.adminApi.importBlog(sanitizedData, this.importOverwrite).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.notification.success(
          result && typeof result.articlesImported === 'number'
            ? this.i18n.t('admin.settings.importSuccessDetail', {
                imported: result.articlesImported,
                total: result.articlesTotal,
              })
            : this.i18n.t('admin.settings.importSuccess')
        );
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
}
