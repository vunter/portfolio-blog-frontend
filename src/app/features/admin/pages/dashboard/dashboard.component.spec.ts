import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { ApiService } from '../../../../core/services/api.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { NotificationService } from '../../../../core/services/notification.service';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockApiService: jasmine.SpyObj<ApiService>;
  let mockNotification: jasmine.SpyObj<NotificationService>;

  const mockStats = {
    totalArticles: 25,
    publishedArticles: 20,
    draftArticles: 5,
    totalViews: 15000,
    totalComments: 120,
    pendingComments: 8,
    totalUsers: 10,
    totalTags: 15,
    newsletterSubscribers: 50,
  };

  const mockActivity = [
    { id: 1, type: 'article' as const, action: 'Created', title: 'Test Article', createdAt: '2026-02-10T10:00:00Z' },
    { id: 2, type: 'comment' as const, action: 'Approved', title: 'Nice post', createdAt: '2026-02-10T09:00:00Z' },
  ];

  beforeEach(async () => {
    mockApiService = jasmine.createSpyObj('ApiService', ['get', 'post', 'put', 'patch', 'delete']);
    mockNotification = jasmine.createSpyObj('NotificationService', ['success', 'error', 'warning', 'info']);

    // Default: return successful responses
    mockApiService.get.and.callFake(((endpoint: string) => {
      if (endpoint === '/admin/dashboard/stats') return of(mockStats);
      if (endpoint === '/admin/dashboard/activity') return of(mockActivity);
      return of({});
    }) as any);

    const mockI18n = {
      t: (key: string) => key,
      language: signal('en'),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: mockApiService },
        { provide: I18nService, useValue: mockI18n },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should start with loading true', () => {
    expect(component.loading()).toBeTrue();
  });

  it('should load dashboard data on init', fakeAsync(() => {
    fixture.detectChanges(); // triggers ngOnInit
    tick();

    expect(mockApiService.get).toHaveBeenCalledWith('/admin/dashboard/stats');
    expect(mockApiService.get).toHaveBeenCalledWith('/admin/dashboard/activity');
    expect(component.stats()).toEqual(mockStats);
    expect(component.recentActivity()).toEqual(mockActivity);
    expect(component.loading()).toBeFalse();
  }));

  it('should show stats values after loading', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(component.stats()?.totalArticles).toBe(25);
    expect(component.stats()?.publishedArticles).toBe(20);
    expect(component.stats()?.totalViews).toBe(15000);
  }));

  it('should render stat cards after loading', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const statCards = fixture.nativeElement.querySelectorAll('.stat-card');
    expect(statCards.length).toBe(8);
  }));

  it('should render quick action links', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const actionCards = fixture.nativeElement.querySelectorAll('.action-card');
    expect(actionCards.length).toBeGreaterThan(0);
  }));

  it('should render recent activity items', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const activityItems = fixture.nativeElement.querySelectorAll('.activity-item');
    expect(activityItems.length).toBe(2);
  }));

  it('should show error notification when stats load fails', fakeAsync(() => {
    mockApiService.get.and.callFake(((endpoint: string) => {
      if (endpoint === '/admin/dashboard/stats') return throwError(() => new Error('fail'));
      return of(mockActivity);
    }) as any);

    fixture.detectChanges();
    tick();

    expect(mockNotification.error).toHaveBeenCalled();
  }));

  it('should set error state when activity load fails', fakeAsync(() => {
    mockApiService.get.and.callFake(((endpoint: string) => {
      if (endpoint === '/admin/dashboard/activity') return throwError(() => new Error('fail'));
      return of(mockStats);
    }) as any);

    fixture.detectChanges();
    tick();

    expect(component.error()).toBeTrue();
    expect(component.loading()).toBeFalse();
  }));

  it('should format large numbers correctly', () => {
    expect(component.formatNumber(999)).toBe('999');
    expect(component.formatNumber(1500)).toBe('1.5K');
    expect(component.formatNumber(2500000)).toBe('2.5M');
  });

  it('should reload data when loadDashboardData is called', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    mockApiService.get.calls.reset();
    component.loadDashboardData();
    tick();

    expect(mockApiService.get).toHaveBeenCalledWith('/admin/dashboard/stats');
    expect(mockApiService.get).toHaveBeenCalledWith('/admin/dashboard/activity');
  }));
});
