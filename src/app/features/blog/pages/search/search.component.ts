import { Component, inject, signal, OnInit, ChangeDetectionStrategy, PLATFORM_ID, DestroyRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, map } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SearchService } from '../../services/search.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ArticleCardComponent } from '../../../../shared/components/article-card/article-card.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ArticleSummaryResponse, SearchSuggestion } from '../../../../models';

@Component({
  selector: 'app-search',
  imports: [
    FormsModule,
    ArticleCardComponent,
    PaginationComponent,
    LoadingSpinnerComponent,
    EmptyStateComponent,
  ],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private searchService = inject(SearchService);
  readonly i18n = inject(I18nService);
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);
  private searchSubject = new Subject<string>();

  searchQuery = signal('');
  currentQuery = signal('');
  results = signal<ArticleSummaryResponse[]>([]);
  suggestions = signal<SearchSuggestion[]>([]);
  showSuggestions = signal(false);
  loading = signal(false);
  hasSearched = signal(false);

  currentPage = signal(0);
  pageSize = signal(10);
  totalPages = signal(0);
  totalElements = signal(0);

  ngOnInit(): void {
    // Setup debounced search for autocomplete
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((query) => {
        if (query.length >= 2) {
          this.loadSuggestions(query);
        } else {
          this.suggestions.set([]);
          this.showSuggestions.set(false);
        }
      });

    // Get initial query from URL
    this.route.queryParams.pipe(
      map(params => params['q'] || ''),
      distinctUntilChanged(),
      debounceTime(300),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((query) => {
      if (query) {
        this.searchQuery.set(query);
        this.search(query);
      }
    });
  }

  onSearchChange(query: string): void {
    this.searchSubject.next(query);
    if (query.length >= 3) {
      // Update URL — search is triggered via queryParams subscription
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { q: query },
        queryParamsHandling: 'merge',
      });
    }
  }

  search(query: string): void {
    this.loading.set(true);
    this.hasSearched.set(true);
    this.currentQuery.set(query);
    this.showSuggestions.set(false);

    this.searchService.search(query, this.currentPage(), this.pageSize()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.results.set(response.content);
        this.totalPages.set(response.totalPages);
        this.totalElements.set(response.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  loadSuggestions(query: string): void {
    this.searchService.getSuggestions(query).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (suggestions: string[]) => {
        const mapped: SearchSuggestion[] = suggestions.map(text => ({
          text,
          type: 'article' as const,
          slug: text.toLowerCase().replace(/\s+/g, '-'),
        }));
        this.suggestions.set(mapped);
        this.showSuggestions.set(mapped.length > 0);
      },
      error: () => {
        this.suggestions.set([]);
        this.showSuggestions.set(false);
      },
    });
  }

  selectSuggestion(suggestion: SearchSuggestion): void {
    const value = suggestion.text;
    this.searchQuery.set(value);
    this.showSuggestions.set(false);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: value },
    });
    this.search(value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.currentQuery.set('');
    this.results.set([]);
    this.hasSearched.set(false);
    this.suggestions.set([]);
    this.showSuggestions.set(false);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
    });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.search(this.currentQuery());
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
