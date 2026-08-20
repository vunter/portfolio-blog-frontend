import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { UserListComponent } from './user-list.component';
import { ApiService } from '../../../../core/services/api.service';
import { AdminApiService, UserActivity } from '../../services/admin-api.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { UserResponse, PageResponse } from '../../../../models';

describe('UserListComponent', () => {
  let component: UserListComponent;
  let fixture: ComponentFixture<UserListComponent>;
  let mockApiService: jasmine.SpyObj<ApiService>;
  let mockAdminApi: jasmine.SpyObj<AdminApiService>;
  let mockNotification: jasmine.SpyObj<NotificationService>;
  let mockConfirmDialog: jasmine.SpyObj<ConfirmDialogService>;

  const mockUser: UserResponse = {
    id: '1',
    username: 'alice',
    email: 'alice@example.com',
    name: 'Alice',
    role: 'ADMIN',
    active: true,
    emailVerified: true,
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-08-01T10:00:00Z',
  } as UserResponse;

  const mockPageResponse: PageResponse<UserResponse> = {
    content: [mockUser],
    page: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true,
  };

  const mockActivity: UserActivity = {
    lastLogin: '2026-08-15T08:00:00Z',
    accountCreated: '2026-01-10T10:00:00Z',
    articlesCreated: 7,
    commentsPosted: 3,
  };

  beforeEach(async () => {
    mockApiService = jasmine.createSpyObj('ApiService', ['get', 'post', 'put', 'delete']);
    mockAdminApi = jasmine.createSpyObj('AdminApiService', ['getUserById']);
    mockNotification = jasmine.createSpyObj('NotificationService', ['success', 'error', 'warning', 'info', 'successWithUndo']);
    mockConfirmDialog = jasmine.createSpyObj('ConfirmDialogService', ['confirm']);

    // ApiService.get is generic — cast the fake, whose return type depends on the URL.
    mockApiService.get.and.callFake(((url: string) => {
      if (url.endsWith('/activity')) return of(mockActivity);
      return of(mockPageResponse);
    }) as unknown as ApiService['get']);
    mockAdminApi.getUserById.and.returnValue(of(mockUser));
    mockConfirmDialog.confirm.and.returnValue(Promise.resolve(true));

    const mockI18n = {
      t: (key: string) => key,
      language: signal('en'),
    };

    await TestBed.configureTestingModule({
      imports: [UserListComponent],
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

    fixture = TestBed.createComponent(UserListComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load users on init', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    expect(component.users().length).toBe(1);
    expect(component.loading()).toBeFalse();
  }));

  describe('detail drawer (activity modal + fresh profile)', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      tick();
    }));

    it('should fetch activity and fresh profile independently when opened', fakeAsync(() => {
      component.viewActivity('1');
      tick();

      expect(mockApiService.get).toHaveBeenCalledWith('/admin/users/1/activity');
      // AUD19C-02: the Snowflake id string is passed through untouched
      expect(mockAdminApi.getUserById).toHaveBeenCalledWith('1');
      expect(component.showActivityModal()).toBeTrue();
      expect(component.selectedUserActivity()).toEqual(mockActivity);
      expect(component.selectedUserDetail()).toEqual(mockUser);
      expect(component.activityError()).toBeFalse();
      expect(component.detailError()).toBeFalse();
      expect(component.loadingActivity()).toBeFalse();
      expect(component.loadingDetail()).toBeFalse();
    }));

    it('should render profile fields above the activity block', fakeAsync(() => {
      component.viewActivity('1');
      tick();
      fixture.detectChanges();

      const sections = fixture.nativeElement.querySelectorAll('.detail-section-title');
      expect(sections.length).toBe(2);
      expect(sections[0].textContent).toContain('admin.users.detail.profile');
      expect(sections[1].textContent).toContain('admin.users.activity.title');

      const values = Array.from(fixture.nativeElement.querySelectorAll('.activity-item__value'))
        .map((el) => (el as HTMLElement).textContent?.trim());
      expect(values).toContain('alice@example.com');
    }));

    it('should keep the modal open with a per-section error when the profile fetch fails', fakeAsync(() => {
      mockAdminApi.getUserById.and.returnValue(throwError(() => new Error('404')));

      component.viewActivity('1');
      tick();
      fixture.detectChanges();

      expect(component.showActivityModal()).toBeTrue();
      expect(component.detailError()).toBeTrue();
      // Activity still succeeded and is displayed
      expect(component.selectedUserActivity()).toEqual(mockActivity);
      expect(component.activityError()).toBeFalse();
      expect(fixture.nativeElement.querySelector('.section-error')).toBeTruthy();
    }));

    it('should keep the modal open with a per-section error when the activity fetch fails', fakeAsync(() => {
      mockApiService.get.and.callFake(((url: string) => {
        if (url.endsWith('/activity')) return throwError(() => new Error('500'));
        return of(mockPageResponse);
      }) as unknown as ApiService['get']);

      component.viewActivity('1');
      tick();
      fixture.detectChanges();

      expect(component.showActivityModal()).toBeTrue();
      expect(component.activityError()).toBeTrue();
      // Profile still succeeded and is displayed
      expect(component.selectedUserDetail()).toEqual(mockUser);
      expect(component.detailError()).toBeFalse();
      expect(fixture.nativeElement.querySelector('.section-error')).toBeTruthy();
    }));

    it('should reset all detail state when closed', fakeAsync(() => {
      component.viewActivity('1');
      tick();

      component.closeActivityModal();

      expect(component.showActivityModal()).toBeFalse();
      expect(component.selectedUserActivity()).toBeNull();
      expect(component.selectedUserDetail()).toBeNull();
      expect(component.activityError()).toBeFalse();
      expect(component.detailError()).toBeFalse();
    }));
  });
});
