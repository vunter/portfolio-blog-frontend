import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgOptimizedImage } from '@angular/common';
import { I18nService } from '../../../../core/services/i18n.service';
import { getDateLocale } from '../../../../core/utils/date-format.util';
import { ApiService } from '../../../../core/services/api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { PageResponse } from '../../../../models/common.model';
import { ArticleResponse } from '../../../../models/article.model';
import { RouterLink } from '@angular/router';

interface ReadingHistoryItem {
  article: ArticleResponse;
  lastReadAt: string;
  readCount: number;
}

@Component({
  selector: 'app-reading-history',
  imports: [RouterLink, NgOptimizedImage],
  templateUrl: './reading-history.component.html',
  styleUrl: './reading-history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReadingHistoryComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private apiService = inject(ApiService);
  private notification = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  i18n = inject(I18nService);

  private readonly endpoint = '/admin/reading-history';
  private readonly pageSize = 20;

  items = signal<ReadingHistoryItem[]>([]);
  loading = signal(true);
  error = signal(false);
  currentPage = signal(0);
  totalElements = signal(0);
  totalPages = signal(0);

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(page = 0): void {
    this.loading.set(true);
    this.error.set(false);
    this.apiService.get<PageResponse<ReadingHistoryItem>>(this.endpoint, {
      page,
      size: this.pageSize,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.items.set(response.content);
        this.currentPage.set(response.page);
        this.totalElements.set(response.totalElements);
        this.totalPages.set(response.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('account.readingHistory.loadError'));
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.loadHistory(page);
  }

  async clearHistory(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('account.readingHistory.clearHistory'),
      message: this.i18n.t('account.readingHistory.confirmClear'),
      confirmText: this.i18n.t('account.readingHistory.clearHistory'),
      cancelText: this.i18n.t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;

    this.apiService.delete(this.endpoint).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.items.set([]);
        this.totalElements.set(0);
        this.totalPages.set(0);
        this.currentPage.set(0);
        this.notification.success(this.i18n.t('account.readingHistory.cleared'));
      },
      error: () => {
        this.notification.error(this.i18n.t('account.readingHistory.clearError'));
      },
    });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(
      getDateLocale(this.i18n.language()),
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    );
  }
}
