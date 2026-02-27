import { Injectable, inject } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ResumeProfile, ResumeProfileRequest } from '../../../models';

@Injectable({
  providedIn: 'root',
})
export class ResumeProfileService {
  private api = inject(ApiService);

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
    return this.api.getText('/resume/profile/generate-html', { locale });
  }

  downloadHtml(locale: string = 'en'): Observable<HttpResponse<Blob>> {
    return this.api.getBlobResponse('/resume/profile/download-html', { locale });
  }

  downloadPdf(locale: string = 'en'): Observable<HttpResponse<Blob>> {
    return this.api.getBlobResponse('/resume/profile/download-pdf', { locale });
  }

  /**
   * Translate the user's profile to the target language using DeepL API.
   * Returns the translated profile without saving it.
   */
  translateProfile(targetLang: string, sourceLang: string = 'en'): Observable<ResumeProfile> {
    return this.api.post<ResumeProfile>('/resume/profile/translate', null, { targetLang, sourceLang });
  }

  /**
   * Check if the translation service is available.
   */
  getTranslationStatus(): Observable<{ available: boolean; provider: string; supportedLanguages: string[] }> {
    return this.api.get<{ available: boolean; provider: string; supportedLanguages: string[] }>('/resume/profile/translate/status');
  }
}
