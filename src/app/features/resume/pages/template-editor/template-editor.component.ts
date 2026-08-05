import { Component, inject, signal, computed, OnInit, OnDestroy, ElementRef, AfterViewInit, ChangeDetectionStrategy, DestroyRef, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, debounceTime, timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ResumeService } from '../../services/resume.service';
import { ResumeProfileService } from '../../services/resume-profile.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { DownloadService } from '../../../../core/services/download.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { MonacoLoaderService } from '../../../../core/services/monaco-loader.service';
import { ResumeTemplate, ResumeTemplateStatus, PaperSize } from '../../../../models';
import { getDefaultHtmlTemplate, getDefaultCssTemplate } from './utils/template-defaults.util';
import { getSnippet } from './utils/template-snippets.util';

// Monaco type declarations provided by shared/types/monaco.d.ts

@Component({
  selector: 'app-template-editor',
  imports: [FormsModule, RouterLink],
  templateUrl: './template-editor.component.html',
  styleUrl: './template-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class TemplateEditorComponent implements OnInit, OnDestroy, AfterViewInit {
  /** Read by the unsavedChangesGuard (canDeactivate) and beforeunload handler. */
  get hasUnsavedChanges(): boolean {
    return this.hasChanges();
  }

  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  // ANG20-05: viewChild() signal queries instead of @ViewChild decorators
  readonly monacoContainer = viewChild<ElementRef>('monacoContainer');
  readonly previewIframe = viewChild<ElementRef<HTMLIFrameElement>>('previewIframe');

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly resumeService = inject(ResumeService);
  private readonly profileService = inject(ResumeProfileService);
  private readonly notification = inject(NotificationService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly downloadService = inject(DownloadService);
  readonly themeService = inject(ThemeService);
  readonly i18n = inject(I18nService);
  private readonly monacoLoader = inject(MonacoLoaderService);

  private readonly destroyRef = inject(DestroyRef);
  private contentChange$ = new Subject<void>();
  private editor: import('../../../../shared/types/monaco').MonacoStandaloneEditor | null = null;
  private htmlModel: import('../../../../shared/types/monaco').MonacoTextModel | null = null;
  private cssModel: import('../../../../shared/types/monaco').MonacoTextModel | null = null;

  templateId: string | null = null;
  templateName = this.i18n.t('resume.editor.newResume');
  templateDescription = '';
  templateStatus: ResumeTemplateStatus = 'DRAFT';
  paperSize: PaperSize = 'A4';
  isDefault = false;
  templateAlias = '';
  htmlContent = '';
  cssContent = '';
  originalContent = { html: '', css: '' };

  activeTab = signal<'html' | 'css'>('html');
  viewMode = signal<'split' | 'code' | 'preview'>('split');
  previewHtml = signal<SafeHtml>('');
  saving = signal(false);
  generatingPdf = signal(false);
  hasChanges = signal(false);
  zoomLevel = signal(75);
  importLang = signal<'en' | 'pt' | 'es' | 'it'>('en');
  importingProfile = signal(false);

  // MED-02: computed() instead of getter to avoid recalculation every CD cycle
  readonly variables = computed(() => [
    { key: 'name', label: this.i18n.t('resume.editor.var.name') },
    { key: 'email', label: this.i18n.t('resume.editor.var.email') },
    { key: 'phone', label: this.i18n.t('resume.editor.var.phone') },
    { key: 'location', label: this.i18n.t('resume.editor.var.location') },
    { key: 'summary', label: this.i18n.t('resume.editor.var.summary') },
    { key: 'linkedin', label: 'LinkedIn URL' },
    { key: 'github', label: 'GitHub URL' },
    { key: 'website', label: this.i18n.t('resume.editor.var.website') },
  ]);

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.templateId = id;
      this.loadTemplate(id);
    } else {
      this.loadDefaultTemplate();
    }

    this.contentChange$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.updatePreview();
        this.checkForChanges();
      });
  }

  ngAfterViewInit(): void {
    this.loadMonaco();
  }

  ngOnDestroy(): void {
    if (this.editor) this.editor.dispose();
    this.htmlModel?.dispose();
    this.cssModel?.dispose();
  }

  private async loadMonaco(): Promise<void> {
    await this.monacoLoader.load();
    this.initEditor();
  }

  private initEditor(): void {
    const container = this.monacoContainer()?.nativeElement;
    if (!container) return;

    const isDark = this.themeService.isDark();
    this.htmlModel = monaco.editor.createModel(this.htmlContent, 'html');
    this.cssModel = monaco.editor.createModel(this.cssContent, 'css');

    this.editor = monaco.editor.create(container, {
      model: this.htmlModel,
      theme: isDark ? 'vs-dark' : 'vs',
      minimap: { enabled: true },
      fontSize: 14,
      fontFamily: "'JetBrains Mono', Consolas, monospace",
      lineNumbers: 'on',
      wordWrap: 'on',
      automaticLayout: true,
      tabSize: 2,
      scrollBeyondLastLine: false,
      padding: { top: 16, bottom: 16 },
      bracketPairColorization: { enabled: true },
      formatOnPaste: true,
      formatOnType: true,
    });

    this.htmlModel.onDidChangeContent(() => {
      // Models are non-null inside this closure (they were created just above)
      // but TS can't prove it after the closure boundary; assert with ! since
      // we never null them out before dispose.
      this.htmlContent = this.htmlModel!.getValue();
      this.contentChange$.next();
    });

    this.cssModel.onDidChangeContent(() => {
      this.cssContent = this.cssModel!.getValue();
      this.contentChange$.next();
    });

    this.updatePreview();
  }

  switchTab(tab: 'html' | 'css'): void {
    this.activeTab.set(tab);
    if (this.editor) this.editor.setModel(tab === 'html' ? this.htmlModel : this.cssModel);
  }

  loadTemplate(id: string): void {
    this.resumeService.getTemplate(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (template) => {
        this.templateName = template.name;
        this.templateDescription = template.description || '';
        this.templateStatus = template.status;
        this.paperSize = template.paperSize || 'A4';
        this.isDefault = template.isDefault || false;
        this.templateAlias = template.alias || '';
        this.htmlContent = template.htmlContent || '';
        this.cssContent = template.cssContent || '';
        this.originalContent = { html: this.htmlContent, css: this.cssContent };
        if (this.htmlModel) this.htmlModel.setValue(this.htmlContent);
        if (this.cssModel) this.cssModel.setValue(this.cssContent);
        this.updatePreview();
      },
      error: (_err) => {
        this.notification.error(this.i18n.t('resume.editor.loadError'));
      }
    });
  }

  loadDefaultTemplate(): void {
    this.htmlContent = getDefaultHtmlTemplate(this.i18n);
    this.cssContent = getDefaultCssTemplate(this.i18n);
    this.originalContent = { html: this.htmlContent, css: this.cssContent };
    // Q7.2: Use RxJS timer with takeUntilDestroyed instead of raw setTimeout
    timer(1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.htmlModel) this.htmlModel.setValue(this.htmlContent);
      if (this.cssModel) this.cssModel.setValue(this.cssContent);
      this.updatePreview();
    });
  }

  updatePreview(): void {
    const bodyContent = this.htmlContent.replace(/<\/?html[^>]*>|<\/?head[^>]*>|<\/?body[^>]*>|<!DOCTYPE[^>]*>|<meta[^>]*>|<title[^>]*>.*?<\/title>/gi, '');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${this.cssContent}</style></head><body>${bodyContent}</body></html>`;
    // SEC-F-01: bypassSecurityTrustHtml is required here because Angular's built-in
    // sanitization strips all content from iframe [srcdoc] bindings. Content is admin-edited
    // template HTML/CSS — no third-party/untrusted input. The iframe in the template uses
    // sandbox="" to fully restrict script execution and same-origin access.
    this.previewHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
  }

  checkForChanges(): void {
    const changed = this.htmlContent !== this.originalContent.html || this.cssContent !== this.originalContent.css;
    this.hasChanges.set(changed);
  }

  refreshPreview(): void { this.updatePreview(); }

  zoomIn(): void { if (this.zoomLevel() < 150) this.zoomLevel.update(z => z + 10); }

  zoomOut(): void { if (this.zoomLevel() > 30) this.zoomLevel.update(z => z - 10); }

  insertSnippet(type: string): void {
    const snippet = getSnippet(type, this.i18n.language());
    if (snippet && this.editor) {
      const selection = this.editor.getSelection();
      const op = { identifier: { major: 1, minor: 1 }, range: selection, text: snippet, forceMoveMarkers: true };
      this.editor.executeEdits('snippet', [op]);
      this.editor.focus();
    }
  }

  insertVariable(key: string): void {
    if (this.editor) {
      const text = `{{${key}}}`;
      const selection = this.editor.getSelection();
      const id = { major: 1, minor: 1 };
      const op = { identifier: id, range: selection, text: text, forceMoveMarkers: true };
      this.editor.executeEdits('variable', [op]);
      this.editor.focus();
    }
  }

  save(): void {
    if (!this.templateName.trim()) {
      this.notification.error(this.i18n.t('resume.editor.nameRequired'));
      return;
    }

    this.saving.set(true);
    const template: Partial<ResumeTemplate> = {
      name: this.templateName,
      description: this.templateDescription,
      htmlContent: this.htmlContent,
      cssContent: this.cssContent,
      status: this.templateStatus,
      paperSize: this.paperSize,
      isDefault: this.isDefault,
      alias: this.templateAlias || undefined,
    };

    const request = this.templateId
      ? this.resumeService.updateTemplate(this.templateId, template)
      : this.resumeService.createTemplate(template);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.notification.success(this.i18n.t('resume.editor.saveSuccess'));
        this.originalContent = { html: this.htmlContent, css: this.cssContent };
        this.hasChanges.set(false);
        if (!this.templateId) {
          this.templateId = saved.id;
          this.router.navigate(['/resume/editor', saved.id], { replaceUrl: true });
        }
        this.saving.set(false);
      },
      error: (_err) => {
        this.notification.error(this.i18n.t('resume.editor.saveError'));
        this.saving.set(false);
      },
    });
  }

  downloadPdf(): void {
    this.generatingPdf.set(true);

    // Build the full HTML for PDF generation
    // If htmlContent is already a complete document, inject cssContent into it
    // If not, wrap it properly
    let fullHtml: string;
    const hasHtmlStructure = /<html[\s>]/i.test(this.htmlContent);

    if (hasHtmlStructure && this.cssContent?.trim()) {
      // Inject cssContent into existing <head>, before </head>
      fullHtml = this.htmlContent.replace(
        /<\/head>/i,
        `<style>${this.cssContent}</style></head>`
      );
    } else if (hasHtmlStructure) {
      // Already a complete HTML document, send as-is
      fullHtml = this.htmlContent;
    } else {
      // Plain body content, wrap it with proper structure
      fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${this.cssContent || ''}</style></head><body>${this.htmlContent}</body></html>`;
    }

    this.resumeService.generatePdf({
      htmlContent: fullHtml,
      paperSize: this.paperSize,
      filename: `${this.templateName.replace(/\s+/g, '_')}.pdf`,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        this.downloadService.downloadBlob(blob, `${this.templateName.replace(/\s+/g, '_')}.pdf`);
        this.generatingPdf.set(false);
        this.notification.success(this.i18n.t('resume.editor.pdfSuccess'));
      },
      error: (_err) => {
        this.notification.error(this.i18n.t('resume.editor.pdfError'));
        this.generatingPdf.set(false);
      },
    });
  }

  importFromProfile(): void {
    this.importingProfile.set(true);

    this.profileService.generateHtml(this.importLang()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (html) => {
        // Extract CSS from the generated HTML
        let cssContent = '';
        const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
        if (styleMatch) {
          cssContent = styleMatch[1].trim();
        }

        this.htmlContent = html;
        this.cssContent = cssContent;

        if (this.htmlModel) this.htmlModel.setValue(this.htmlContent);
        if (this.cssModel) this.cssModel.setValue(this.cssContent);
        this.updatePreview();
        this.checkForChanges();

        this.importingProfile.set(false);
        this.notification.success(this.i18n.t('resume.editor.importSuccess'));
      },
      error: (err) => {
        this.importingProfile.set(false);
        if (err.status === 404) {
          this.notification.error(this.i18n.t('resume.editor.profileNotFound'));
        } else {
          this.notification.error(this.i18n.t('resume.editor.importError'));
        }
      },
    });
  }
}
