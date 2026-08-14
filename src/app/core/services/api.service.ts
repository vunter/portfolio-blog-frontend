import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, of, throwError, MonoTypeOperatorFunction } from 'rxjs';
import { retry, timer, timeout, tap, shareReplay, finalize } from 'rxjs';
import { environment } from '../../../environments/environment';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/${environment.apiVersion}`;
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly inflight = new Map<string, Observable<unknown>>();
  private static readonly DEFAULT_CACHE_TTL = 60_000; // 1 minute

  /**
   * Q6.3: Retry operator for transient errors on IDEMPOTENT requests only.
   * Retries on network errors (status 0) and gateway errors (502/503/504).
   * Never retries 4xx (client errors) or 500 (server error — request may have been processed).
   *
   * Do NOT apply to POST: a 502/504/status-0 can mean the origin completed the
   * mutation while only the response was lost, so retrying a POST can create
   * duplicate comments/likes/submissions. PUT/PATCH/DELETE are idempotent and safe.
   */
  private retryTransient<T>(count = 1): MonoTypeOperatorFunction<T> {
    return retry({
      count,
      delay: (error, retryCount) => {
        if (error instanceof HttpErrorResponse) {
          if (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504) {
            return timer(retryCount * 1000);
          }
        }
        return throwError(() => error);
      },
    });
  }

  get<T>(endpoint: string, queryParams?: Record<string, string | number | boolean>): Observable<T> {
    let params = new HttpParams();
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        params = params.set(key, String(value));
      });
    }
    // PERF-F-07: Only retry on network errors (status 0) and server errors (5xx).
    // 4xx client errors (400, 401, 403, 404, 409, 422) are thrown immediately
    // since retrying them is pointless and wastes bandwidth.
    return this.http.get<T>(`${this.baseUrl}${endpoint}`, { params }).pipe(
      timeout(30000),
      retry({
        count: 2,
        delay: (error, retryCount) => {
          if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500) {
            return throwError(() => error);
          }
          return timer(retryCount * 1000);
        },
      })
    );
  }

  /**
   * Q6.2: Cached GET with stale-while-revalidate semantics.
   * Returns cached data immediately if within TTL; deduplicates in-flight requests.
   */
  cachedGet<T>(endpoint: string, queryParams?: Record<string, string | number | boolean>, ttlMs = ApiService.DEFAULT_CACHE_TTL): Observable<T> {
    const cacheKey = this.buildCacheKey(endpoint, queryParams);
    const cached = this.cache.get(cacheKey) as CacheEntry<T> | undefined;
    if (cached && Date.now() - cached.timestamp < ttlMs) {
      return of(cached.data);
    }
    const inflight = this.inflight.get(cacheKey) as Observable<T> | undefined;
    if (inflight) {
      return inflight;
    }
    const request$ = this.get<T>(endpoint, queryParams).pipe(
      tap(data => {
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
      }),
      finalize(() => this.inflight.delete(cacheKey)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.inflight.set(cacheKey, request$);
    return request$;
  }

  invalidateCache(endpointPrefix?: string): void {
    if (!endpointPrefix) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(endpointPrefix)) {
        this.cache.delete(key);
      }
    }
  }

  private buildCacheKey(endpoint: string, queryParams?: Record<string, string | number | boolean>): string {
    if (!queryParams) return endpoint;
    const sorted = Object.entries(queryParams).sort(([a], [b]) => a.localeCompare(b));
    return `${endpoint}?${sorted.map(([k, v]) => `${k}=${v}`).join('&')}`;
  }

  post<T>(endpoint: string, body?: unknown, queryParams?: Record<string, string | number | boolean>): Observable<T> {
    let params = new HttpParams();
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        params = params.set(key, String(value));
      });
    }
    // No retryTransient here: POST is not idempotent (see retryTransient docs).
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, body, { params }).pipe(timeout(30000));
  }

  put<T>(endpoint: string, body: unknown, queryParams?: Record<string, string | number | boolean>): Observable<T> {
    let params = new HttpParams();
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        params = params.set(key, String(value));
      });
    }
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, body, { params }).pipe(timeout(30000), this.retryTransient());
  }

  putResponse<T>(endpoint: string, body: unknown): Observable<HttpResponse<T>> {
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, body, { observe: 'response' }).pipe(timeout(30000), this.retryTransient());
  }

  patch<T>(endpoint: string, body?: unknown): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${endpoint}`, body).pipe(timeout(30000), this.retryTransient());
  }

  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${endpoint}`).pipe(timeout(30000), this.retryTransient());
  }

  /**
   * DELETE with a request body (e.g. re-authentication payloads).
   * No transient retry: callers of this variant perform sensitive, destructive
   * operations (account deletion) where an ambiguous network failure must
   * surface to the user instead of being silently retried.
   */
  deleteWithBody<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${endpoint}`, { body }).pipe(timeout(30000));
  }

  upload<T>(endpoint: string, file: File, fieldName = 'file'): Observable<T> {
    const formData = new FormData();
    formData.append(fieldName, file);
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, formData).pipe(timeout(30000));
  }

  getText(endpoint: string, queryParams?: Record<string, string | number | boolean>): Observable<string> {
    let params = new HttpParams();
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        params = params.set(key, String(value));
      });
    }
    return this.http.get(`${this.baseUrl}${endpoint}`, { params, responseType: 'text' }).pipe(timeout(30000));
  }

  postText(endpoint: string, body: unknown): Observable<string> {
    return this.http.post(`${this.baseUrl}${endpoint}`, body, { responseType: 'text' }).pipe(timeout(30000));
  }

  getBlob(endpoint: string, queryParams?: Record<string, string | number | boolean>): Observable<Blob> {
    let params = new HttpParams();
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        params = params.set(key, String(value));
      });
    }
    return this.http.get(`${this.baseUrl}${endpoint}`, { params, responseType: 'blob' }).pipe(timeout(30000));
  }

  getBlobResponse(endpoint: string, queryParams?: Record<string, string | number | boolean>): Observable<HttpResponse<Blob>> {
    let params = new HttpParams();
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        params = params.set(key, String(value));
      });
    }
    return this.http.get(`${this.baseUrl}${endpoint}`, { params, responseType: 'blob', observe: 'response' }).pipe(timeout(30000));
  }

  postBlob(endpoint: string, body?: unknown): Observable<Blob> {
    return this.http.post(`${this.baseUrl}${endpoint}`, body, { responseType: 'blob' }).pipe(timeout(30000));
  }
}
