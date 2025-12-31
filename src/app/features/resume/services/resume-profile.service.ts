import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ResumeProfile, ResumeProfileRequest } from '../../../models';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ResumeProfileService {
  private api = inject(ApiService);
  // TODO F-323: Extend ApiService with getBlob()/getText() and remove direct HttpClient usage
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/${environment.apiVersion}`;

  getProfile(locale: string = 'en'): Observable<ResumeProfile> {
    return this.api.get<ResumeProfile>('/resume/profile', { locale });
  }

  profileExists(): Observable<boolean> {
    return this.api.get<boolean>('/resume/profile/exists');
  }

  listLocales(): Observable<string[]> {
    return this.api.get<string[]>('/resume/profile/locales');
  }

  saveProfile(request: ResumeProfileRequest, locale: string = 'en'): Observable<ResumeProfile> {
    return this.api.put<ResumeProfile>('/resume/profile', request, { locale });
  }

  generateHtml(locale: string = 'en'): Observable<string> {
    return this.http.get(`${this.baseUrl}/resume/profile/generate-html`, {
      responseType: 'text',
      params: { locale },
    });
  }

  downloadHtml(locale: string = 'en'): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.baseUrl}/resume/profile/download-html`, {
      responseType: 'blob',
      observe: 'response',
      params: { locale },
    });
  }

  downloadPdf(locale: string = 'en'): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.baseUrl}/resume/profile/download-pdf`, {
      responseType: 'blob',
      observe: 'response',
      params: { locale },
    });
  }

  /**
   * Translate the user's profile to the target language using DeepL API.
   * Returns the translated profile without saving it.
   */
  translateProfile(targetLang: string, sourceLang: string = 'en'): Observable<ResumeProfile> {
    return this.http.post<ResumeProfile>(
      `${this.baseUrl}/resume/profile/translate`,
      null,
      { params: { targetLang, sourceLang } }
    );
  }

  /**
   * Check if the translation service is available.
   */
  getTranslationStatus(): Observable<{ available: boolean; provider: string; supportedLanguages: string[] }> {
    return this.http.get<{ available: boolean; provider: string; supportedLanguages: string[] }>(
      `${this.baseUrl}/resume/profile/translate/status`
    );
  }
}
