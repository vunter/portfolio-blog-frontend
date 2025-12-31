import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ResumeTemplate, ResumeTemplateRequest, PdfGenerationRequest, PageResponse } from '../../../models';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ResumeService {
  private api = inject(ApiService);
  // TODO F-322: Extend ApiService with getBlob()/getText() and remove direct HttpClient usage
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/${environment.apiVersion}`;

  getTemplates(): Observable<ResumeTemplate[]> {
    return this.api.get<PageResponse<ResumeTemplate>>('/resume/templates').pipe(
      map(response => response.content ?? [])
    );
  }

  getTemplate(id: string): Observable<ResumeTemplate> {
    return this.api.get<ResumeTemplate>(`/resume/templates/${id}`);
  }

  createTemplate(template: Partial<ResumeTemplate>): Observable<ResumeTemplate> {
    const request: ResumeTemplateRequest = {
      name: template.name ?? '',
      htmlContent: template.htmlContent ?? '',
      alias: template.alias,
      description: template.description,
      cssContent: template.cssContent,
      status: template.status,
      paperSize: template.paperSize,
      orientation: template.orientation,
      isDefault: template.isDefault,
    };
    return this.api.post<ResumeTemplate>('/resume/templates', request);
  }

  updateTemplate(id: string, template: Partial<ResumeTemplate>): Observable<ResumeTemplate> {
    const request: ResumeTemplateRequest = {
      name: template.name ?? '',
      htmlContent: template.htmlContent ?? '',
      alias: template.alias,
      description: template.description,
      cssContent: template.cssContent,
      status: template.status,
      paperSize: template.paperSize,
      orientation: template.orientation,
      isDefault: template.isDefault,
    };
    return this.api.put<ResumeTemplate>(`/resume/templates/${id}`, request);
  }

  deleteTemplate(id: string): Observable<void> {
    return this.api.delete<void>(`/resume/templates/${id}`);
  }

  duplicateTemplate(id: string): Observable<ResumeTemplate> {
    return this.api.post<ResumeTemplate>(`/resume/templates/${id}/duplicate`, {});
  }

  applyProfileToTemplate(id: string, lang: string = 'en'): Observable<ResumeTemplate> {
    return this.api.put<ResumeTemplate>(`/resume/templates/${id}/apply-profile?lang=${lang}`, {});
  }

  generatePdf(request: PdfGenerationRequest): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/resume/pdf/generate`, request, {
      responseType: 'blob',
    });
  }

  previewHtml(templateId: string): Observable<string> {
    return this.http.get(`${this.baseUrl}/resume/templates/${templateId}/preview`, {
      responseType: 'text',
    });
  }
}
