import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ResumeService } from './resume.service';
import { ResumeTemplate, PdfGenerationRequest } from '../../../models';
import { environment } from '../../../../environments/environment';

describe('ResumeService', () => {
  let service: ResumeService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/${environment.apiVersion}`;

  const mockTemplate: ResumeTemplate = {
    id: 'tpl-1',
    name: 'Modern Resume',
    slug: 'modern-resume',
    htmlContent: '<h1>Resume</h1>',
    cssContent: 'h1 { color: blue; }',
    status: 'ACTIVE',
    paperSize: 'A4',
    orientation: 'PORTRAIT',
    isDefault: false,
    downloadCount: 10,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ResumeService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ResumeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getTemplates', () => {
    it('should GET /resume/templates and return content array', () => {
      const mockResponse = { content: [mockTemplate], totalElements: 1 };

      service.getTemplates().subscribe((templates) => {
        expect(templates).toEqual([mockTemplate]);
        expect(templates.length).toBe(1);
      });

      const req = httpMock.expectOne(`${baseUrl}/resume/templates`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should return empty array when content is null', () => {
      service.getTemplates().subscribe((templates) => {
        expect(templates).toEqual([]);
      });

      const req = httpMock.expectOne(`${baseUrl}/resume/templates`);
      req.flush({ content: null });
    });
  });

  describe('getTemplate', () => {
    it('should GET /resume/templates/:id', () => {
      service.getTemplate('tpl-1').subscribe((template) => {
        expect(template).toEqual(mockTemplate);
      });

      const req = httpMock.expectOne(`${baseUrl}/resume/templates/tpl-1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockTemplate);
    });
  });

  describe('createTemplate', () => {
    it('should POST /resume/templates with request body', () => {
      const input: Partial<ResumeTemplate> = {
        name: 'New Template',
        htmlContent: '<p>Hello</p>',
        description: 'A test template',
      };

      service.createTemplate(input).subscribe((result) => {
        expect(result).toEqual(mockTemplate);
      });

      const req = httpMock.expectOne(`${baseUrl}/resume/templates`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.name).toBe('New Template');
      expect(req.request.body.htmlContent).toBe('<p>Hello</p>');
      expect(req.request.body.description).toBe('A test template');
      req.flush(mockTemplate);
    });
  });

  describe('updateTemplate', () => {
    it('should PUT /resume/templates/:id with request body', () => {
      const input: Partial<ResumeTemplate> = {
        name: 'Updated Template',
        htmlContent: '<p>Updated</p>',
        paperSize: 'LETTER',
      };

      service.updateTemplate('tpl-1', input).subscribe((result) => {
        expect(result).toEqual(mockTemplate);
      });

      const req = httpMock.expectOne(`${baseUrl}/resume/templates/tpl-1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body.name).toBe('Updated Template');
      expect(req.request.body.paperSize).toBe('LETTER');
      req.flush(mockTemplate);
    });
  });

  describe('deleteTemplate', () => {
    it('should DELETE /resume/templates/:id', () => {
      service.deleteTemplate('tpl-1').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/resume/templates/tpl-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('duplicateTemplate', () => {
    it('should POST /resume/templates/:id/duplicate', () => {
      service.duplicateTemplate('tpl-1').subscribe((result) => {
        expect(result).toEqual(mockTemplate);
      });

      const req = httpMock.expectOne(`${baseUrl}/resume/templates/tpl-1/duplicate`);
      expect(req.request.method).toBe('POST');
      req.flush(mockTemplate);
    });
  });

  describe('generatePdf', () => {
    it('should POST /resume/pdf/generate with blob response', () => {
      const request: PdfGenerationRequest = {
        templateId: 'tpl-1',
        paperSize: 'A4',
      };

      service.generatePdf(request).subscribe((blob) => {
        expect(blob).toBeTruthy();
        expect(blob instanceof Blob).toBeTrue();
      });

      const req = httpMock.expectOne(`${baseUrl}/resume/pdf/generate`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.templateId).toBe('tpl-1');
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['pdf-content'], { type: 'application/pdf' }));
    });
  });

  describe('previewHtml', () => {
    it('should GET /resume/templates/:id/preview as text', () => {
      const htmlPreview = '<html><body>Preview</body></html>';

      service.previewHtml('tpl-1').subscribe((html) => {
        expect(html).toBe(htmlPreview);
      });

      const req = httpMock.expectOne(`${baseUrl}/resume/templates/tpl-1/preview`);
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('text');
      req.flush(htmlPreview);
    });
  });

  describe('applyProfileToTemplate', () => {
    it('should PUT /resume/templates/:id/apply-profile with lang param', () => {
      service.applyProfileToTemplate('tpl-1', 'pt').subscribe((result) => {
        expect(result).toEqual(mockTemplate);
      });

      const req = httpMock.expectOne(`${baseUrl}/resume/templates/tpl-1/apply-profile?lang=pt`);
      expect(req.request.method).toBe('PUT');
      req.flush(mockTemplate);
    });
  });
});
