import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { getDateLocale } from '../../../../core/utils/date-format.util';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { CommentResponse, PageResponse } from '../../../../models';

@Component({
  selector: 'app-comment-list',
  imports: [FormsModule, PaginationComponent, SkeletonComponent],
  templateUrl: './comment-list.component.html',
  styleUrl: './comment-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentListComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private apiService = inject(ApiService);
  private notification = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  i18n = inject(I18nService);

  comments = signal<CommentResponse[]>([]);
  loading = signal(true);
  error = signal(false);
  statusFilter = '';
  searchQuery = signal('');
  filteredComments = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.comments();
    return this.comments().filter(c =>
      c.authorName?.toLowerCase().includes(q) ||
      c.content?.toLowerCase().includes(q) ||
      c.articleTitle?.toLowerCase().includes(q)
    );
  });
  currentPage = signal(0);
  pageSize = signal(10);
  totalPages = signal(0);
  totalElements = signal(0);

  ngOnInit(): void {
    this.loadComments();
  }

  loadComments(): void {
    this.error.set(false);
    const params: Record<string, string> = {
      page: this.currentPage().toString(),
      size: this.pageSize().toString(),
    };
    if (this.statusFilter) params['status'] = this.statusFilter;

    this.apiService.get<PageResponse<CommentResponse>>('/admin/comments', params).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.comments.set(response.content);
        this.totalPages.set(response.totalPages);
        this.totalElements.set(response.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.notification.error(this.i18n.t('dev.error.loadComments'));
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  approve(comment: CommentResponse): void {
    const snapshot = this.comments();
    this.comments.update(list => list.filter(c => c.id !== comment.id));

    this.apiService.put(`/admin/comments/${comment.id}/approve`, {}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('dev.comments.approveSuccess'));
      },
      error: () => {
        this.comments.set(snapshot);
        this.notification.error(this.i18n.t('dev.comments.approveError'));
      },
    });
  }

  async reject(comment: CommentResponse): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('dev.comments.rejectTitle'),
      message: this.i18n.t('dev.comments.rejectConfirmMessage'),
      confirmText: this.i18n.t('dev.comments.reject'),
      cancelText: this.i18n.t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;

    const snapshot = this.comments();
    this.comments.update(list => list.filter(c => c.id !== comment.id));

    this.apiService.put(`/admin/comments/${comment.id}/reject`, {}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('dev.comments.rejectSuccess'));
      },
      error: () => {
        this.comments.set(snapshot);
        this.notification.error(this.i18n.t('dev.comments.rejectError'));
      },
    });
  }

  async deleteComment(comment: CommentResponse): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('common.delete'),
      message: this.i18n.t('dev.comments.confirmDelete'),
      confirmText: this.i18n.t('common.delete'),
      cancelText: this.i18n.t('common.cancel'),
      type: 'danger',
    });
    if (!confirmed) return;

    const snapshot = this.comments();
    this.comments.update(list => list.filter(c => c.id !== comment.id));

    this.apiService.delete(`/admin/comments/${comment.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notification.success(this.i18n.t('dev.comments.deleteSuccess'));
      },
      error: () => {
        this.comments.set(snapshot);
        this.notification.error(this.i18n.t('dev.comments.deleteError'));
      },
    });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadComments();
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: this.i18n.t('dev.comments.pending'),
      APPROVED: this.i18n.t('dev.comments.approved'),
      REJECTED: this.i18n.t('dev.comments.rejected'),
    };
    return labels[status] || status;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(getDateLocale(this.i18n.language()), {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
