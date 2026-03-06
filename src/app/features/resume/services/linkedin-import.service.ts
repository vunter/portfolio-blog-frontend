import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ResumeProfileRequest } from '../../../models';

@Injectable({ providedIn: 'root' })
export class LinkedInImportService {
  private api = inject(ApiService);

  getImportStatus(): Observable<{ enabled: boolean; note: string }> {
    return this.api.get<{ enabled: boolean; note: string }>('/resume/import/linkedin/status');
  }

  getImportResult(key: string): Observable<ResumeProfileRequest> {
    return this.api.get<ResumeProfileRequest>(`/resume/import/linkedin/result/${key}`);
  }

  startImport(): void {
    window.location.href = '/api/v1/resume/import/linkedin/authorize';
  }
}
