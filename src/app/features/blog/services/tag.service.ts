import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { TagResponse, PageResponse } from '../../../models';

@Injectable({ providedIn: 'root' })
export class TagService {
  private api = inject(ApiService);

  getTags(): Observable<TagResponse[]> {
    return this.api.get<PageResponse<TagResponse>>('/tags', { page: 0, size: 50 })
      .pipe(map(response => response.content));
  }

  getTagBySlug(slug: string): Observable<TagResponse> {
    return this.api.get<TagResponse>(`/tags/${slug}`);
  }
}
