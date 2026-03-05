import { Component, inject, signal, ChangeDetectionStrategy, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AdminApiService, CustomVariable, TranslationItem, TranslationPage } from '../../services/admin-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { DownloadService } from '../../../../core/services/download.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';

interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  customized?: boolean;
}

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, SkeletonComponent],
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
  emailTemplates = signal<EmailTemplate[]>([]);
  emailTemplatesLoading = signal(false);
  previewingTemplate = signal<EmailTemplate | null>(null);
  previewHtml = signal<SafeHtml>('');

  // Editor state
  editingTemplate = signal<EmailTemplate | null>(null);
  editorHtml = signal('');
  editorOriginalHtml = signal('');
  editorIsOverride = signal(false);
  editorSaving = signal(false);
  editorLoading = signal(false);
  editorPreviewHtml = signal<SafeHtml>('');
  editorShowPreview = signal(false);
  editorPlaceholders = signal<Record<string, unknown>>({});
  editorShowPlaceholders = signal(false);

  // Custom variables state
  globalCustomVars = signal<CustomVariable[]>([]);
  templateCustomVars = signal<CustomVariable[]>([]);
  customVarsLoading = signal(false);
  newVarKey = signal('');
  newVarValue = signal('');
  newVarDesc = signal('');
  newVarScope = signal<'global' | 'template'>('global');
  showAddVarForm = signal(false);

  // Translation management state
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

  // Email Template Management

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

  previewTemplate(template: EmailTemplate): void {
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

  editTemplate(template: EmailTemplate): void {
    this.editorLoading.set(true);
    this.editingTemplate.set(template);
    this.editorShowPreview.set(false);
    this.adminApi.getEmailTemplateSource(template.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (source) => {
        this.editorHtml.set(source.html);
        this.editorOriginalHtml.set(source.html);
        this.editorIsOverride.set(source.isOverride);
        this.editorPlaceholders.set(source.placeholders || {});
        this.globalCustomVars.set(source.customVariables?.global || []);
        this.templateCustomVars.set(source.customVariables?.template || []);
        this.editorLoading.set(false);
      },
      error: () => {
        this.notification.error('Failed to load template source');
        this.editingTemplate.set(null);
        this.editorLoading.set(false);
      },
    });
  }

  closeEditor(): void {
    this.editingTemplate.set(null);
    this.editorHtml.set('');
    this.editorOriginalHtml.set('');
    this.editorPreviewHtml.set('');
    this.editorShowPreview.set(false);
    this.editorPlaceholders.set({});
    this.editorShowPlaceholders.set(false);
    this.globalCustomVars.set([]);
    this.templateCustomVars.set([]);
    this.showAddVarForm.set(false);
    this.newVarKey.set('');
    this.newVarValue.set('');
    this.newVarDesc.set('');
  }

  onEditorInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.editorHtml.set(textarea.value);
  }

  editorHasChanges(): boolean {
    return this.editorHtml() !== this.editorOriginalHtml();
  }

  placeholderEntries(): { key: string; value: string; thymeleaf: string }[] {
    const ph = this.editorPlaceholders();
    return Object.entries(ph)
      .filter(([, v]) => typeof v === 'string')
      .map(([k, v]) => ({ key: k, value: String(v), thymeleaf: `\${${k}}` }));
  }

  togglePlaceholders(): void {
    this.editorShowPlaceholders.set(!this.editorShowPlaceholders());
  }

  insertPlaceholder(thymeleaf: string): void {
    this.editorHtml.set(this.editorHtml() + thymeleaf);
  }

  formatThymeleafVar(key: string): string {
    return '${' + key + '}';
  }

  previewEditorChanges(): void {
    const template = this.editingTemplate();
    if (!template) return;
    this.editorShowPreview.set(true);
    this.adminApi.previewCustomEmailTemplate(template.id, this.editorHtml())
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (html) => {
          this.editorPreviewHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
        },
        error: () => {
          this.notification.error('Failed to preview template');
        },
      });
  }

  saveEditorTemplate(): void {
    const template = this.editingTemplate();
    if (!template) return;
    this.editorSaving.set(true);
    this.adminApi.updateEmailTemplate(template.id, this.editorHtml())
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.notification.success('Template saved successfully');
          this.editorSaving.set(false);
          this.editorOriginalHtml.set(this.editorHtml());
          this.editorIsOverride.set(true);
          this.loadEmailTemplates();
        },
        error: () => {
          this.notification.error('Failed to save template');
          this.editorSaving.set(false);
        },
      });
  }

  async revertEditorTemplate(): Promise<void> {
    const template = this.editingTemplate();
    if (!template) return;

    const confirmed = await this.confirmDialog.confirm({
      title: 'Revert Template',
      message: 'Revert this template to the default version? Your customizations will be lost.',
      confirmText: 'Revert',
      cancelText: this.i18n.t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;

    this.adminApi.deleteEmailTemplate(template.id)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.notification.success('Template reverted to default');
          this.loadEmailTemplates();
          this.editTemplate(template); // reload source
        },
        error: () => {
          this.notification.error('Failed to revert template');
        },
      });
  }

  // Custom variable methods
  allCustomVars(): CustomVariable[] {
    return [...this.globalCustomVars(), ...this.templateCustomVars()];
  }

  toggleAddVarForm(): void {
    this.showAddVarForm.set(!this.showAddVarForm());
    if (!this.showAddVarForm()) {
      this.newVarKey.set('');
      this.newVarValue.set('');
      this.newVarDesc.set('');
    }
  }

  addCustomVariable(): void {
    const key = this.newVarKey().trim();
    const value = this.newVarValue().trim();
    if (!key || !value) return;
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
      this.notification.error('Variable key must start with a letter and contain only letters, numbers, and underscores');
      return;
    }
    const scope = this.newVarScope();
    const templateId = scope === 'template' ? this.editingTemplate()?.id : undefined;
    this.adminApi.createCustomVariable({
      key, value,
      description: this.newVarDesc().trim() || undefined,
      templateId,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (created) => {
        if (created.templateId === '__global__') {
          this.globalCustomVars.set([...this.globalCustomVars(), created]);
        } else {
          this.templateCustomVars.set([...this.templateCustomVars(), created]);
        }
        this.notification.success(`Variable \${${key}} created`);
        this.newVarKey.set('');
        this.newVarValue.set('');
        this.newVarDesc.set('');
        this.showAddVarForm.set(false);
      },
      error: () => this.notification.error('Failed to create variable'),
    });
  }

  updateCustomVar(v: CustomVariable): void {
    this.adminApi.updateCustomVariable(v.id, { value: v.value, description: v.description })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => this.notification.success(`Variable \${${v.key}} updated`),
        error: () => this.notification.error('Failed to update variable'),
      });
  }

  async deleteCustomVar(v: CustomVariable): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete Variable',
      message: `Delete variable \${${v.key}}? Any templates using it will show it as empty.`,
      confirmText: 'Delete',
      cancelText: this.i18n.t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;
    this.adminApi.deleteCustomVariable(v.id)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          if (v.templateId === '__global__') {
            this.globalCustomVars.set(this.globalCustomVars().filter(x => x.id !== v.id));
          } else {
            this.templateCustomVars.set(this.templateCustomVars().filter(x => x.id !== v.id));
          }
          this.notification.success(`Variable \${${v.key}} deleted`);
        },
        error: () => this.notification.error('Failed to delete variable'),
      });
  }

  // ==================== Translation Management ====================

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
          this.notification.error('Failed to load translations');
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
          this.notification.success('Translation updated');
          this.transSaving.set(false);
          this.transEditId.set(null);
          this.loadTranslations();
        },
        error: () => {
          this.notification.error('Failed to update translation');
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
        this.notification.success(`Translation '${key}' created`);
        this.newTransKey.set('');
        this.newTransValue.set('');
        this.showAddTrans.set(false);
        this.loadTranslations();
      },
      error: () => this.notification.error('Failed to create translation'),
    });
  }

  async deleteTrans(item: TranslationItem): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete Translation',
      message: `Delete key "${item.translationKey}" (${item.locale})?`,
      confirmText: 'Delete',
      cancelText: this.i18n.t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;
    this.adminApi.deleteTranslation(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.notification.success('Translation deleted');
          this.loadTranslations();
        },
        error: () => this.notification.error('Failed to delete translation'),
      });
  }

  invalidateI18nCache(): void {
    this.transInvalidating.set(true);
    this.adminApi.invalidateI18nCache()
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.notification.success('i18n cache invalidated');
          this.transInvalidating.set(false);
        },
        error: () => {
          this.notification.error('Failed to invalidate cache');
          this.transInvalidating.set(false);
        },
      });
  }

}
