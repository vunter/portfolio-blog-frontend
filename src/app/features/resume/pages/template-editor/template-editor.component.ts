import { Component, inject, signal, computed, OnInit, OnDestroy, ElementRef, AfterViewInit, ChangeDetectionStrategy, DestroyRef, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ResumeService } from '../../services/resume.service';
import { ResumeProfileService } from '../../services/resume-profile.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { DownloadService } from '../../../../core/services/download.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { MonacoLoaderService } from '../../../../core/services/monaco-loader.service';
import { ResumeTemplate, ResumeTemplateStatus, PaperSize } from '../../../../models';

// Monaco type declarations provided by shared/types/monaco.d.ts

@Component({
  selector: 'app-template-editor',
  imports: [FormsModule, RouterLink],
  templateUrl: './template-editor.component.html',
  styleUrl: './template-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateEditorComponent implements OnInit, OnDestroy, AfterViewInit {
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
  private editor: any = null;
  private htmlModel: any = null;
  private cssModel: any = null;

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
      this.htmlContent = this.htmlModel.getValue();
      this.contentChange$.next();
    });

    this.cssModel.onDidChangeContent(() => {
      this.cssContent = this.cssModel.getValue();
      this.contentChange$.next();
    });

    this.updatePreview();
  }

  switchTab(tab: 'html' | 'css'): void {
    this.activeTab.set(tab);
    if (this.editor) this.editor.setModel(tab === 'html' ? this.htmlModel : this.cssModel);
  }

  loadTemplate(id: string): void {
    this.resumeService.getTemplate(id).subscribe({
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
      error: (err) => {
        this.notification.error(this.i18n.t('resume.editor.loadError'));
      }
    });
  }

  loadDefaultTemplate(): void {
    // M-13: Use i18n keys instead of hardcoded Portuguese
    const lang = this.i18n.language() === 'en' ? 'en' : this.i18n.language();
    const htmlLang = lang === 'pt' ? 'pt-BR' : lang;
    this.htmlContent = `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8">
  <title>${this.i18n.t('resume.editor.defaultTitle')} - {{name}}</title>
</head>
<body>
  <header class="header">
    <h1>{{name}}</h1>
    <p class="subtitle">{{title}}</p>
    <div class="contact-info">
      <span>{{email}}</span>
      <span>{{phone}}</span>
      <span>{{location}}</span>
    </div>
  </header>

  <section class="summary">
    <h2>${this.i18n.t('resume.editor.defaultSummary')}</h2>
    <p>{{summary}}</p>
  </section>

  <section class="experience">
    <h2>${this.i18n.t('resume.editor.defaultExperience')}</h2>
  </section>

  <section class="education">
    <h2>${this.i18n.t('resume.editor.defaultEducation')}</h2>
  </section>

  <section class="skills">
    <h2>${this.i18n.t('resume.editor.defaultSkills')}</h2>
  </section>
</body>
</html>`;

    this.cssContent = `/* ${this.i18n.t('resume.editor.defaultCssComment')} */
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  color: #333;
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #3b82f6;
}

.header h1 {
  font-size: 2.5rem;
  color: #1e40af;
  margin-bottom: 0.25rem;
}

.subtitle {
  font-size: 1.25rem;
  color: #6b7280;
  margin-bottom: 1rem;
}

.contact-info {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  color: #6b7280;
  font-size: 0.9rem;
}

section { margin-bottom: 1.5rem; }

h2 {
  color: #1e40af;
  font-size: 1.25rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.summary p { text-align: justify; }`;

    this.originalContent = { html: this.htmlContent, css: this.cssContent };
    setTimeout(() => {
      if (this.htmlModel) this.htmlModel.setValue(this.htmlContent);
      if (this.cssModel) this.cssModel.setValue(this.cssContent);
      this.updatePreview();
    }, 1000);
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
    const lang = this.i18n.language();
    const localeTexts: Record<string, Record<string, string>> = {
      en: { sectionTitle: 'Section Title', content: 'Content here...', jobTitle: 'Job Title', company: 'Company', period: 'Jan 2020 - Present', achievement: 'Achievement or responsibility', courseName: 'Course Name', institution: 'Educational Institution', category: 'Category', skill1: 'Skill 1', skill2: 'Skill 2' },
      pt: { sectionTitle: 'Título da Seção', content: 'Conteúdo aqui...', jobTitle: 'Cargo', company: 'Empresa', period: 'Jan 2020 - Presente', achievement: 'Responsabilidade ou conquista', courseName: 'Nome do Curso', institution: 'Instituição de Ensino', category: 'Categoria', skill1: 'Habilidade 1', skill2: 'Habilidade 2' },
      es: { sectionTitle: 'Título de Sección', content: 'Contenido aquí...', jobTitle: 'Puesto', company: 'Empresa', period: 'Ene 2020 - Presente', achievement: 'Logro o responsabilidad', courseName: 'Nombre del Curso', institution: 'Institución Educativa', category: 'Categoría', skill1: 'Habilidad 1', skill2: 'Habilidad 2' },
      it: { sectionTitle: 'Titolo della Sezione', content: 'Contenuto qui...', jobTitle: 'Posizione', company: 'Azienda', period: 'Gen 2020 - Presente', achievement: 'Responsabilità o risultato', courseName: 'Nome del Corso', institution: 'Istituto di Formazione', category: 'Categoria', skill1: 'Competenza 1', skill2: 'Competenza 2' },
    };
    const txt = localeTexts[lang] || localeTexts['en'];

    const snippets: Record<string, string> = {
      header: `<header class="header">
  <h1>{{name}}</h1>
  <p class="subtitle">{{title}}</p>
  <div class="contact-info">
    <span>{{email}}</span>
    <span>{{phone}}</span>
    <span>{{location}}</span>
  </div>
</header>`,
      section: `<section class="section">
  <h2>${txt['sectionTitle']}</h2>
  <p>${txt['content']}</p>
</section>`,
      experience: `<div class="experience-item">
  <div class="job-header">
    <h3>${txt['jobTitle']}</h3>
    <span class="company">${txt['company']}</span>
    <span class="period">${txt['period']}</span>
  </div>
  <ul>
    <li>${txt['achievement']}</li>
  </ul>
</div>`,
      education: `<div class="education-item">
  <h3>${txt['courseName']}</h3>
  <span class="institution">${txt['institution']}</span>
  <span class="year">2020</span>
</div>`,
      skills: `<div class="skills-grid">
  <div class="skill-category">
    <h4>${txt['category']}</h4>
    <ul>
      <li>${txt['skill1']}</li>
      <li>${txt['skill2']}</li>
    </ul>
  </div>
</div>`,
    };

    const snippet = snippets[type];
    if (snippet && this.editor) {
      const selection = this.editor.getSelection();
      const id = { major: 1, minor: 1 };
      const op = { identifier: id, range: selection, text: snippet, forceMoveMarkers: true };
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

    request.subscribe({
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
      error: (err) => {
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
    }).subscribe({
      next: (blob) => {
        this.downloadService.downloadBlob(blob, `${this.templateName.replace(/\s+/g, '_')}.pdf`);
        this.generatingPdf.set(false);
        this.notification.success(this.i18n.t('resume.editor.pdfSuccess'));
      },
      error: (err) => {
        this.notification.error(this.i18n.t('resume.editor.pdfError'));
        this.generatingPdf.set(false);
      },
    });
  }

  importFromProfile(): void {
    this.importingProfile.set(true);

    this.profileService.generateHtml(this.importLang()).subscribe({
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
