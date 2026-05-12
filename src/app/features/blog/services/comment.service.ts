import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { CommentResponse, CommentRequest, PageResponse } from '../../../models';

@Injectable({ providedIn: 'root' })
export class CommentService {
  private api = inject(ApiService);

  getComments(articleSlug: string, page = 0, size = 50): Observable<CommentResponse[]> {
    return this.api.get<PageResponse<CommentResponse>>(`/articles/${articleSlug}/comments`, { page, size }).pipe(
      map(response => response.content ?? [])
    );
  }

  getCommentsPaged(articleSlug: string, page = 0, size = 20, sort = 'recent'): Observable<PageResponse<CommentResponse>> {
    return this.api.get<PageResponse<CommentResponse>>(`/articles/${articleSlug}/comments`, { page, size, sort });
  }

  getCommentCount(articleSlug: string): Observable<number> {
    return this.api.get<number>(`/articles/${articleSlug}/comments/count`);
  }

  toggleCommentLike(articleSlug: string, commentId: string): Observable<{ liked: boolean; likesCount: number }> {
    return this.api.post<{ liked: boolean; likesCount: number }>(`/articles/${articleSlug}/comments/${commentId}/like`);
  }

  getCommentLikeStatus(articleSlug: string, commentId: string): Observable<{ liked: boolean; likesCount: number }> {
    return this.api.get<{ liked: boolean; likesCount: number }>(`/articles/${articleSlug}/comments/${commentId}/like/status`);
  }

  /** Batch like-status lookup — single round-trip for many commentIds. */
  batchCommentLikeStatus(
    articleSlug: string,
    commentIds: string[],
  ): Observable<Record<string, { liked: boolean; likesCount: number }>> {
    if (commentIds.length === 0) {
      return new Observable(sub => { sub.next({}); sub.complete(); });
    }
    // Backend expects numeric IDs; the comment-id strings round-trip cleanly through Long.
    return this.api.post<Record<string, { liked: boolean; likesCount: number }>>(
      `/articles/${articleSlug}/comments/like/status/batch`,
      { commentIds: commentIds.map(id => Number(id)) },
    );
  }

  createComment(
    articleSlug: string,
    request: CommentRequest
  ): Observable<CommentResponse> {
    return this.api.post<CommentResponse>(
      `/articles/${articleSlug}/comments`,
      request
    );
  }
}
