import { Component, inject, signal, OnInit, ElementRef, ChangeDetectionStrategy, DestroyRef, afterNextRender, Injector } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ResumeService } from '../../services/resume.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { DownloadService } from '../../../../core/services/download.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { ResumeTemplate, PdfGenerationRequest } from '../../../../models';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, debounceTime } from 'rxjs';

interface PdfOptions {
  format: 'A4' | 'Letter';
  margins: { top: number; right: number; bottom: number; left: number };
  includeBackground: boolean;
}

@Component({
  selector: 'app-template-preview',
  imports: [RouterLink, FormsModule, LoadingSpinnerComponent],
  templateUrl: './template-preview.component.html',
  styleUrl: './template-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplatePreviewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private resumeService = inject(ResumeService);
  private notification = inject(NotificationService);
  private sanitizer = inject(DomSanitizer);
  private downloadService = inject(DownloadService);
  private el = inject(ElementRef);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);
  i18n = inject(I18nService);

  template = signal<ResumeTemplate | null>(null);
  previewHtml = signal<SafeHtml>('');
  loading = signal(true);
  generating = signal(false);
  templateId = '';

  // Dynamic variables
  detectedVariables = signal<string[]>([]);
  templateVariables = signal<Record<string, string>>({});
  private originalHtml = '';

  pdfOptions: PdfOptions = {
    format: 'A4',
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    includeBackground: true,
  };

  constructor() {
    // F-334: afterNextRender handles SSR check and runs after first render
    afterNextRender(() => {
      this.updatePreviewScale();
      fromEvent(window, 'resize').pipe(
        debounceTime(150),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(() => this.updatePreviewScale());
    }, { injector: this.injector });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.templateId = id;
      this.loadTemplate(id);
    }
  }

  private updatePreviewScale(): void {
    const main = this.el.nativeElement.querySelector('.preview-main');
    const container = this.el.nativeElement.querySelector('.preview-container');
    if (!main || !container) return;
    // 210mm ≈ 793.7px at 96dpi, 297mm ≈ 1122.5px
    const a4Width = 793.7;
    const a4Height = 1122.5;
    // Read available width from parent (minus padding) to avoid max-width influence
    const mainPadding = parseFloat(getComputedStyle(main).paddingLeft) + parseFloat(getComputedStyle(main).paddingRight);
    const availableWidth = main.clientWidth - mainPadding;
    const scale = Math.min(availableWidth / a4Width, 1);
    container.style.setProperty('--preview-scale', scale.toString());
    // Explicitly set container dimensions to match scaled iframe
    container.style.width = `${a4Width * scale}px`;
    container.style.height = `${a4Height * scale}px`;
  }

  loadTemplate(id: string): void {
    this.loading.set(true);
    this.resumeService.getTemplate(id).subscribe({
      next: (template) => {
        this.template.set(template);
        this.originalHtml = template.htmlContent || '';
        this.detectVariables(template.htmlContent || '');
        this.generatePreview(template);
        this.loading.set(false);
        // Schedule scale update after DOM renders the preview container
        afterNextRender(() => this.updatePreviewScale(), { injector: this.injector });
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  /**
   * Detect variables in template using {{variableName}} pattern
   */
  detectVariables(html: string): void {
    const regex = /\{\{(\w+)\}\}/g;
    const matches = new Set<string>();
    let match;
    while ((match = regex.exec(html)) !== null) {
      matches.add(match[1]);
    }
    this.detectedVariables.set(Array.from(matches));
    
    // Initialize variables with empty values
    const vars: Record<string, string> = {};
    matches.forEach((v) => (vars[v] = ''));
    this.templateVariables.set(vars);
  }

  /**
   * Format variable name for display (camelCase to Title Case)
   */
  formatVariableName(variable: string): string {
    return variable
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  /**
   * Update a single variable value
   */
  updateVariable(key: string, value: string): void {
    this.templateVariables.update((vars) => ({ ...vars, [key]: value }));
  }

  /**
   * HTML-escape a string to prevent XSS when injecting user values into templates.
   * Uses pure string replacement (SSR-safe, no DOM dependency).
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Apply variables to the preview
   */
  applyVariables(): void {
    const template = this.template();
    if (!template) return;

    let html = this.originalHtml;
    const vars = this.templateVariables();

    // Replace all variables — HTML-escape values to prevent XSS via user profile data
    Object.entries(vars).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      html = html.replace(regex, value ? this.escapeHtml(value) : `{{${key}}}`);
    });

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>${template.cssContent || ''}</style>
        </head>
        <body>${html}</body>
      </html>
    `;
    // SEC-F-01: bypassSecurityTrustHtml is required here because Angular's built-in
    // sanitization strips all content from iframe [srcdoc] bindings. User variable values
    // are HTML-escaped above via escapeHtml(). The iframe in the template uses sandbox=""
    // to restrict script execution and same-origin access.
    this.previewHtml.set(this.sanitizer.bypassSecurityTrustHtml(fullHtml));
    this.notification.success(this.i18n.t('resume.preview.variablesApplied'));
  }

  generatePreview(template: ResumeTemplate): void {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>${template.cssContent || ''}</style>
        </head>
        <body>${template.htmlContent || ''}</body>
      </html>
    `;
    // SEC-F-01: bypassSecurityTrustHtml is required here because Angular's built-in
    // sanitization strips all content from iframe [srcdoc] bindings. Content is admin-managed
    // template data — no third-party/untrusted input. Iframe sandbox restricts execution.
    this.previewHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
  }

  generatePdf(): void {
    this.generating.set(true);
    this.notification.info(this.i18n.t('resume.preview.generatingPdf'));

    const request: PdfGenerationRequest = {
      templateId: this.templateId,
      variables: this.templateVariables(),
      paperSize: this.pdfOptions.format === 'A4' ? 'A4' : 'LETTER',
      margins: this.pdfOptions.margins,
      includeBackground: this.pdfOptions.includeBackground,
    };

    this.resumeService.generatePdf(request).subscribe({
      next: (blob) => {
        const filename = `${this.template()?.name?.toLowerCase().replace(/\s+/g, '-') || 'resume'}.pdf`;
        this.downloadService.downloadBlob(blob, filename);
        this.notification.success(this.i18n.t('resume.preview.pdfSuccess'));
        this.generating.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('resume.preview.pdfError'));
        this.generating.set(false);
      },
    });
  }
}
