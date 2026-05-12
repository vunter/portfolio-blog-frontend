import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { I18nService } from '../../../core/services/i18n.service';
import { SearchResponse } from '../../../models';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private api = inject(ApiService);
  private i18n = inject(I18nService);

  /** Q4.2: Passes current locale so backend can use locale-aware FTS */
  private get locale(): string {
    const lang = this.i18n.language();
    return lang === 'pt' ? 'pt-br' : lang;
  }

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
      locale: this.locale,
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
