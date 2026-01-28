import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { TemplateListComponent } from './template-list.component';
import { ResumeService } from '../../services/resume.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { ResumeTemplate } from '../../../../models';

describe('TemplateListComponent', () => {
  let component: TemplateListComponent;
  let fixture: ComponentFixture<TemplateListComponent>;
  let mockResumeService: jasmine.SpyObj<ResumeService>;
  let mockNotification: jasmine.SpyObj<NotificationService>;
  let mockConfirmDialog: jasmine.SpyObj<ConfirmDialogService>;

  const mockTemplates: ResumeTemplate[] = [
    {
      id: 'tpl-1',
      name: 'Modern Resume',
      slug: 'modern-resume',
      htmlContent: '<h1>Resume</h1>',
      status: 'ACTIVE',
      paperSize: 'A4',
      orientation: 'PORTRAIT',
      isDefault: true,
      downloadCount: 5,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-02-01T00:00:00Z',
    },
    {
      id: 'tpl-2',
      name: 'Classic Resume',
      slug: 'classic-resume',
      htmlContent: '<h1>Classic</h1>',
      status: 'DRAFT',
      paperSize: 'A4',
      orientation: 'PORTRAIT',
      isDefault: false,
      downloadCount: 0,
      createdAt: '2026-01-15T00:00:00Z',
      updatedAt: '2026-02-05T00:00:00Z',
    },
  ];

  beforeEach(async () => {
    mockResumeService = jasmine.createSpyObj('ResumeService', [
      'getTemplates',
      'deleteTemplate',
      'duplicateTemplate',
      'generatePdf',
    ]);
    mockNotification = jasmine.createSpyObj('NotificationService', [
      'success',
      'error',
      'info',
      'warning',
    ]);
    mockConfirmDialog = jasmine.createSpyObj('ConfirmDialogService', ['confirm']);

    mockResumeService.getTemplates.and.returnValue(of(mockTemplates));

    const mockI18n = {
      t: (key: string) => key,
      language: signal('en'),
    };

    await TestBed.configureTestingModule({
      imports: [TemplateListComponent],
      providers: [
        provideRouter([]),
        { provide: ResumeService, useValue: mockResumeService },
        { provide: I18nService, useValue: mockI18n },
        { provide: NotificationService, useValue: mockNotification },
        { provide: ConfirmDialogService, useValue: mockConfirmDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TemplateListComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should start with loading true and empty templates', () => {
    expect(component.loading()).toBeTrue();
    expect(component.templates()).toEqual([]);
  });

  it('should load templates on init', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    expect(mockResumeService.getTemplates).toHaveBeenCalled();
    expect(component.templates()).toEqual(mockTemplates);
    expect(component.loading()).toBeFalse();
  }));

  it('should set loading to false on error', fakeAsync(() => {
    mockResumeService.getTemplates.and.returnValue(throwError(() => new Error('Network error')));

    fixture.detectChanges();
    tick();

    expect(component.loading()).toBeFalse();
    expect(component.templates()).toEqual([]);
  }));

  it('should render template cards after loading', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.template-card');
    expect(cards.length).toBe(2);
  }));

  it('should render empty state when no templates', fakeAsync(() => {
    mockResumeService.getTemplates.and.returnValue(of([]));

    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
  }));

  it('should duplicate a template and reload list', fakeAsync(() => {
    mockResumeService.duplicateTemplate.and.returnValue(of(mockTemplates[0]));
    fixture.detectChanges();
    tick();

    component.duplicateTemplate(mockTemplates[0]);
    tick();

    expect(mockResumeService.duplicateTemplate).toHaveBeenCalledWith('tpl-1');
    expect(mockNotification.success).toHaveBeenCalled();
    // getTemplates called twice: once on init, once after duplicate
    expect(mockResumeService.getTemplates).toHaveBeenCalledTimes(2);
  }));

  it('should show error notification on duplicate failure', fakeAsync(() => {
    mockResumeService.duplicateTemplate.and.returnValue(throwError(() => new Error('fail')));
    fixture.detectChanges();
    tick();

    component.duplicateTemplate(mockTemplates[0]);
    tick();

    expect(mockNotification.error).toHaveBeenCalled();
  }));

  it('should delete template after confirmation', fakeAsync(() => {
    mockConfirmDialog.confirm.and.returnValue(Promise.resolve(true));
    mockResumeService.deleteTemplate.and.returnValue(of(void 0));
    fixture.detectChanges();
    tick();

    component.deleteTemplate(mockTemplates[1]);
    tick();

    expect(mockConfirmDialog.confirm).toHaveBeenCalled();
    expect(mockResumeService.deleteTemplate).toHaveBeenCalledWith('tpl-2');
    expect(mockNotification.success).toHaveBeenCalled();
  }));

  it('should not delete template when confirmation is cancelled', fakeAsync(() => {
    mockConfirmDialog.confirm.and.returnValue(Promise.resolve(false));
    fixture.detectChanges();
    tick();

    component.deleteTemplate(mockTemplates[1]);
    tick();

    expect(mockResumeService.deleteTemplate).not.toHaveBeenCalled();
  }));

  it('should format date using locale', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    const formatted = component.formatDate('2026-02-01T00:00:00Z');
    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe('string');
  }));
});
