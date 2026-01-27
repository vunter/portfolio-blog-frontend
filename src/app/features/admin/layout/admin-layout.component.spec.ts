import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component, signal } from '@angular/core';
import { AdminLayoutComponent } from './admin-layout.component';
import { AuthStore } from '../../../core/auth/auth.store';
import { ThemeService } from '../../../core/services/theme.service';
import { I18nService } from '../../../core/services/i18n.service';
import { RealtimeNotificationService } from '../services/realtime-notification.service';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';
import { BreadcrumbsComponent } from '../../../shared/components/breadcrumbs/breadcrumbs.component';

// Stub child components to avoid importing their full dependency trees
@Component({ selector: 'app-theme-toggle', template: '', inputs: ['variant', 'showLabel'] })
class ThemeToggleStubComponent {}

@Component({ selector: 'app-breadcrumbs', template: '', inputs: ['items'] })
class BreadcrumbsStubComponent {}

describe('AdminLayoutComponent', () => {
  let component: AdminLayoutComponent;
  let fixture: ComponentFixture<AdminLayoutComponent>;
  let router: Router;
  let mockAuthStore: any;
  let mockRealtimeNotifications: jasmine.SpyObj<RealtimeNotificationService>;

  const mockUser = {
    id: '1',
    name: 'Admin User',
    username: 'admin',
    email: 'admin@example.com',
    role: 'ADMIN',
  };

  beforeEach(async () => {
    mockAuthStore = {
      user: signal(mockUser),
      isAdmin: signal(true),
      isAuthenticated: signal(true),
      isDev: signal(true),
      isEditor: signal(true),
      userDisplayName: signal('Admin User'),
      logout: jasmine.createSpy('logout'),
    };

    mockRealtimeNotifications = jasmine.createSpyObj('RealtimeNotificationService', [
      'connect',
      'disconnect',
    ], {
      connectionLost: signal(false),
    });

    const mockI18n = {
      t: (key: string) => key,
      language: signal('en'),
      setLanguage: jasmine.createSpy('setLanguage'),
    };

    const mockTheme = {
      theme: signal('light'),
      isDark: signal(false),
      preference: signal('light'),
    };

    await TestBed.configureTestingModule({
      imports: [
        AdminLayoutComponent,
        ThemeToggleStubComponent,
        BreadcrumbsStubComponent,
      ],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: ThemeService, useValue: mockTheme },
        { provide: I18nService, useValue: mockI18n },
        { provide: RealtimeNotificationService, useValue: mockRealtimeNotifications },
      ],
    })
      .overrideComponent(AdminLayoutComponent, {
        remove: { imports: [ThemeToggleComponent, BreadcrumbsComponent] },
        add: { imports: [ThemeToggleStubComponent, BreadcrumbsStubComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AdminLayoutComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should connect realtime notifications on init', () => {
    expect(mockRealtimeNotifications.connect).toHaveBeenCalled();
  });

  it('should disconnect realtime notifications on destroy', () => {
    fixture.destroy();
    expect(mockRealtimeNotifications.disconnect).toHaveBeenCalled();
  });

  it('should start with sidebar expanded', () => {
    expect(component.sidebarCollapsed()).toBeFalse();
  });

  it('should toggle sidebar collapsed state', () => {
    expect(component.sidebarCollapsed()).toBeFalse();
    component.toggleSidebar();
    expect(component.sidebarCollapsed()).toBeTrue();
    component.toggleSidebar();
    expect(component.sidebarCollapsed()).toBeFalse();
  });

  it('should return menu items with expected routes', () => {
    const items = component.menuItems();
    const routes = items.map((i: any) => i.route);

    expect(routes).toContain('/admin/dashboard');
    expect(routes).toContain('/admin/articles');
    expect(routes).toContain('/admin/tags');
    expect(routes).toContain('/admin/comments');
    expect(routes).toContain('/admin/settings');
  });

  it('should return all menu items for admin users', () => {
    const visible = component.visibleMenuItems();
    const adminOnlyItems = component.menuItems().filter((i: any) => i.adminOnly);

    // All admin-only items should be visible when user is admin
    adminOnlyItems.forEach((item: any) => {
      expect(visible).toContain(item);
    });
  });

  it('should filter admin-only items for non-admin users', () => {
    mockAuthStore.isAdmin.set(false);
    const visible = component.visibleMenuItems();
    const adminOnlyItems = visible.filter((i: any) => i.adminOnly);

    expect(adminOnlyItems.length).toBe(0);
  });

  it('should have correct number of menu items', () => {
    const items = component.menuItems();
    expect(items.length).toBe(10);
  });

  it('should call authStore.logout and navigate on logout', () => {
    spyOn(router, 'navigate');
    component.logout();
    expect(mockAuthStore.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should render sidebar nav items in the template', () => {
    const navItems = fixture.nativeElement.querySelectorAll('.nav-item');
    expect(navItems.length).toBeGreaterThan(0);
  });
});
