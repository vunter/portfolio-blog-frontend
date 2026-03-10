import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ResumeService } from '../../services/resume.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { DownloadService } from '../../../../core/services/download.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { getDateLocale } from '../../../../core/utils/date-format.util';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { ResumeTemplate } from '../../../../models';

@Component({
  selector: 'app-template-list',
  imports: [RouterLink, NgOptimizedImage, LoadingSpinnerComponent],
  templateUrl: './template-list.component.html',
  styleUrl: './template-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateListComponent implements OnInit {
  private resumeService = inject(ResumeService);
  private notification = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  private downloadService = inject(DownloadService);
  readonly i18n = inject(I18nService);

  templates = signal<ResumeTemplate[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.loading.set(true);
    this.resumeService.getTemplates().subscribe({
      next: (templates) => {
        this.templates.set(templates);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  duplicateTemplate(template: ResumeTemplate): void {
    this.resumeService.duplicateTemplate(template.id).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('resume.templates.duplicateSuccess'));
        this.loadTemplates();
      },
      error: () => {
        this.notification.error(this.i18n.t('resume.templates.duplicateError'));
      },
    });
  }

  async deleteTemplate(template: ResumeTemplate): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('common.delete'),
      message: this.i18n.t('resume.templates.confirmDelete', { name: template.name }),
      confirmText: this.i18n.t('common.delete'),
      cancelText: this.i18n.t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;

    this.resumeService.deleteTemplate(template.id).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('resume.templates.deleteSuccess'));
        this.loadTemplates();
      },
      error: () => {
        this.notification.error(this.i18n.t('resume.templates.deleteError'));
      },
    });
  }

  generatePdf(template: ResumeTemplate): void {
    this.notification.info(this.i18n.t('resume.templates.generatingPdf'));
    this.resumeService
      .generatePdf({
        templateId: template.id,
        paperSize: 'A4',
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
      })
      .subscribe({
        next: (blob) => {
          this.downloadService.downloadBlob(blob, `${template.name.toLowerCase().replace(/\s+/g, '-')}.pdf`);
          this.notification.success(this.i18n.t('resume.templates.pdfSuccess'));
        },
        error: () => {
          this.notification.error(this.i18n.t('resume.templates.pdfError'));
        },
      });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(getDateLocale(this.i18n.language()));
  }
}
