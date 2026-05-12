import {
  Component,
  inject,
  input,
  output,
  signal,
  effect,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommentService } from '../../../../services/comment.service';
import { NotificationService } from '../../../../../../core/services/notification.service';
import { I18nService } from '../../../../../../core/services/i18n.service';
import { RecaptchaService } from '../../../../../../core/services/recaptcha.service';
import { AuthStore } from '../../../../../../core/auth/auth.store';
import { LoadingSpinnerComponent } from '../../../../../../shared/components/loading-spinner/loading-spinner.component';
import { getInitials } from '../../../../../../shared/utils/string.utils';
import { CommentResponse } from '../../../../../../models';

@Component({
  selector: 'app-article-comments',
  imports: [FormsModule, DatePipe, RouterLink, LoadingSpinnerComponent],
  templateUrl: './article-comments.component.html',
  styleUrl: './article-comments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleCommentsComponent {
  private readonly commentService = inject(CommentService);
  private readonly notification = inject(NotificationService);
  private readonly recaptcha = inject(RecaptchaService);
  private readonly destroyRef = inject(DestroyRef);
  readonly i18n = inject(I18nService);
  readonly authStore = inject(AuthStore);

  /** Article slug for API calls */
  readonly articleSlug = input.required<string>();
  /** Article ID for optimistic comment creation */
  readonly articleId = input.required<string>();
  /** Article title for optimistic comment creation */
  readonly articleTitle = input.required<string>();
  /** Date locale for formatting */
  readonly dateLocale = input<string>('en-US');
  /** Emitted when the total comment count changes (for parent display) */
  readonly commentCountChange = output<number>();

  comments = signal<CommentResponse[]>([]);
  commentPage = signal(0);
  commentTotalElements = signal(0);
  hasMoreComments = signal(false);
  loadingMoreComments = signal(false);
  commentSort = signal<string>('liked');
  commentLiked = signal<Record<string, boolean>>({});

  // Comment form signals
  commentContent = signal('');
  submittingComment = signal(false);

  // Reply form signals
  replyingTo = signal<CommentResponse | null>(null);
  /** Top-level parent id sent to the API (the backend stores all replies as siblings under the root). */
  replyParentId = signal<string | null>(null);
  /** Id of the comment the user actually clicked "Reply" on — used to nest the optimistic UI correctly. */
  replyDirectParentId = signal<string | null>(null);
  replyContent = signal('');
  submittingReply = signal(false);

  // Q8.8: Debounce map for comment like operations
  private readonly pendingLikes = new Map<number | string, ReturnType<typeof setTimeout>>();

  readonly getInitials = getInitials;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.pendingLikes.forEach(timer => clearTimeout(timer));
      this.pendingLikes.clear();
    });

    // Auto-load comments when article slug is set/changes
    effect(() => {
      const slug = this.articleSlug();
      if (slug) {
        this.loadComments();
      }
    });
  }

  loadComments(): void {
    const slug = this.articleSlug();
    this.commentPage.set(0);
    const sort = this.commentSort();
    this.commentService.getCommentsPaged(slug, 0, 20, sort).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.comments.set(response.content ?? []);
        this.commentTotalElements.set(response.totalElements);
        this.commentCountChange.emit(response.totalElements);
        this.hasMoreComments.set(response.page < response.totalPages - 1);
        this.commentPage.set(response.page);
        if (this.authStore.isAuthenticated()) {
          this.loadCommentLikeStatuses(response.content ?? []);
        }
      },
      error: () => {
        this.comments.set([]);
        this.commentTotalElements.set(0);
        this.hasMoreComments.set(false);
      },
    });
  }

  loadMoreComments(): void {
    const slug = this.articleSlug();
    if (!slug || this.loadingMoreComments()) return;
    this.loadingMoreComments.set(true);
    const nextPage = this.commentPage() + 1;
    const sort = this.commentSort();
    this.commentService.getCommentsPaged(slug, nextPage, 20, sort).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.comments.update(prev => [...prev, ...(response.content ?? [])]);
        this.commentPage.set(response.page);
        this.hasMoreComments.set(response.page < response.totalPages - 1);
        this.loadingMoreComments.set(false);
        if (this.authStore.isAuthenticated()) {
          this.loadCommentLikeStatuses(response.content ?? []);
        }
      },
      error: () => {
        this.loadingMoreComments.set(false);
      },
    });
  }

  onCommentSortChange(sort: string): void {
    this.commentSort.set(sort);
    this.loadComments();
  }

  toggleCommentLike(comment: CommentResponse): void {
    const slug = this.articleSlug();
    if (!slug) return;
    if (!this.authStore.isAuthenticated()) {
      this.notification.warning(this.i18n.t('blog.loginToLike'));
      return;
    }
    // Q8.8: Optimistic UI update
    const wasLiked = this.commentLiked()[comment.id] || false;
    this.commentLiked.update(map => ({ ...map, [comment.id]: !wasLiked }));
    this.updateCommentLikeCount(comment.id, wasLiked ? -1 : 1);

    // Q8.8: Cancel any pending backend call for this comment
    const pending = this.pendingLikes.get(comment.id);
    if (pending) clearTimeout(pending);

    // Q8.8: Debounce the backend call — only send final state after 500ms
    this.pendingLikes.set(comment.id, setTimeout(() => {
      this.pendingLikes.delete(comment.id);
      this.commentService.toggleCommentLike(slug, comment.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res) => {
          this.commentLiked.update(map => ({ ...map, [comment.id]: res.liked }));
          this.updateCommentLikeCount(comment.id, 0, res.likesCount);
        },
        error: () => {
          this.commentLiked.update(map => ({ ...map, [comment.id]: wasLiked }));
          this.updateCommentLikeCount(comment.id, wasLiked ? 0 : -1);
        },
      });
    }, 500));
  }

  submitComment(): void {
    const slug = this.articleSlug();
    const content = this.commentContent().trim();
    const user = this.authStore.user();

    if (!slug || !user || content.length < 10) return;

    const name = user.name || user.username || 'User';
    const email = user.email || '';

    this.submittingComment.set(true);

    this.recaptcha.execute('comment').then(recaptchaToken => {
      this.commentService
        .createComment(slug, {
          content,
          authorName: name,
          authorEmail: email,
          recaptchaToken: recaptchaToken ?? undefined,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (created) => {
            const optimistic: CommentResponse = {
              id: created?.id || crypto.randomUUID(),
              articleId: this.articleId(),
              articleSlug: slug,
              articleTitle: this.articleTitle(),
              authorName: name,
              authorEmail: email,
              content,
              status: 'APPROVED',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            this.comments.update(list => [optimistic, ...list]);
            this.commentTotalElements.update(n => n + 1);
            this.commentCountChange.emit(this.commentTotalElements());
            this.commentContent.set('');
            this.submittingComment.set(false);
            this.notification.success(this.i18n.t('article.comments.submitted'));
          },
          error: () => {
            this.submittingComment.set(false);
            this.notification.error(this.i18n.t('blog.failedToComment'));
          },
        });
    }).catch(() => {
      this.submittingComment.set(false);
      this.notification.error(this.i18n.t('blog.failedToComment'));
    });
  }

  startReply(comment: CommentResponse, rootParentId?: string): void {
    this.replyingTo.set(comment);
    // rootParentId is the top-level ancestor (for the API); comment.id is the direct parent (for the UI).
    this.replyParentId.set(rootParentId || comment.id);
    this.replyDirectParentId.set(comment.id);
    this.replyContent.set('');
  }

  cancelReply(): void {
    this.replyingTo.set(null);
    this.replyParentId.set(null);
    this.replyDirectParentId.set(null);
    this.replyContent.set('');
  }

  submitReply(): void {
    const slug = this.articleSlug();
    const parentId = this.replyParentId();          // sent to API
    const directParentId = this.replyDirectParentId() || parentId; // used to position optimistic UI
    const user = this.authStore.user();
    if (!slug || !parentId || !directParentId || !user) return;

    const name = user.name || user.username || 'User';
    const content = this.replyContent().trim();
    if (content.length < 10) return;

    const optimisticId = crypto.randomUUID();
    const optimisticReply: CommentResponse = {
      id: optimisticId,
      articleId: this.articleId(),
      articleSlug: slug,
      articleTitle: this.articleTitle(),
      authorName: name,
      authorEmail: user.email || '',
      content,
      status: 'APPROVED',
      parentId,
      replies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Insert under the comment the user actually clicked Reply on, at any nesting depth.
    const insertReply = (list: CommentResponse[]): CommentResponse[] =>
      list.map(c => {
        if (c.id === directParentId) {
          return { ...c, replies: [...(c.replies || []), optimisticReply] };
        }
        if (c.replies?.length) {
          return { ...c, replies: insertReply(c.replies) };
        }
        return c;
      });
    const removeReply = (list: CommentResponse[]): CommentResponse[] =>
      list.map(c => {
        if (c.id === directParentId) {
          return { ...c, replies: (c.replies || []).filter(r => r.id !== optimisticId) };
        }
        if (c.replies?.length) {
          return { ...c, replies: removeReply(c.replies) };
        }
        return c;
      });

    this.comments.update(insertReply);
    this.cancelReply();

    this.recaptcha.execute('comment').then(recaptchaToken => {
      this.commentService
        .createComment(slug, {
          authorName: name,
          authorEmail: user.email || '',
          content,
          parentId,
          recaptchaToken: recaptchaToken ?? undefined,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          error: () => {
            this.comments.update(removeReply);
            this.notification.error(this.i18n.t('blog.failedToComment'));
          },
        });
    }).catch(() => {
      this.comments.update(removeReply);
      this.notification.error(this.i18n.t('blog.failedToComment'));
    });
  }

  private updateCommentLikeCount(commentId: string, delta: number, absolute?: number): void {
    // Always descend into replies regardless of whether the parent matched, so the update
    // works at any nesting depth (top-level, replies, replies-of-replies).
    const updateInList = (list: CommentResponse[]): CommentResponse[] =>
      list.map(c => {
        const updatedReplies = c.replies?.length ? updateInList(c.replies) : c.replies;
        if (c.id === commentId) {
          return {
            ...c,
            likesCount: absolute !== undefined ? absolute : (c.likesCount || 0) + delta,
            replies: updatedReplies,
          };
        }
        return c.replies?.length ? { ...c, replies: updatedReplies } : c;
      });
    this.comments.update(prev => updateInList(prev));
  }

  private loadCommentLikeStatuses(comments: CommentResponse[]): void {
    const slug = this.articleSlug();
    if (!slug) return;
    // Skip ids we've already resolved to avoid redundant traffic on "Load More".
    const known = this.commentLiked();
    const ids = this.flattenComments(comments)
      .map(c => c.id)
      .filter(id => known[id] === undefined);
    if (ids.length === 0) return;

    // Single round-trip instead of one HTTP call per comment.
    this.commentService.batchCommentLikeStatus(slug, ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (statuses) => {
          this.commentLiked.update(map => {
            const next = { ...map };
            for (const [id, info] of Object.entries(statuses)) {
              next[id] = info.liked;
            }
            return next;
          });
        },
        error: () => {},
      });
  }

  private flattenComments(comments: CommentResponse[]): CommentResponse[] {
    const result: CommentResponse[] = [];
    for (const c of comments) {
      result.push(c);
      if (c.replies?.length) {
        result.push(...this.flattenComments(c.replies));
      }
    }
    return result;
  }
}
