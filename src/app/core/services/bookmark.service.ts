import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class BookmarkService {
  private readonly STORAGE_KEY = 'bookmarked-articles';
  private readonly VISITOR_KEY = 'visitor-id';
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/${environment.apiVersion}/bookmarks`;

  /** Set of article slugs currently bookmarked */
  readonly bookmarks = signal<Set<string>>(this.loadBookmarks());
  readonly count = computed(() => this.bookmarks().size);

  constructor() {
    // Sync is triggered externally via init() (e.g., APP_INITIALIZER or root component)
  }

  /** Initialize backend sync. Call once after app bootstrap. */
  init(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.syncFromBackend();
    }
  }

  isBookmarked(slug: string): boolean {
    return this.bookmarks().has(slug);
  }

  toggle(slug: string): boolean {
    const current = new Set(this.bookmarks());
    const isNowBookmarked = !current.has(slug);

    // Optimistic update
    if (isNowBookmarked) {
      current.add(slug);
    } else {
      current.delete(slug);
    }
    this.bookmarks.set(current);
    this.persist(current);

    // Sync with backend
    if (isPlatformBrowser(this.platformId)) {
      const headers = this.visitorHeaders();
      if (isNowBookmarked) {
        this.http.post(`${this.baseUrl}/${slug}`, null, { headers }).subscribe({
          error: () => this.revertToggle(slug, false),
        });
      } else {
        this.http.delete(`${this.baseUrl}/${slug}`, { headers }).subscribe({
          error: () => this.revertToggle(slug, true),
        });
      }
    }

    return isNowBookmarked;
  }

  private revertToggle(slug: string, addBack: boolean): void {
    const reverted = new Set(this.bookmarks());
    if (addBack) {
      reverted.add(slug);
    } else {
      reverted.delete(slug);
    }
    this.bookmarks.set(reverted);
    this.persist(reverted);
  }

  /**
   * Sync local bookmarks with backend on startup.
   * Merges local + backend sets and pushes any local-only bookmarks to the server.
   */
  private syncFromBackend(): void {
    const headers = this.visitorHeaders();
    this.http
      .get<{ content: { slug: string }[] }>(this.baseUrl, {
        headers,
        params: { page: '0', size: '50' },
      })
      .subscribe({
        next: (response) => {
          const backendSlugs = new Set(response.content.map((a) => a.slug));
          const localSlugs = this.bookmarks();
          const merged = new Set([...localSlugs, ...backendSlugs]);
          this.bookmarks.set(merged);
          this.persist(merged);

          // Push local-only bookmarks to backend
          for (const slug of localSlugs) {
            if (!backendSlugs.has(slug)) {
              this.http.post(`${this.baseUrl}/${slug}`, null, { headers }).subscribe({
                error: () => { /* CQ-07: silently ignore sync failures — localStorage fallback works */ },
              });
            }
          }
        },
        error: () => {
          // Backend unavailable — localStorage-only is fine
        },
      });
  }

  private getVisitorId(): string {
    if (!isPlatformBrowser(this.platformId)) return '';
    let id = localStorage.getItem(this.VISITOR_KEY);
    if (!id) {
      // crypto.randomUUID() requires a secure context (HTTPS).
      // Fallback to crypto.getRandomValues for HTTP deployments.
      id = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map((b, i) => {
              // Insert hyphens at UUID positions (4-2-2-2-6)
              const hex = b.toString(16).padStart(2, '0');
              return [4, 6, 8, 10].includes(i) ? `-${hex}` : hex;
            })
            .join('');
      localStorage.setItem(this.VISITOR_KEY, id);
    }
    return id;
  }

  private visitorHeaders(): HttpHeaders {
    return new HttpHeaders({ 'X-Visitor-Id': this.getVisitorId() });
  }

  private loadBookmarks(): Set<string> {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (raw) return new Set(JSON.parse(raw));
      } catch {
        // Corrupted data — reset
      }
    }
    return new Set();
  }

  private persist(bookmarks: Set<string>): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify([...bookmarks]));
    }
  }
}
