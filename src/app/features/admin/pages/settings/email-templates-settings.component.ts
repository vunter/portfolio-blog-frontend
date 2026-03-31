import { Component, inject, signal, ChangeDetectionStrategy, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AdminApiService, CustomVariable } from '../../services/admin-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';

interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  customized?: boolean;
}

@Component({
  selector: 'app-email-templates-settings',
  standalone: true,
  templateUrl: './email-templates-settings.component.html',
  styleUrl: './email-templates-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailTemplatesSettingsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private adminApi = inject(AdminApiService);
  private notification = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  private sanitizer = inject(DomSanitizer);
  i18n = inject(I18nService);

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

  ngOnInit(): void {
    this.loadEmailTemplates();
  }

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
        this.notification.error(this.i18n.t('admin.settings.templateLoadError'));
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
          this.notification.error(this.i18n.t('admin.settings.templatePreviewError'));
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
          this.notification.success(this.i18n.t('admin.settings.templateSaveSuccess'));
          this.editorSaving.set(false);
          this.editorOriginalHtml.set(this.editorHtml());
          this.editorIsOverride.set(true);
          this.loadEmailTemplates();
        },
        error: () => {
          this.notification.error(this.i18n.t('admin.settings.templateSaveError'));
          this.editorSaving.set(false);
        },
      });
  }

  async revertEditorTemplate(): Promise<void> {
    const template = this.editingTemplate();
    if (!template) return;

    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('admin.settings.revertTemplateTitle'),
      message: this.i18n.t('admin.settings.revertTemplateMessage'),
      confirmText: this.i18n.t('admin.settings.revertTemplateConfirm'),
      cancelText: this.i18n.t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;

    this.adminApi.deleteEmailTemplate(template.id)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.notification.success(this.i18n.t('admin.settings.templateRevertSuccess'));
          this.loadEmailTemplates();
          this.editTemplate(template); // reload source
        },
        error: () => {
          this.notification.error(this.i18n.t('admin.settings.templateRevertError'));
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
      this.notification.error(this.i18n.t('admin.settings.variableKeyInvalid'));
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
        this.notification.success(this.i18n.t('admin.settings.variableCreated'));
        this.newVarKey.set('');
        this.newVarValue.set('');
        this.newVarDesc.set('');
        this.showAddVarForm.set(false);
      },
      error: () => this.notification.error(this.i18n.t('admin.settings.variableCreateError')),
    });
  }

  updateCustomVar(v: CustomVariable): void {
    this.adminApi.updateCustomVariable(v.id, { value: v.value, description: v.description })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => this.notification.success(this.i18n.t('admin.settings.variableUpdated')),
        error: () => this.notification.error(this.i18n.t('admin.settings.variableUpdateError')),
      });
  }

  async deleteCustomVar(v: CustomVariable): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('admin.settings.deleteVariableTitle'),
      message: this.i18n.t('admin.settings.deleteVariableMessage'),
      confirmText: this.i18n.t('common.delete'),
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
          this.notification.success(this.i18n.t('admin.settings.variableDeleted'));
        },
        error: () => this.notification.error(this.i18n.t('admin.settings.variableDeleteError')),
      });
  }
}
