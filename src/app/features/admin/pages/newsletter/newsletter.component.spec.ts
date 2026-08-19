import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { NewsletterComponent } from './newsletter.component';
import { ApiService } from '../../../../core/services/api.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { DownloadService } from '../../../../core/services/download.service';
import { NewsletterSubscriber, PageResponse } from '../../../../models';

// AUD18-01: Newsletter admin page — contract alignment with the backend
// (SubscriberResponse.status enum, {confirmed,pending,total} stats,
// confirmed=true on batch delete).
describe('NewsletterComponent', () => {
  let component: NewsletterComponent;
  let fixture: ComponentFixture<NewsletterComponent>;
  let mockApiService: jasmine.SpyObj<ApiService>;
  let mockNotification: jasmine.SpyObj<NotificationService>;
  let mockConfirmDialog: jasmine.SpyObj<ConfirmDialogService>;
  let mockDownload: jasmine.SpyObj<DownloadService>;

  const mockSubscribers: NewsletterSubscriber[] = [
    {
      id: '1', email: 'confirmed@example.com', status: 'CONFIRMED',
      subscribedAt: '2026-01-10T10:00:00Z', confirmedAt: '2026-01-11T10:00:00Z',
      // AUD19C-08: linked to an account
      userId: '9007199254740993', linkedAt: '2026-08-12T10:00:00Z', linkOrigin: 'AUTO_REGISTER',
    },
    {
      id: '2', email: 'pending@example.com', status: 'PENDING',
      subscribedAt: '2026-02-01T10:00:00Z',
    },
    {
      id: '3', email: 'gone@example.com', status: 'UNSUBSCRIBED',
      subscribedAt: '2025-12-01T10:00:00Z', unsubscribedAt: '2026-01-15T10:00:00Z',
    },
  ];

  const mockPageResponse: PageResponse<NewsletterSubscriber> = {
    content: mockSubscribers,
    totalPages: 1,
    totalElements: 3,
    page: 0,
    size: 20,
    first: true,
    last: true,
  };

  const mockStats = { confirmed: 75, pending: 20, total: 95 };

  beforeEach(async () => {
    mockApiService = jasmine.createSpyObj('ApiService', ['get', 'post', 'delete', 'getText']);
    mockNotification = jasmine.createSpyObj('NotificationService', ['success', 'error', 'warning', 'info']);
    mockConfirmDialog = jasmine.createSpyObj('ConfirmDialogService', ['confirm']);
    mockDownload = jasmine.createSpyObj('DownloadService', ['downloadText']);

    mockApiService.get.and.callFake(((endpoint: string) =>
      endpoint === '/admin/newsletter/stats' ? of(mockStats) : of(mockPageResponse)
    ) as unknown as ApiService['get']);
    mockApiService.post.and.returnValue(of({ message: 'Subscribers deleted', count: 2, confirmed: true }));
    mockApiService.delete.and.returnValue(of(undefined));
    mockConfirmDialog.confirm.and.returnValue(Promise.resolve(true));

    const mockI18n = {
      t: (key: string) => key,
      language: signal('en'),
    };

    await TestBed.configureTestingModule({
      imports: [NewsletterComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: ApiService, useValue: mockApiService },
        { provide: I18nService, useValue: mockI18n },
        { provide: NotificationService, useValue: mockNotification },
        { provide: ConfirmDialogService, useValue: mockConfirmDialog },
        { provide: DownloadService, useValue: mockDownload },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewsletterComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should map backend stats {confirmed, pending, total} to signals', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    expect(component.totalSubscribers()).toBe(95);
    expect(component.confirmedSubscribers()).toBe(75);
    expect(component.pendingSubscribers()).toBe(20);
  }));

  it('should load subscribers on init', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    expect(component.subscribers().length).toBe(3);
    expect(component.loading()).toBeFalse();
  }));

  it('should render a three-state status badge from subscriber.status', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const badges = fixture.nativeElement.querySelectorAll('.status-badge');
    expect(badges.length).toBe(3);
    expect(badges[0].classList.contains('confirmed')).toBeTrue();
    expect(badges[0].textContent).toContain('admin.newsletter.statusConfirmed');
    expect(badges[1].classList.contains('pending')).toBeTrue();
    expect(badges[1].textContent).toContain('admin.newsletter.statusPending');
    expect(badges[2].classList.contains('confirmed')).toBeFalse();
    expect(badges[2].classList.contains('pending')).toBeFalse();
    expect(badges[2].textContent).toContain('admin.newsletter.statusUnsubscribed');
  }));

  // AUD19C-08: account-link column
  describe('account-link column', () => {
    it('should render a linked badge with tooltip for linked subscribers', fakeAsync(() => {
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

      const badges = fixture.nativeElement.querySelectorAll('.link-badge');
      expect(badges.length).toBe(1);
      expect(badges[0].textContent).toContain('admin.newsletter.linkedBadge');
      // Tooltip carries origin label + linked info
      expect(badges[0].getAttribute('title')).toContain('admin.newsletter.originAutoRegister');
      expect(badges[0].getAttribute('title')).toContain('admin.newsletter.linkedTooltip');
    }));

    it('should show a dash for unlinked subscribers', fakeAsync(() => {
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

      const dashes = fixture.nativeElement.querySelectorAll('.not-linked');
      expect(dashes.length).toBe(2);
      expect(dashes[0].textContent).toContain('admin.newsletter.notLinked');
    }));

    it('should fall back to the raw origin string for unknown origins', () => {
      expect(component.linkOriginLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
      expect(component.linkOriginLabel(undefined)).toBe('');
      expect(component.linkOriginLabel('MANUAL_USER')).toBe('admin.newsletter.originManualUser');
    });
  });

  it('should offer the real backend enum values as filter options', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const options = Array.from(
      fixture.nativeElement.querySelectorAll('select option')
    ).map((o) => (o as HTMLOptionElement).value);
    expect(options).toEqual(['', 'confirmed', 'pending', 'unsubscribed']);
  }));

  it('should pass the status filter to the subscribers request', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    mockApiService.get.calls.reset();

    component.statusFilter = 'pending';
    component.loadSubscribers();
    tick();

    const callArgs = mockApiService.get.calls.mostRecent().args;
    expect(callArgs[0]).toBe('/admin/newsletter/subscribers');
    expect((callArgs[1] as Record<string, string>)['status']).toBe('pending');
  }));

  it('should send confirmed=true on batch delete (not a dry-run)', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    component.selectedIds.set(['1', '2']);
    component.deleteSelected();
    tick();

    expect(mockApiService.post).toHaveBeenCalledWith(
      '/admin/newsletter/subscribers/delete-batch',
      { ids: ['1', '2'] },
      { confirmed: true }
    );
    expect(mockNotification.success).toHaveBeenCalled();
  }));

  it('should not batch delete when confirmation is cancelled', fakeAsync(() => {
    mockConfirmDialog.confirm.and.returnValue(Promise.resolve(false));
    fixture.detectChanges();
    tick();

    component.selectedIds.set(['1']);
    component.deleteSelected();
    tick();

    expect(mockApiService.post).not.toHaveBeenCalled();
  }));

  it('should set error state when loading subscribers fails', fakeAsync(() => {
    mockApiService.get.and.callFake(((endpoint: string) =>
      endpoint === '/admin/newsletter/stats'
        ? of(mockStats)
        : throwError(() => new Error('Network error'))
    ) as unknown as ApiService['get']);

    fixture.detectChanges();
    tick();

    expect(component.error()).toBeTrue();
    expect(component.loading()).toBeFalse();
    expect(mockNotification.error).toHaveBeenCalled();
  }));
});
