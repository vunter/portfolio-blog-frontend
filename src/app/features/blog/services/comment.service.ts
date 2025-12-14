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

  getCommentsPaged(articleSlug: string, page = 0, size = 20): Observable<PageResponse<CommentResponse>> {
    return this.api.get<PageResponse<CommentResponse>>(`/articles/${articleSlug}/comments`, { page, size });
  }

  getCommentCount(articleSlug: string): Observable<number> {
    return this.api.get<number>(`/articles/${articleSlug}/comments/count`);
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
