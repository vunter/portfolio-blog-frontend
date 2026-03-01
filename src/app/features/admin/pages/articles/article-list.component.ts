import { Component, inject, signal, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MarkdownModule } from 'ngx-markdown';
import { ApiService } from '../../../../core/services/api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ArticleResponse, PageResponse } from '../../../../models';
import { getDateLocale } from '../../../../core/utils/date-format.util';

@Component({
  selector: 'app-admin-article-list',
  imports: [RouterLink, FormsModule, PaginationComponent, MarkdownModule],
  templateUrl: './article-list.component.html',
  styleUrl: './article-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleListComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private apiService = inject(ApiService);
  private notification = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  i18n = inject(I18nService);

  private searchSubject = new Subject<string>();

  articles = signal<ArticleResponse[]>([]);
  loading = signal(true);
  error = signal(false);
  previewingArticle = signal<ArticleResponse | null>(null);
  selectedIds = signal<Set<string>>(new Set());
  searchTerm = '';
  statusFilter = '';

  currentPage = signal(0);
  pageSize = signal(10);
  totalPages = signal(0);
  totalElements = signal(0);

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.currentPage.set(0);
      this.loadArticles();
    });
    this.loadArticles();
  }

  loadArticles(): void {
    this.loading.set(true);
    this.error.set(false);
    const params: Record<string, string> = {
      page: this.currentPage().toString(),
      size: this.pageSize().toString(),
    };
    if (this.searchTerm) params['search'] = this.searchTerm;
    if (this.statusFilter) params['status'] = this.statusFilter;

    this.apiService.get<PageResponse<ArticleResponse>>('/admin/articles', params).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.articles.set(response.content);
        this.totalPages.set(response.totalPages);
        this.totalElements.set(response.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
        this.notification.error(this.i18n.t('admin.error.loadArticles'));
      },
    });
  }

  onSearch(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadArticles();
  }

  async togglePublish(article: ArticleResponse): Promise<void> {
    const isPublished = article.status === 'PUBLISHED';
    const confirmMsg = isPublished
      ? this.i18n.t('admin.articles.confirmUnpublish').replace('{{title}}', article.title)
      : this.i18n.t('admin.articles.confirmPublish').replace('{{title}}', article.title);

    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('common.confirm'),
      message: confirmMsg,
      confirmText: this.i18n.t('common.confirm'),
      cancelText: this.i18n.t('common.cancel'),
      type: 'warning',
    });
    if (!confirmed) return;

    const endpoint = isPublished
      ? `/admin/articles/${article.id}/unpublish`
      : `/admin/articles/${article.id}/publish`;

    this.apiService.patch(endpoint, {}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(
          isPublished
            ? this.i18n.t('admin.articles.unpublishSuccess')
            : this.i18n.t('admin.articles.publishSuccess')
        );
        this.loadArticles();
      },
      error: () => {
        this.notification.error(
          isPublished
            ? this.i18n.t('admin.articles.unpublishError')
            : this.i18n.t('admin.articles.publishError')
        );
      },
    });
  }

  async deleteArticle(article: ArticleResponse): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('common.delete'),
      message: this.i18n.t('admin.articles.confirmDelete').replace('{{title}}', article.title),
      confirmText: this.i18n.t('common.delete'),
      cancelText: this.i18n.t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;

    this.apiService.delete(`/admin/articles/${article.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('admin.articles.deleteSuccess'));
        this.loadArticles();
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.articles.deleteError'));
      },
    });
  }

  toggleSelect(id: string): void {
    const current = new Set(this.selectedIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectedIds.set(current);
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.selectedIds.set(new Set());
    } else {
      this.selectedIds.set(new Set(this.articles().map(a => a.id)));
    }
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  isAllSelected(): boolean {
    const articles = this.articles();
    return articles.length > 0 && this.selectedIds().size === articles.length;
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  async bulkAction(status: string): Promise<void> {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('common.confirm'),
      message: this.i18n.t('admin.articles.bulkConfirm')
        .replace('{{count}}', ids.length.toString())
        .replace('{{status}}', this.getStatusLabel(status)),
      confirmText: this.i18n.t('common.confirm'),
      cancelText: this.i18n.t('common.cancel'),
      type: status === 'ARCHIVED' ? 'danger' : 'warning',
    });
    if (!confirmed) return;

    this.apiService.put('/admin/articles/bulk-status', { ids, status }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('admin.articles.bulkSuccess'));
        this.selectedIds.set(new Set());
        this.loadArticles();
      },
      error: () => {
        this.notification.error(this.i18n.t('admin.articles.bulkError'));
      },
    });
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PUBLISHED: this.i18n.t('admin.articles.published'),
      DRAFT: this.i18n.t('admin.articles.draft'),
      SCHEDULED: this.i18n.t('admin.articles.scheduled'),
      REVIEW: this.i18n.t('admin.articles.statusReview'),
      ARCHIVED: this.i18n.t('admin.articles.archived'),
    };
    return labels[status] || status;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(getDateLocale(this.i18n.language()));
  }

  previewArticle(article: ArticleResponse): void {
    this.previewingArticle.set(article);
  }

  closePreview(): void {
    this.previewingArticle.set(null);
  }
}
