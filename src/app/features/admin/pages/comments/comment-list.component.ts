import { Component, inject, signal, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, from, concatMap, toArray } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { AdminApiService } from '../../services/admin-api.service';
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
  /** Matches the backend's @Size(max = 100) on the bulk-moderation payload. */
  private static readonly BULK_CHUNK = 100;

  private destroyRef = inject(DestroyRef);
  private apiService = inject(ApiService);
  private adminApi = inject(AdminApiService);
  private notification = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);
  i18n = inject(I18nService);

  comments = signal<CommentResponse[]>([]);
  loading = signal(true);
  error = signal(false);
  statusFilter = '';
  searchQuery = signal('');
  // AUD19-B: article filter mode — when set, comments are loaded in a single
  // fetch (≤500) via GET /admin/comments/article/{id}; the status/search params
  // are not sent to the server and are instead applied client-side so that both
  // filters compose with the article filter.
  // AUD19C-02: the id is a Snowflake string — kept as string end-to-end (a
  // parseInt/Number round-trip corrupts ids above 2^53).
  articleFilter = signal<string | null>(null);
  articleFilterInput = '';
  selectedIds = signal<Set<string>>(new Set());
  currentPage = signal(0);
  pageSize = signal(10);
  totalPages = signal(0);
  totalElements = signal(0);

  // Q7.3: Debounced server-side search
  private searchSubject = new Subject<string>();

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((query) => {
      this.searchQuery.set(query);
      this.currentPage.set(0);
      this.loadComments();
    });

    this.loadComments();
  }

  onSearchInput(query: string): void {
    this.searchSubject.next(query);
  }

  loadComments(): void {
    this.error.set(false);
    const articleId = this.articleFilter();
    if (articleId !== null) {
      this.loadArticleComments(articleId);
      return;
    }
    const params: Record<string, string> = {
      page: this.currentPage().toString(),
      size: this.pageSize().toString(),
    };
    if (this.statusFilter) params['status'] = this.statusFilter;
    const q = this.searchQuery().trim();
    if (q) params['search'] = q;

    this.apiService.get<PageResponse<CommentResponse>>('/admin/comments', params).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.comments.set(response.content);
        this.totalPages.set(response.totalPages);
        this.totalElements.set(response.totalElements);
        this.loading.set(false);
        this.clearSelection();
      },
      error: () => {
        this.notification.error(this.i18n.t('dev.error.loadComments'));
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  // AUD19-B: single-fetch article mode. The backend endpoint returns full
  // CommentResponse objects (AdminCommentController#getCommentsByArticle maps
  // to the same DTO as the paged endpoint); the service's narrower AdminComment
  // typing is widened here.
  private loadArticleComments(articleId: string): void {
    this.adminApi.getCommentsByArticle(articleId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        let list = response as unknown as CommentResponse[];
        // Status + search compose client-side (list is capped at 500 rows).
        if (this.statusFilter) {
          list = list.filter(c => c.status === this.statusFilter);
        }
        const q = this.searchQuery().trim().toLowerCase();
        if (q) {
          list = list.filter(c =>
            c.content?.toLowerCase().includes(q) ||
            c.authorName?.toLowerCase().includes(q) ||
            c.articleTitle?.toLowerCase().includes(q)
          );
        }
        this.comments.set(list);
        // Single fetch — no server pagination in article mode.
        this.totalPages.set(1);
        this.totalElements.set(list.length);
        this.loading.set(false);
        this.clearSelection();
      },
      error: () => {
        this.notification.error(this.i18n.t('dev.error.loadComments'));
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  applyArticleFilter(): void {
    const id = this.articleFilterInput.trim();
    // AUD19C-02/05: validate the string without parsing it (Snowflake ids
    // overflow Number) and tell the admin about bad input instead of a
    // silent no-op.
    if (!/^\d+$/.test(id)) {
      this.notification.error(this.i18n.t('dev.comments.articleFilterInvalid'));
      return;
    }
    this.enterArticleMode(id);
  }

  // Drill-down from a comment row's article cell.
  filterByArticle(comment: CommentResponse): void {
    const id = (comment.articleId ?? '').trim();
    if (!/^\d+$/.test(id)) return;
    this.articleFilterInput = id;
    this.enterArticleMode(id);
  }

  private enterArticleMode(articleId: string): void {
    this.articleFilter.set(articleId);
    this.currentPage.set(0);
    this.loadComments();
  }

  clearArticleFilter(): void {
    this.articleFilter.set(null);
    this.articleFilterInput = '';
    this.currentPage.set(0);
    this.loadComments();
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
        // Q7.7: Undo for comment rejection
        this.notification.successWithUndo(this.i18n.t('dev.comments.rejectSuccess'), () => {
          this.apiService.put(`/admin/comments/${comment.id}/approve`, {}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => this.loadComments(),
            error: () => this.notification.error(this.i18n.t('dev.comments.approveError')),
          });
        });
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
      this.selectedIds.set(new Set(this.comments().map(c => c.id)));
    }
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  isAllSelected(): boolean {
    const comments = this.comments();
    return comments.length > 0 && this.selectedIds().size === comments.length;
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  async bulkAction(action: 'approve' | 'reject' | 'spam'): Promise<void> {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    const actionLabels: Record<string, string> = {
      approve: this.i18n.t('dev.comments.bulkApprove'),
      reject: this.i18n.t('dev.comments.bulkReject'),
      spam: this.i18n.t('dev.comments.bulkSpam'),
    };

    const confirmed = await this.confirmDialog.confirm({
      title: this.i18n.t('common.confirm'),
      message: this.i18n.t('dev.comments.bulkConfirm')
        .replace('{{action}}', actionLabels[action])
        .replace('{{count}}', ids.length.toString()),
      confirmText: this.i18n.t('common.confirm'),
      cancelText: this.i18n.t('common.cancel'),
      type: action === 'approve' ? 'warning' : 'danger',
    });
    if (!confirmed) return;

    // The API rejects more than BULK_CHUNK ids per request, and the per-article
    // view can select up to 500, so send them in sequential batches.
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += CommentListComponent.BULK_CHUNK) {
      batches.push(ids.slice(i, i + CommentListComponent.BULK_CHUNK));
    }

    from(batches)
      .pipe(
        concatMap((batch) => this.adminApi.bulkCommentAction(action, batch)),
        toArray(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notification.success(this.i18n.t('dev.comments.bulkSuccess'));
          this.clearSelection();
          this.loadComments();
        },
        error: () => {
          this.notification.error(this.i18n.t('dev.comments.bulkError'));
          // An earlier batch may have applied — reload so the list reflects reality.
          this.loadComments();
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
      SPAM: this.i18n.t('dev.comments.spam'),
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
