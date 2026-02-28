import { Component, inject, signal, input, output, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AdminApiService } from '../../services/admin-api.service';
import { ArticleVersionResponse, VersionCompareResponse } from '../../../../models';
import { I18nService } from '../../../../core/services/i18n.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-version-history',
  imports: [DatePipe],
  templateUrl: './version-history.component.html',
  styleUrl: './version-history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VersionHistoryComponent {
  private adminApi = inject(AdminApiService);
  private notification = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  i18n = inject(I18nService);

  // Inputs
  articleId = input.required<string>();

  // Outputs
  restored = output<void>();

  // State
  loading = signal(false);
  restoring = signal(false);
  comparing = signal(false);
  versions = signal<ArticleVersionResponse[]>([]);
  totalVersions = signal(0);
  selectedVersion = signal<ArticleVersionResponse | null>(null);
  previewingVersion = signal<ArticleVersionResponse | null>(null);

  // Compare
  compareMode = signal(false);
  compareFrom = signal<number | null>(null);
  compareTo = signal<number | null>(null);
  compareResult = signal<VersionCompareResponse | null>(null);
  contentDiffLines = signal<{ type: 'added' | 'removed' | 'unchanged'; text: string }[]>([]);

  loadVersions(): void {
    const id = this.articleId();
    if (!id) return;

    this.loading.set(true);
    this.adminApi.getArticleVersions(id).subscribe({
      next: (response) => {
        this.versions.set(response.versions || []);
        this.totalVersions.set(response.totalVersions || 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notification.error(this.i18n.t('admin.versions.loadError'));
      }
    });
  }

  selectVersion(version: ArticleVersionResponse): void {
    this.selectedVersion.update(v => v?.versionNumber === version.versionNumber ? null : version);
  }

  previewVersion(version: ArticleVersionResponse): void {
    const id = this.articleId();
    this.adminApi.getArticleVersion(id, version.versionNumber).subscribe({
      next: (full) => this.previewingVersion.set(full),
      error: () => this.notification.error(this.i18n.t('admin.versions.loadError'))
    });
  }

  closePreview(): void {
    this.previewingVersion.set(null);
  }

  async restore(version: ArticleVersionResponse): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('admin.versions.restoreConfirm').replace('{version}', String(version.versionNumber)),
      message: this.i18n.t('admin.versions.restoreConfirm').replace('{version}', String(version.versionNumber)),
      confirmText: this.i18n.t('common.confirm'),
      cancelText: this.i18n.t('common.cancel'),
      type: 'warning',
    });
    if (!confirmed) return;

    this.restoring.set(true);
    this.adminApi.restoreVersion(this.articleId(), version.versionNumber).subscribe({
      next: () => {
        this.restoring.set(false);
        this.notification.success(this.i18n.t('admin.versions.restoreSuccess'));
        this.restored.emit();
        this.loadVersions();
      },
      error: () => {
        this.restoring.set(false);
        this.notification.error(this.i18n.t('admin.versions.restoreError'));
      }
    });
  }

  toggleCompareMode(): void {
    this.compareMode.update(v => !v);
    if (!this.compareMode()) {
      this.compareFrom.set(null);
      this.compareTo.set(null);
      this.compareResult.set(null);
    } else if (this.versions().length >= 2) {
      this.compareFrom.set(this.versions()[1].versionNumber);
      this.compareTo.set(this.versions()[0].versionNumber);
    }
  }

  setCompareFrom(v: number): void { this.compareFrom.set(v); }
  setCompareTo(v: number): void { this.compareTo.set(v); }

  runCompare(): void {
    const from = this.compareFrom();
    const to = this.compareTo();
    if (from === null || to === null) return;

    this.comparing.set(true);
    this.contentDiffLines.set([]);
    const id = this.articleId();

    forkJoin({
      comparison: this.adminApi.compareVersions(id, from, to),
      fromVersion: this.adminApi.getArticleVersion(id, from),
      toVersion: this.adminApi.getArticleVersion(id, to),
    }).subscribe({
      next: ({ comparison, fromVersion, toVersion }) => {
        this.compareResult.set(comparison);
        if (comparison.contentChanged) {
          this.contentDiffLines.set(
            this.computeLineDiff(fromVersion.content || '', toVersion.content || '')
          );
        }
        this.comparing.set(false);
      },
      error: () => {
        this.comparing.set(false);
        this.notification.error(this.i18n.t('admin.versions.compareError'));
      }
    });
  }

  clearCompare(): void {
    this.compareResult.set(null);
    this.contentDiffLines.set([]);
  }

  private computeLineDiff(oldText: string, newText: string): { type: 'added' | 'removed' | 'unchanged'; text: string }[] {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const result: { type: 'added' | 'removed' | 'unchanged'; text: string }[] = [];
    const maxLen = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLen; i++) {
      const oldLine = i < oldLines.length ? oldLines[i] : undefined;
      const newLine = i < newLines.length ? newLines[i] : undefined;

      if (oldLine === newLine) {
        result.push({ type: 'unchanged', text: oldLine! });
      } else {
        if (oldLine !== undefined) result.push({ type: 'removed', text: oldLine });
        if (newLine !== undefined) result.push({ type: 'added', text: newLine });
      }
    }
    return result;
  }
}
