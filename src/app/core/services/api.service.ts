import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
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
    // PERF-F-07: Only retry on network errors (status 0) and server errors (5xx).
    // 4xx client errors (400, 401, 403, 404, 409, 422) are thrown immediately
    // since retrying them is pointless and wastes bandwidth.
    return this.http.get<T>(`${this.baseUrl}${endpoint}`, { params }).pipe(
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

  post<T>(endpoint: string, body?: unknown, queryParams?: Record<string, string | number | boolean>): Observable<T> {
    let params = new HttpParams();
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        params = params.set(key, String(value));
      });
    }
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, body, { params });
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

  putResponse<T>(endpoint: string, body: unknown): Observable<HttpResponse<T>> {
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, body, { observe: 'response' });
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

  getText(endpoint: string, queryParams?: Record<string, string | number | boolean>): Observable<string> {
    let params = new HttpParams();
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        params = params.set(key, String(value));
      });
    }
    return this.http.get(`${this.baseUrl}${endpoint}`, { params, responseType: 'text' });
  }

  postText(endpoint: string, body: unknown): Observable<string> {
    return this.http.post(`${this.baseUrl}${endpoint}`, body, { responseType: 'text' });
  }

  getBlob(endpoint: string, queryParams?: Record<string, string | number | boolean>): Observable<Blob> {
    let params = new HttpParams();
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        params = params.set(key, String(value));
      });
    }
    return this.http.get(`${this.baseUrl}${endpoint}`, { params, responseType: 'blob' });
  }

  getBlobResponse(endpoint: string, queryParams?: Record<string, string | number | boolean>): Observable<HttpResponse<Blob>> {
    let params = new HttpParams();
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        params = params.set(key, String(value));
      });
    }
    return this.http.get(`${this.baseUrl}${endpoint}`, { params, responseType: 'blob', observe: 'response' });
  }

  postBlob(endpoint: string, body?: unknown): Observable<Blob> {
    return this.http.post(`${this.baseUrl}${endpoint}`, body, { responseType: 'blob' });
  }
}
