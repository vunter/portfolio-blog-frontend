import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { TagResponse } from '../../../models';

@Injectable({ providedIn: 'root' })
export class TagService {
  private api = inject(ApiService);

  getTags(): Observable<TagResponse[]> {
    return this.api.get<TagResponse[]>('/tags');
  }

  getTagBySlug(slug: string): Observable<TagResponse> {
    return this.api.get<TagResponse>(`/tags/${slug}`);
  }
}
