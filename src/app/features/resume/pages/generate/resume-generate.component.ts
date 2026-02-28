import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ResumeProfileService } from '../../services/resume-profile.service';
import { ResumeService } from '../../services/resume.service';
import { DownloadService } from '../../../../core/services/download.service';
import { ResumeTemplate } from '../../../../models';
import { I18nService, Language } from '../../../../core/services/i18n.service';


@Component({
  selector: 'app-resume-generate',
  imports: [FormsModule, RouterLink],
  templateUrl: './resume-generate.component.html',
  styleUrl: './resume-generate.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumeGenerateComponent implements OnInit {
  private profileService = inject(ResumeProfileService);
  private resumeService = inject(ResumeService);
  private sanitizer = inject(DomSanitizer);
  private downloadService = inject(DownloadService);
  readonly i18n = inject(I18nService);

  loading = signal(false);
  htmlContent = signal<string>('');
  trustedHtml = signal<SafeHtml>('');
  errorMessage = signal('');
  successMessage = signal('');

  generatingPdf = signal(false);

  // Resume output language (separate from UI language)
  resumeLang = signal<Language>('en');

  // Save as Template modal
  showSaveModal = signal(false);
  savingTemplate = signal(false);
  templateName = '';
  templateDescription = '';

  // Update Existing Template modal
  showUpdateModal = signal(false);
  updatingTemplate = signal(false);
  loadingTemplates = signal(false);
  existingTemplates = signal<ResumeTemplate[]>([]);
  selectedTemplateId = signal<string | null>(null);

  ngOnInit(): void {
    this.generate();
  }

  setResumeLang(lang: Language): void {
    this.resumeLang.set(lang);
    // Auto-regenerate when language changes
    if (this.htmlContent()) {
      this.generate();
    }
  }

  generate(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.profileService.generateHtml(this.resumeLang()).subscribe({
      next: (html) => {
        this.htmlContent.set(html);
        // Strip <script> tags to avoid sandbox console warnings (iframe blocks scripts anyway)
        const cleanHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        // SEC-F-01: bypassSecurityTrustHtml is required here because Angular's built-in
        // sanitization strips all content from iframe [srcdoc] bindings. The HTML is generated
        // server-side from the user's own profile data — no third-party/untrusted input.
        // The iframe in the template uses sandbox="" to prevent script execution.
        this.trustedHtml.set(this.sanitizer.bypassSecurityTrustHtml(cleanHtml));
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 404) {
          this.errorMessage.set(this.i18n.t('resume.generate.profileNotFound'));
        } else {
          this.errorMessage.set(this.i18n.t('resume.generate.errorGenerating') + ': ' + (err.error?.message || err.message || ''));
        }
      },
    });
  }

  download(): void {
    this.profileService.downloadHtml(this.resumeLang()).subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob) return;

        // Extract filename from Content-Disposition header
        const disposition = response.headers.get('Content-Disposition');
        let filename = 'resume.html';
        if (disposition) {
          const match = disposition.match(/filename="?([^";\s]+)"?/);
          if (match) filename = match[1];
        }

        this.downloadService.downloadBlob(blob, filename);
      },
      error: (err) => {
        this.errorMessage.set(this.i18n.t('resume.generate.errorDownload') + ': ' + (err.error?.message || err.message || ''));
      },
    });
  }

  downloadPdf(): void {
    this.generatingPdf.set(true);
    this.errorMessage.set('');

    this.profileService.downloadPdf(this.resumeLang()).subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob) return;

        const disposition = response.headers.get('Content-Disposition');
        let filename = 'resume.pdf';
        if (disposition) {
          const match = disposition.match(/filename="?([^";\s]+)"?/);
          if (match) filename = match[1];
        }

        this.downloadService.downloadBlob(blob, filename);
        this.generatingPdf.set(false);
      },
      error: (err) => {
        this.generatingPdf.set(false);
        this.errorMessage.set(this.i18n.t('resume.generate.errorPdf') + ': ' + (err.error?.message || err.message || ''));
      },
    });
  }

  openSaveModal(): void {
    this.templateName = '';
    this.templateDescription = '';
    this.showSaveModal.set(true);
  }

  closeSaveModal(): void {
    this.showSaveModal.set(false);
  }

  saveAsTemplate(): void {
    if (!this.templateName.trim()) return;

    this.savingTemplate.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    // Separate CSS from HTML for the template
    const fullHtml = this.htmlContent();
    let cssContent = '';
    let htmlBody = fullHtml;

    const styleMatch = fullHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    if (styleMatch) {
      cssContent = styleMatch[1].trim();
      // Keep the full HTML as htmlContent (template system renders it as-is)
    }

    this.resumeService.createTemplate({
      name: this.templateName.trim(),
      description: this.templateDescription.trim() || undefined,
      htmlContent: fullHtml,
      cssContent: cssContent || undefined,
      status: 'ACTIVE',
      paperSize: 'A4',
      orientation: 'PORTRAIT',
    }).subscribe({
      next: () => {
        this.savingTemplate.set(false);
        this.showSaveModal.set(false);
        this.successMessage.set(this.i18n.t('resume.generate.templateSaved', { name: this.templateName.trim() }));
      },
      error: (err) => {
        this.savingTemplate.set(false);
        this.errorMessage.set(this.i18n.t('resume.generate.errorSavingTemplate') + ': ' + (err.error?.message || err.message || ''));
      },
    });
  }

  openUpdateModal(): void {
    this.selectedTemplateId.set(null);
    this.showUpdateModal.set(true);
    this.loadingTemplates.set(true);

    this.resumeService.getTemplates().subscribe({
      next: (templates) => {
        this.existingTemplates.set(templates);
        this.loadingTemplates.set(false);
      },
      error: () => {
        this.existingTemplates.set([]);
        this.loadingTemplates.set(false);
      },
    });
  }

  closeUpdateModal(): void {
    this.showUpdateModal.set(false);
  }

  updateExistingTemplate(): void {
    const templateId = this.selectedTemplateId();
    if (!templateId) return;

    this.updatingTemplate.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.resumeService.applyProfileToTemplate(templateId, this.resumeLang()).subscribe({
      next: (updated) => {
        this.updatingTemplate.set(false);
        this.showUpdateModal.set(false);
        this.successMessage.set(this.i18n.t('resume.generate.templateUpdated', { name: updated.name }));
      },
      error: (err) => {
        this.updatingTemplate.set(false);
        this.errorMessage.set(this.i18n.t('resume.generate.errorUpdatingTemplate') + ': ' + (err.error?.message || err.message || ''));
      },
    });
  }
}
