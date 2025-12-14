import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { SearchResponse } from '../../../models';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private api = inject(ApiService);

  search(
    query: string,
    page = 0,
    size = 10,
    tags?: string[],
    sortBy?: string
  ): Observable<SearchResponse> {
    const params: Record<string, string | number> = {
      q: query,
      page,
      size,
    };

    if (tags && tags.length > 0) {
      params['tags'] = tags.join(',');
    }

    if (sortBy) {
      params['sortBy'] = sortBy;
    }

    return this.api.get<SearchResponse>('/search', params);
  }

  getSuggestions(query: string): Observable<string[]> {
    return this.api.get<string[]>('/search/suggestions', { q: query });
  }
}
