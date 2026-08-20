import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ContactListComponent } from './contact-list.component';
import { ApiService } from '../../../../core/services/api.service';
import { AdminApiService, ContactMessage } from '../../services/admin-api.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { ContactResponse } from '../../../../models/contact.model';
import { PageResponse } from '../../../../models/common.model';

describe('ContactListComponent', () => {
  let component: ContactListComponent;
  let fixture: ComponentFixture<ContactListComponent>;
  let mockApiService: jasmine.SpyObj<ApiService>;
  let mockAdminApi: jasmine.SpyObj<AdminApiService>;
  let mockNotification: jasmine.SpyObj<NotificationService>;
  let mockConfirmDialog: jasmine.SpyObj<ConfirmDialogService>;

  const listRow: ContactResponse = {
    id: 'm1',
    name: 'Alice',
    email: 'alice@example.com',
    subject: 'Hello',
    message: 'Truncated body from the list…',
    read: false,
    createdAt: '2026-08-10T10:00:00Z',
  };

  const freshCopy: ContactMessage = {
    id: 'm1',
    name: 'Alice',
    email: 'alice@example.com',
    subject: 'Hello',
    message: 'Full fresh body of the message, complete and untruncated.',
    read: true,
    createdAt: '2026-08-10T10:00:00Z',
  };

  const mockPageResponse: PageResponse<ContactResponse> = {
    content: [listRow],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true,
  };

  beforeEach(async () => {
    mockApiService = jasmine.createSpyObj('ApiService', ['get', 'post', 'put', 'delete']);
    mockAdminApi = jasmine.createSpyObj('AdminApiService', ['getContactMessage', 'markMessageAsRead']);
    mockNotification = jasmine.createSpyObj('NotificationService', ['success', 'error', 'warning', 'info']);
    mockConfirmDialog = jasmine.createSpyObj('ConfirmDialogService', ['confirm']);

    mockApiService.get.and.returnValue(of(mockPageResponse));
    mockAdminApi.getContactMessage.and.returnValue(of(freshCopy));
    mockAdminApi.markMessageAsRead.and.returnValue(of(freshCopy));
    mockConfirmDialog.confirm.and.returnValue(Promise.resolve(true));

    const mockI18n = {
      t: (key: string) => key,
      language: signal('en'),
    };

    await TestBed.configureTestingModule({
      imports: [ContactListComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: ApiService, useValue: mockApiService },
        { provide: AdminApiService, useValue: mockAdminApi },
        { provide: I18nService, useValue: mockI18n },
        { provide: NotificationService, useValue: mockNotification },
        { provide: ConfirmDialogService, useValue: mockConfirmDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactListComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load messages on init', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    expect(component.messages().length).toBe(1);
    expect(component.loading()).toBeFalse();
  }));

  describe('fresh detail fetch on expand', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      tick();
    }));

    it('should fetch the fresh copy when a message is expanded', fakeAsync(() => {
      component.toggleExpand('m1');
      tick();

      expect(mockAdminApi.getContactMessage).toHaveBeenCalledWith('m1');
      expect(component.freshMessage()).toEqual(jasmine.objectContaining({ id: 'm1', read: true }));
      expect(component.loadingDetail()).toBeFalse();
      expect(component.detailFetchFailed()).toBeFalse();
    }));

    it('should render the fresh body instead of the list row body', fakeAsync(() => {
      component.toggleExpand('m1');
      tick();
      fixture.detectChanges();

      const body = fixture.nativeElement.querySelector('.message-body');
      expect(body.textContent).toContain('Full fresh body');
      expect(body.textContent).not.toContain('Truncated body');
    }));

    it('should reconcile the list row with the fresh copy', fakeAsync(() => {
      component.toggleExpand('m1');
      tick();

      const row = component.messages().find((m) => m.id === 'm1')!;
      expect(row.read).toBeTrue();
      expect(row.message).toContain('Full fresh body');
    }));

    it('should fall back to the list row with a warning when the fetch fails', fakeAsync(() => {
      mockAdminApi.getContactMessage.and.returnValue(throwError(() => new Error('500')));

      component.toggleExpand('m1');
      tick();
      fixture.detectChanges();

      // Row stays expanded, rendering the stale list copy
      expect(component.expandedId()).toBe('m1');
      expect(component.detailFetchFailed()).toBeTrue();
      expect(component.freshMessage()).toBeNull();

      const body = fixture.nativeElement.querySelector('.message-body');
      expect(body.textContent).toContain('Truncated body');
      expect(fixture.nativeElement.querySelector('.detail-warning')).toBeTruthy();
    }));

    it('should show a shimmer while the fresh copy is loading', fakeAsync(() => {
      component.toggleExpand('m1');
      // Before the observable resolves in a real scenario loadingDetail is true;
      // with the synchronous mock it resolves immediately, so assert the final state
      // and verify the shimmer branch via the signal directly.
      component.loadingDetail.set(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.message-shimmer')).toBeTruthy();

      component.loadingDetail.set(false);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.message-shimmer')).toBeFalsy();
      tick();
    }));

    it('should clear the fresh copy when collapsed', fakeAsync(() => {
      component.toggleExpand('m1');
      tick();
      component.toggleExpand('m1');

      expect(component.expandedId()).toBeNull();
      expect(component.freshMessage()).toBeNull();
      expect(component.detailFetchFailed()).toBeFalse();
    }));
  });

  describe('mark as read', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      tick();
    }));

    it('should reuse the PUT response as the fresh copy (no extra GET)', fakeAsync(() => {
      component.toggleExpand('m1');
      tick();
      mockAdminApi.getContactMessage.calls.reset();

      component.markAsRead(listRow);
      tick();

      expect(mockAdminApi.markMessageAsRead).toHaveBeenCalledWith('m1');
      expect(mockAdminApi.getContactMessage).not.toHaveBeenCalled();
      expect(component.freshMessage()!.read).toBeTrue();
      expect(component.messages()[0].read).toBeTrue();
      expect(mockNotification.success).toHaveBeenCalled();
    }));

    it('should surface an error when marking as read fails', fakeAsync(() => {
      mockAdminApi.markMessageAsRead.and.returnValue(throwError(() => new Error('500')));

      component.markAsRead(listRow);
      tick();

      expect(mockNotification.error).toHaveBeenCalled();
    }));
  });
});
