import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { retry, timer } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/${environment.apiVersion}`;

  get<T>(endpoint: string, queryParams?: Record<string, string | number | boolean>): Observable<T> {
    let params = new HttpParams();
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        params = params.set(key, String(value));
      });
    }
    // I-04: Retry GET requests on transient failures (network errors / 5xx)
    return this.http.get<T>(`${this.baseUrl}${endpoint}`, { params }).pipe(
      retry({ count: 2, delay: (_error, retryCount) => timer(retryCount * 1000) })
    );
  }

  post<T>(endpoint: string, body?: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, body);
  }

  put<T>(endpoint: string, body: unknown, queryParams?: Record<string, string | number | boolean>): Observable<T> {
    let params = new HttpParams();
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        params = params.set(key, String(value));
      });
    }
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, body, { params });
  }

  patch<T>(endpoint: string, body?: unknown): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${endpoint}`, body);
  }

  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${endpoint}`);
  }

  upload<T>(endpoint: string, file: File, fieldName = 'file'): Observable<T> {
    const formData = new FormData();
    formData.append(fieldName, file);
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, formData);
  }

  getText(endpoint: string): Observable<string> {
    return this.http.get(`${this.baseUrl}${endpoint}`, { responseType: 'text' });
  }
}
